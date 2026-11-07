const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {JSDOM}=require("jsdom");
const html=fs.readFileSync("archives-app-v64-v55.html","utf8");
const source=fs.readFileSync("src/v59/settings.mjs","utf8").replaceAll("export function ","function ");
function page(){
 const dom=new JSDOM(html,{url:"https://archives.test/",runScripts:"outside-only"});
 const w=dom.window,d=w.document,content=d.getElementById("settings-content");
 content.append(d.querySelector(".universe-bar"));
 for(const id of ["pin-block-webimg","pin-block-canvas-bg","pin-block-session"])content.append(d.getElementById(id));
 w.eval(source);return dom;
}
test("Owlbear settings preserve controls and exports while removing redundant connection commands",()=>{
 const dom=page(),w=dom.window,d=w.document;
 w.installOwlSettings();d.dispatchEvent(new w.Event("DOMContentLoaded"));w.installOwlSettings();
 assert.deepEqual(Array.from(d.querySelectorAll("#settings-content > details > summary"),x=>x.textContent),
  ["Apparence","Sons","Sauvegardes","Options avancées"]);
 for(const id of ["up-json","up-settings-json","up-prog-json","v18-font-target","up-bg","sel-reveal-sound","accounts-campaigns-setting"])
  assert.equal(d.querySelectorAll("#"+id).length,1,id+" remains available exactly once");
 assert.equal(d.querySelector("#settings-content [data-live-standalone]"),null);
 assert.equal(d.getElementById("program-update-panel"),null);
 assert.equal(d.querySelector("#owl-settings-advanced").open,false);
 assert.equal(d.querySelector('#owl-settings-backups [onclick="DuneApp.exportJson()"]').textContent,"Sauvegarder le scénario");
 w.close();
});
test("A player has no title, account or MJ settings controls",()=>{
 const dom=page(),w=dom.window,d=w.document;
 w.installOwlPlayerInterface();d.dispatchEvent(new w.Event("DOMContentLoaded"));
 for(const id of ["archives-title-screen","archives-gm-choice-modal","archives-cloud-panel","settings-modal","settings-fab"])assert.equal(d.getElementById(id),null);
 assert.equal(d.getElementById("archives-home-fab").getAttribute("aria-label"),"Retour à Owlbear");
 w.close();
});
test("Player cloud integration exits before restoring any account or campaign session",()=>{
 const body=html.match(/<script id="archives-cloud-integration">([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(body,{window:{DuneApp:{getState:()=>({strictReadOnly:true})}},document:new Proxy({},{get(){assert.fail("A player must not initialise cloud controls");}})});
});
