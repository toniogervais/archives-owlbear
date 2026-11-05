const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
test("Toolbar sends only a direct-return request to the host, not a URL",()=>{
 const src=read("src/v44/background.mjs");
 assert.match(src,/window\.top\.postMessage\(\{type:REQUEST,id\},"\*"\)/);
 assert.match(src,/onClick:\(_context,elementId\)=>\{requestDirectReturn\(elementId\);return false;\}/);
 assert.doesNotMatch(src,/window\.open\(/);
});
test("Fallback menu remains after bridge failure and invitations remain",()=>{
 const src=read("src/v44/background.mjs");
 assert.match(src,/timeout=setTimeout\(\(\)=>finish\(false\),1700\)/);
 assert.match(src,/OBR\.popover\.open\(options\)/);
 assert.match(src,/OBR\.broadcast\.onMessage/);
 assert.match(src,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
});
test("Manifest keeps the gold icon and linked action",()=>{
 const m=JSON.parse(read("manifest-archives-44.json"));
 assert.equal(m.version,"4.4.0");
 assert.ok(m.name.length<45);
 assert.match(m.action.icon,/icon-archives-v43\.svg$/);
 assert.match(m.background_url,/background-v44\.html$/);
});
test("V4.1 Archives remain the entry point",()=>{
 assert.ok(fs.existsSync(path.join(root,"archives-app-v53-v41.html")));
});
