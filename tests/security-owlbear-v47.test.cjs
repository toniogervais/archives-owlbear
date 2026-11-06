const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const get=name=>fs.readFileSync(path.resolve(__dirname,"..",name),"utf8");
test("Every V4.7 Owlbear return sends users to protected Archives V4.7",()=>{
 for(const file of ["index-v47.html","return-v47.html","invite-v47.html"]){
  const source=get(file);
  assert.match(source,/archives-app-v56-v47\.html/,file);
  assert.doesNotMatch(source,/archives-app-v55-v46\.html/,file);
 }
});
test("Toolbar popover and invitations both use current V4.7 files",()=>{
 const bg=get("src/v47/background.mjs");
 assert.match(bg,/return-v47\.html/);
 assert.match(bg,/invite-v47\.html/);
 assert.match(bg,/OBR\.broadcast\.onMessage/);
 assert.match(bg,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(bg,/\.\.\/v46\/transfer-receiver\.mjs/);
});
test("MJ automatic return invitation is preserved",()=>{
 const src=get("src/v47/return-link.mjs");
 assert.match(src,/OBR\.broadcast\.sendMessage/);
 assert.match(src,/quick-return-v47/);
 assert.match(src,/focusArchives\(link\.href\)/);
});
test("Mj login remains behind the existing secondary menu",()=>{
 const h=get("index-v47.html");
 assert.match(h,/Connexion MJ pour les transferts/);
 assert.match(h,/src\/v46\/transfer-auth\.mjs/);
});
test("Manifest is short, with one Gold icon and V4.7 return routes",()=>{
 const m=JSON.parse(get("manifest-v47.json"));
 assert.ok([...m.name].length<45);
 assert.equal(m.version,"4.7.0");
 assert.match(m.action.icon,/icon-archives-v43\.svg$/);
 assert.match(m.background_url,/background-v47\.html$/);
 assert.match(m.action.popover,/index-v47\.html$/);
});
test("Secure app V4.7 is present alongside its read-only audit",()=>{
 assert.ok(fs.existsSync(path.resolve(__dirname,"../archives-app-v56-v47.html")));
 assert.ok(fs.existsSync(path.resolve(__dirname,"../sql/security-audit-readonly-v47.sql")));
});
