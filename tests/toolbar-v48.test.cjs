const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("src/v48/toolbar.css");
const js=read("src/v48/toolbar.js");
const html=read("archives-app-v57-v48.html");

function browser(mode="",storageValue){
 const document='<!DOCTYPE html><html><body class="'+mode+'">'+
  '<nav id="quick-icon-dock">'+
    '<button id="quick-dock-handle" type="button">Déplacer</button>'+
    '<button class="quick-icon-btn" id="quick-grid-toggle" onclick="window.called=(window.called||0)+1">Grille</button>'+
    '<button class="quick-icon-btn" id="quick-player-journal" onclick="window.journal=(window.journal||0)+1">Journal</button>'+
  '</nav>'+
  '<button id="archives-sync-diag-open" onclick="window.sync=(window.sync||0)+1">◎</button>'+
  '</body></html>';
 const dom=new JSDOM(document,{url:"https://toniogervais.github.io/archives-owlbear/",runScripts:"dangerously",pretendToBeVisual:true});
 if(storageValue!==undefined)dom.window.localStorage.setItem("archives_quick_dock_collapsed_v48",storageValue);
 dom.window.eval(js);
 dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
 return dom;
}
test("New version is additive to V4.7",()=>{
 const previous=read("archives-app-v56-v47.html");
 assert.ok(html.startsWith(previous));
 assert.match(html,/src\/v48\/toolbar\.css/);
 assert.match(html,/src\/v48\/toolbar\.js/);
 assert.match(html,/BEGIN SECURITY: player projection V4\.7/);
 assert.match(html,/src\/v46\/archives-transfer\.mjs/);
 assert.match(html,/src\/v46\/archives-navigation\.mjs/);
});
test("Dock collapse and restore work without replacing command handlers",()=>{
 const {window}=browser();
 const dock=window.document.getElementById("quick-icon-dock");
 const toggle=window.document.getElementById("quick-dock-collapse-toggle");
 const grid=window.document.getElementById("quick-grid-toggle");
 assert.ok(toggle,"collapse button exists");
 assert.equal(dock.querySelectorAll("#quick-dock-handle").length,1,"drag handle retained");
 assert.equal(toggle.getAttribute("aria-expanded"),"true");
 assert.equal(dock.classList.contains("is-collapsed"),false);
 toggle.click();
 assert.equal(dock.classList.contains("is-collapsed"),true);
 assert.equal(toggle.getAttribute("aria-expanded"),"false");
 assert.match(toggle.title,/Afficher/);
 assert.equal(window.localStorage.getItem("archives_quick_dock_collapsed_v48"),"1");
 toggle.click();
 assert.equal(dock.classList.contains("is-collapsed"),false);
 assert.equal(toggle.getAttribute("aria-expanded"),"true");
 grid.click();
 assert.equal(window.called,1,"original onClick command is intact");
 window.close();
});
test("Collapsed toolbar restores state including player mode",()=>{
 const {window}=browser("player-mode strict-readonly","1");
 assert.equal(window.document.getElementById("quick-icon-dock").classList.contains("is-collapsed"),true);
 const toggle=window.document.getElementById("quick-dock-collapse-toggle");
 assert.match(toggle.getAttribute("aria-label"),/Afficher/);
 toggle.click();
 assert.equal(window.localStorage.getItem("archives_quick_dock_collapsed_v48"),"0");
 assert.equal(window.document.getElementById("quick-icon-dock").classList.contains("is-collapsed"),false);
 window.close();
});
test("Existing diagnostic click survives the new SVG",()=>{
 const {window}=browser();
 const diag=window.document.getElementById("archives-sync-diag-open");
 assert.ok(diag.querySelector("svg"));
 diag.click();
 assert.equal(window.sync,1);
 window.close();
});
test("Collapsed rule wins over existing player-mode display overrides",()=>{
 assert.match(css,/#quick-icon-dock\.is-collapsed > :not\(#quick-dock-handle\):not\(#quick-dock-collapse-toggle\)\s*\{[^}]*display:none\s*!important/s);
 assert.match(css,/body\.player-mode #quick-icon-dock > #quick-dock-collapse-toggle/);
 assert.match(css,/#quick-icon-dock\.dock-horizontal/);
 assert.match(css,/max-height:calc\(100dvh - 24px\)/);
});
test("Style does not change Owlbear integration or application actions",()=>{
 assert.doesNotMatch(js,/fetch\(|window\.open\(|location\.assign\(|localStorage\.removeItem\("jdr_architect_save_v12"/);
 assert.match(css,/#canvas-integrations-dock/);
 assert.match(css,/#quick-icon-dock \.quick-icon-btn/);
 assert.match(css,/#top-hud \.tab-btn/);
 assert.match(css,/prefers-reduced-motion/);
});

test("Owlbear V4.8 navigation targets the new version without altering transfer behavior",()=>{
 const manifest=JSON.parse(read("manifest-v48.json"));
 assert.equal(manifest.version,"4.8.0");
 assert.ok([...manifest.name].length<45);
 assert.match(manifest.action.icon,/icon-archives-v43\.svg$/);
 assert.match(manifest.background_url,/background-v48\.html$/);
 assert.match(manifest.action.popover,/index-v48\.html$/);
 const bg=read("src/v48/background.mjs");
 assert.match(bg,/watchTransfers/);
 assert.match(bg,/return-v48\.html/);
 assert.match(bg,/invite-v48\.html/);
 assert.match(read("src/v48/return-link.mjs"),/OBR\.broadcast\.sendMessage/);
 for(const f of ["index-v48.html","return-v48.html","invite-v48.html"]){
   assert.match(read(f),/archives-app-v57-v48\.html/);
   assert.doesNotMatch(read(f),/archives-app-v56-v47\.html/);
 }
 assert.match(read("index-v48.html"),/src\/v46\/transfer-auth\.mjs/);
});
