const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=f=>fs.readFileSync(path.resolve(__dirname,"..",f),"utf8");
test("Archives start on title screen, with V4.5 modules",()=>{
 const html=read("archives-app-v54-v45.html");
 assert.match(html,/id="archives-title-screen"/);
 assert.match(html,/src\/v45\/archives-navigation\.mjs/);
 assert.match(html,/src\/v45\/archives-transfer\.mjs/);
});
test("GM navigation triggers invitation to connected live players",()=>{
 const nav=read("src/v45/archives-navigation.mjs");
 assert.match(nav,/window\.ArchivesLiveInvitations\?\.inviteToOwlbear\(url\)/);
 assert.match(nav,/Afficher Owlbear/);
 assert.match(nav,/Rester dans les Archives/);
 assert.doesNotMatch(nav,/\ninstallInviteButton\(\);/);
});
test("Owlbear return triggers room invitation for players",()=>{
 const rt=read("src/v45/return-link.mjs");
 const bg=read("src/v45/background.mjs");
 assert.match(rt,/OBR\.broadcast\.sendMessage/);
 assert.match(rt,/gm\)link\.href/);
 assert.match(bg,/OBR\.broadcast\.onMessage/);
 assert.match(bg,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(bg,/invite-v45\.html/);
 assert.match(read("invite-v45.html"),/Revenir aux Archives/);
});
test("Per-cell transfer requires owner and confirmation",()=>{
 const js=read("src/v45/archives-transfer.mjs");
 assert.match(js,/Révéler dans Owlbear/);
 assert.match(js,/window\.confirm\(/);
 assert.match(js,/const \{state,node\}=ownerOnly\(\)/);
 assert.match(js,/ctx\.db\.from\("archives_owlbear_cell_transfers"\)\.insert\(payload\)/);
 assert.match(js,/Les descriptions, secrets et indices/);
 assert.doesNotMatch(js,/node\.desc,/);
});
test("Characters are tokens, locations are maps when illustrated",()=>{
 const js=read("src/v45/archives-transfer.mjs");
 const receiver=read("src/v45/transfer-receiver.mjs");
 assert.match(js,/category==="personnage"\?"CHARACTER"/);
 assert.match(js,/category==="lieu"&&!image\.isFallback\?"MAP"/);
 assert.match(receiver,/OBR\.scene\.items\.addItems\(\[item\]\)/);
 assert.match(receiver,/\.layer\(row\.item_layer\)/);
 assert.match(receiver,/same\(item\.metadata\[SOURCE_KEY\],itemMeta\)/);
});
test("RLS restricts all cell transfer access to campaign owner",()=>{
 const sql=read("sql/archives-cell-transfers-v45.sql");
 assert.match(sql,/enable row level security/);
 assert.match(sql,/created_by=auth\.uid\(\)/);
 assert.match(sql,/c\.owner_id=auth\.uid\(\)/);
 assert.doesNotMatch(sql,/l\.campaign_id=campaign_id/);
 assert.match(sql,/l\.room_id::text=public\.archives_owlbear_cell_transfers\.room_id/);
 assert.match(sql,/s\.owlbear_scene_id::text=public\.archives_owlbear_cell_transfers\.scene_key/);
 assert.match(sql,/revoke all.*anon,public/);
});
test("Owlbear manifest is valid and name is short",()=>{
 const m=JSON.parse(read("manifest-v45.json"));
 assert.equal(m.version,"4.5.0");
 assert.ok([...m.name].length<45);
 assert.match(m.action.icon,/icon-archives-v43\.svg/);
});
