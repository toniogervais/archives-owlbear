const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {JSDOM}=require("jsdom");const read=p=>fs.readFileSync(p,"utf8");
const app=read("archives-app-v62-v53.html"),nav=read("src/v53/navigation.mjs"),relay=read("src/v53/relay.mjs");
test("V4.13 manifest, launcher and entrypoints",()=>{
 const m=JSON.parse(read("manifest-v53.json"));assert.equal(m.version,"4.13.0");
 for(const url of [m.background_url,m.action.icon,m.action.popover])assert.ok(fs.existsSync(new URL(url).pathname.split("/").pop()));
 for(const part of ["relay","navigation","host","embedded","background","open"])assert.ok(fs.existsSync("src/v53/"+part+".mjs"));
 assert.match(read("archives.html"),/archives-app-v62-v53\.html/);
 assert.match(read("src/v53/host.mjs"),/archives-app-v62-v53\.html/);
});
test("Synchronized edit events and player-safe local backup",()=>{
 assert.equal(app.split("archives:edit:v53").length-1,2);
 assert.match(relay,/archives:edit:v53/);
 assert.match(app,/src\/v53\/navigation\.mjs/);
 const part=app.slice(app.indexOf("function saveState("),app.indexOf("function loadState("));
 assert.match(part,/if \(!state\.strictReadOnly && !state\.playerMode\) \{\s*try \{ window\.localStorage\.setItem/);
 assert.match(part,/peerConns\[i\]\.send\(publicPayload\)/);
 assert.match(part,/projectPlayerPayload\(payload\)/);
});
test("Chrome Android player receives a single-button blurred overlay",()=>{
 const dom=new JSDOM('<body class="player-mode"><div id="canvas-integrations-dock"></div></body>',{url:"https://toniogervais.github.io/archives-owlbear/archives.html",runScripts:"outside-only"});
 vm.runInContext(nav,dom.getInternalVMContext());
 dom.window.dispatchEvent(new dom.window.CustomEvent("archives:invite:v40",{detail:{type:"archives:invite:v40",target:"OWLBEAR",url:"https://owlbear.rodeo/room/test"}}));
 const layer=dom.window.document.getElementById("archives-v40-player-invite");
 assert.ok(layer);assert.ok(nav.includes("backdrop-filter:blur(10px)"));
 assert.equal(layer.querySelectorAll("button").length,1);
 assert.equal(layer.getAttribute("aria-modal"),"true");
 assert.match(nav,/window\.location\.assign\(url\)/);
 dom.window.close();
});
test("Owlbear overlay is fullscreen and GM-validated",()=>{
 const bg=read("src/v53/background.mjs"),ui=read("invite-v53.html");
 assert.match(bg,/fullScreen:true,hideBackdrop:true,hidePaper:true/);
 assert.match(bg,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(ui,/backdrop-filter:blur\(11px\)/);
 assert.equal((ui.match(/<button\b/g)||[]).length,1);
 assert.match(ui,/touch-action:manipulation/);
 assert.doesNotMatch(ui,/Rester ici/);
});
test("Private MJ connection still checks pairing and central persistence",()=>{
 const host=read("src/v53/host.mjs");
 assert.match(relay,/conn\.metadata\?\.secret!==secret/);
 assert.match(relay,/jdr_architect_save_v12/);
 assert.match(host,/archives:flush:v53/);
 assert.match(host,/archives:flushed:v53/);
 assert.match(host,/live-room-v52/);
});
