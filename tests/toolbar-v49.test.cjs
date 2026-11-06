const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const base=read("archives-app-v56-v47.html"),updated=read("archives-app-v58-v49.html");
const js=read("src/v49/toolbar.js"),css=read("src/v49/toolbar.css");
function create(initial){
 const dom=new JSDOM('<!doctype html><body><nav id="quick-icon-dock"><button id="quick-dock-handle"></button><button class="quick-icon-btn" id="keep" onclick="window.calls=(window.calls||0)+1"></button></nav></body>',{runScripts:"dangerously",url:"https://toniogervais.github.io"});
 if(initial)dom.window.localStorage.setItem("archives_toolbar_collapsed_v49",initial);
 dom.window.eval(js);
 dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
 return dom;
}
test("New app is exactly secured V4.7 plus two head resources",()=>{
 const stripped=updated.replace('<link rel="stylesheet" href="./src/v49/toolbar.css">\n<script defer src="./src/v49/toolbar.js"></script>\n',"");
 assert.equal(stripped,base);
 assert.ok(updated.indexOf("src/v49/toolbar.css")<updated.indexOf("</head>"));
 assert.match(updated,/BEGIN SECURITY: player projection V4\.7/);
});
test("Fold, unfold, persist and keep original commands",()=>{
 const dom=create();
 const w=dom.window,d=w.document.getElementById("quick-icon-dock");
 const btn=w.document.getElementById("archives-toolbar-collapse");
 assert.ok(btn);assert.equal(btn.getAttribute("aria-expanded"),"true");
 btn.click();assert.ok(d.classList.contains("archives-toolbar-collapsed"));
 assert.equal(w.localStorage.getItem("archives_toolbar_collapsed_v49"),"1");
 btn.click();assert.ok(!d.classList.contains("archives-toolbar-collapsed"));
 d.querySelector("#keep").click();assert.equal(w.calls,1);
 assert.equal(d.querySelectorAll("#quick-dock-handle").length,1);
 w.close();
});
test("Folded state reloads and works with screen-reader labels",()=>{
 const dom=create("1");const w=dom.window;
 const dock=w.document.getElementById("quick-icon-dock"),btn=w.document.getElementById("archives-toolbar-collapse");
 assert.ok(dock.classList.contains("archives-toolbar-collapsed"));
 assert.match(btn.getAttribute("aria-label"),/Déployer/);
 btn.click();
 assert.match(btn.getAttribute("aria-label"),/Réduire/);
 w.close();
});
test("CSS hides original icons even in player and strict read-only mode",()=>{
 assert.match(css,/body\.player-mode #quick-icon-dock\.archives-toolbar-collapsed > \.quick-icon-btn/);
 assert.match(css,/body\.strict-readonly #quick-icon-dock\.archives-toolbar-collapsed > \.quick-icon-btn/);
 assert.match(css,/\.dock-horizontal/);
});
test("Only visual script added, not data or network behavior",()=>{
 assert.doesNotMatch(js,/fetch\(|window\.open\(|\.removeItem\(|\.sendMessage\(/);
 assert.match(base,/src\/v46\/archives-transfer\.mjs/);
 assert.match(updated,/src\/v46\/archives-transfer\.mjs/);
 assert.match(updated,/src\/v46\/archives-navigation\.mjs/);
});
