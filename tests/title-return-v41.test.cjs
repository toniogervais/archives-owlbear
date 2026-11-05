const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname,"..");
const read = name => fs.readFileSync(path.join(root,name),"utf8");

function helper(){
  const source=read("src/v41/focus-archives.mjs").replace(/^export /gm,"")+
    "\n;globalThis.focusArchives=focusArchives;";
  const context={URL};
  vm.runInNewContext(source,context);
  return context.focusArchives;
}
const base="https://toniogervais.github.io/archives-owlbear/archives-app-v53-v41.html";

test("Initial navigation shows title; resume fallback skips title",()=>{
  const html=read("archives-app-v53-v41.html");
  const title=html.slice(html.indexOf('<script id="archives-title-screen-script">'),
                        html.indexOf('</script>',html.indexOf('<script id="archives-title-screen-script">')));
  assert.match(title,/params\.get\("resume"\)==="1"/);
  assert.match(title,/screen\.hidden=false/);
  assert.match(html,/<script type="module" src="\.\/src\/v41\/archives-navigation\.mjs"><\/script>/);
  assert.ok(fs.existsSync(path.join(root,"archives-app-v52-v40.html")));
});
test("Owlbear enabled icon is visibly active, not forbidden",()=>{
  const html=read("archives-app-v53-v41.html");
  const nav=read("src/v41/archives-navigation.mjs");
  assert.match(html,/button\.canvas-integration-icon:not\(:disabled\)/);
  assert.match(html,/cursor:pointer;opacity:1/);
  assert.match(nav,/icon\.disabled=false/);
  assert.match(nav,/icon\.style\.cursor="pointer"/);
});
test("Archives navigates to the existing Owlbear tab instead of reloading",()=>{
  const nav=read("src/v41/archives-navigation.mjs");
  assert.match(nav,/window\.open\("",MAP_TAB\)/);
  assert.match(nav,/mapWindow\.focus\(\);return true/);
  assert.match(nav,/mapUrl===url/);
  assert.doesNotMatch(nav,/window\.open\(url,MAP_TAB\)/);
});
test("Return to Archives focuses an existing editor without navigation",()=>{
  const fn=helper(), urls=[],c={focus:0};
  const tab={location:{href:base+"?main=1",replace:x=>urls.push(x)},
             focus(){c.focus++}};
  assert.equal(fn(base+"?resume=1",()=>tab),true);
  assert.equal(c.focus,1);
  assert.deepEqual(urls,[]);
});
test("Return fallback opens canevas directly when original tab is gone",()=>{
  const fn=helper(), urls=[];
  const tab={location:{href:"about:blank",replace:x=>urls.push(x)},focus(){}};
  assert.equal(fn(base+"?resume=1",()=>tab),true);
  assert.deepEqual(urls,[base+"?resume=1"]);
});
test("Return fallback upgrades an older tab; denied windows are reported",()=>{
  const fn=helper(), replaced=[];
  const tab={location:{href:"https://toniogervais.github.io/archives-owlbear/archives-app-v52-v40.html",replace:x=>replaced.push(x)},focus(){}};
  assert.equal(fn(base+"?resume=1",()=>tab),true);
  assert.equal(replaced[0],base+"?resume=1");
  assert.equal(fn(base,()=>null),false);
});
test("Owlbear uses new fallback link and named-tab focus",()=>{
  const index=read("index-v41.html");
  const bg=read("src/v41/background.mjs");
  assert.match(index,/archives-app-v53-v41\.html/);
  assert.match(index,/focusArchives\(goBack\.href\)/);
  assert.match(index,/\?resume=1/);
  assert.match(bg,/const url=root\+"archives-app-v53-v41\.html"\+\(gm\?"\?resume=1":""\)/);
  assert.match(bg,/function returnArchives\(\)/);
  assert.match(bg,/focusArchives\(url\)/);
});
test("Existing MJ invitations are kept intact in both directions",()=>{
  assert.match(read("archives-app-v53-v41.html"),/window\.ArchivesLiveInvitations\s*=/);
  assert.match(read("src/v41/archives-navigation.mjs"),/Rester dans les Archives/);
  assert.match(read("src/v41/background.mjs"),/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
  const manifest=JSON.parse(read("manifest-v41.json"));
  assert.equal(manifest.version,"4.1.0");
});
