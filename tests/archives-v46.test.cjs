const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");

test("Archives V4.6 conserves title screen and existing editor",()=>{
 const html=read("archives-app-v55-v46.html");
 assert.match(html,/id="archives-title-screen"/);
 assert.match(html,/src\/v46\/archives-navigation\.mjs/);
 assert.match(html,/src\/v46\/archives-transfer\.mjs/);
 assert.ok(fs.existsSync(path.join(root,"archives-app-v54-v45.html")));
});
test("MJ click triggers a player invitation; only opt-in changes the player's tab",()=>{
 const js=read("src/v46/archives-navigation.mjs");
 assert.match(js,/window\.ArchivesLiveInvitations\?\.inviteToOwlbear\(url\)/);
 assert.match(js,/Rester dans les Archives/);
 assert.match(js,/Afficher Owlbear/);
 assert.match(js,/overlay\.style\.display="grid"/);
 assert.doesNotMatch(js,/function installInviteButton\(/);
});
test("Owlbear return sends the automatic invitation to players",()=>{
 const rt=read("src/v46/return-link.mjs");
 const bg=read("src/v46/background.mjs");
 assert.match(rt,/OBR\.broadcast\.sendMessage/);
 assert.match(rt,/focusArchives\(link\.href\)/);
 assert.match(bg,/OBR\.broadcast\.onMessage/);
 assert.match(bg,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(bg,/invite-v46\.html/);
});
test("MJ account can be connected from a secondary menu, with no browser extension",()=>{
 const html=read("index-v46.html");
 const auth=read("src/v46/transfer-auth.mjs");
 assert.match(html,/Connexion MJ pour les transferts/);
 assert.match(html,/details id="archives-v46-auth-details"/);
 assert.match(html,/type="password"/);
 assert.match(auth,/signInWithPassword/);
 assert.match(auth,/password\.value=""/);
 assert.match(auth,/publicConfig\(localStorage\)/);
 assert.match(auth,/archives_owlbear_public_config_v27/);
 assert.match(html,/service_role/);
});
test("Cell transfer is opt-in and never sends descriptions or clues",()=>{
 const js=read("src/v46/archives-transfer.mjs");
 assert.match(js,/window\.confirm\(/);
 assert.match(js,/if\(!confirmation\(snapshot\)\)return/);
 assert.match(js,/Révéler dans Owlbear/);
 assert.match(js,/ctx\.db\.from\("archives_owlbear_cell_transfers"\)\.insert\(payload\)/);
 assert.doesNotMatch(js,/node\.desc,/);
 assert.doesNotMatch(js,/node\.clues,/);
});
test("Remote portraits are checked and uploaded with accurate dimensions",()=>{
 const js=read("src/v46/archives-transfer.mjs");
 assert.match(js,/fetch\(source,\{mode:"cors"\}\)/);
 assert.match(js,/blob\.size>MAX_BYTES/);
 assert.match(js,/width>12000\|\|height>12000/);
 assert.match(js,/getPublicUrl\(path\)/);
 assert.match(js,/followTransfer\(ctx\.db,transferId\)/);
});
test("Characters are placed as Owlbear tokens near GM viewport",()=>{
 const client=read("src/v46/archives-transfer.mjs");
 const receiver=read("src/v46/transfer-receiver.mjs");
 assert.match(client,/category==="personnage"\?"CHARACTER"/);
 assert.match(receiver,/OBR\.viewport\.inverseTransformPoint/);
 assert.match(receiver,/\.position\(position\)/);
 assert.match(receiver,/OBR\.scene\.items\.addItems\(\[item\]\)/);
 assert.match(receiver,/same\(item\.metadata\[SOURCE_KEY\],itemMeta\)/);
 assert.match(receiver,/type:"PLAIN",plainText:row\.title/);
 assert.match(receiver,/sdk\.onReady/);
});
test("SQL requires owner, linked room and active scene",()=>{
 const sql=read("sql/archives-cell-transfers-v45.sql");
 assert.match(sql,/enable row level security/);
 assert.match(sql,/created_by=auth\.uid\(\)/);
 assert.match(sql,/c\.owner_id=auth\.uid\(\)/);
 assert.match(sql,/l\.room_id::text=public\.archives_owlbear_cell_transfers\.room_id/);
 assert.match(sql,/s\.owlbear_scene_id::text=public\.archives_owlbear_cell_transfers\.scene_key/);
});
test("Owlbear manifest name satisfies the short-name limit",()=>{
 const manifest=JSON.parse(read("manifest-v46.json"));
 assert.ok([...manifest.name].length<45);
 assert.equal(manifest.version,"4.6.1");
 assert.match(manifest.action.icon,/icon-archives-v43\.svg$/);
 assert.match(manifest.action.popover,/index-v46\.html$/);
});
