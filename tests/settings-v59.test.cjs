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
test("A player only keeps the dossier, personal notes and revealed act navigation",async()=>{
 const dom=page(),w=dom.window,d=w.document;
 w.installOwlPlayerInterface();d.dispatchEvent(new w.Event("DOMContentLoaded"));
 for(const id of ["archives-title-screen","archives-gm-choice-modal","archives-cloud-panel","settings-modal","settings-fab","canvas-save-icon","cell-catalog-icon","clear-act-button"])assert.equal(d.getElementById(id),null);
 assert.equal(d.getElementById("archives-home-fab").getAttribute("aria-label"),"Retour à Owlbear");
 const group=d.querySelector('#top-hud .hud-row>.top-group:first-child');
 assert.equal(group.querySelector('#quick-player-journal').getAttribute('aria-label'),'Journal des révélations');
 assert.equal(group.querySelector('#quick-player-notes').getAttribute('aria-label'),'Mes notes');
 const dossier=d.createElement('button');dossier.id='archives-dossier-open';group.prepend(dossier);
 const intruder=d.createElement('button');intruder.id='late-gm-control';group.append(intruder);
 const edit=d.createElement('button');edit.textContent='＋ Acte';d.getElementById('tabs-bar').append(edit);
 const act=d.createElement('button');act.className='tab-btn';act.textContent='Acte révélé';d.getElementById('tabs-bar').append(act);
 await new Promise(resolve=>w.setTimeout(resolve,0));
 assert.deepEqual(Array.from(group.children,x=>x.id),['archives-dossier-open','quick-player-journal','quick-player-notes','tabs-bar']);
 assert.equal(d.getElementById('late-gm-control'),null);assert.deepEqual(Array.from(d.querySelectorAll('#tabs-bar button'),x=>x.textContent),['Acte révélé']);
 w.close();
});
test("Player cloud integration exits before restoring any account or campaign session",()=>{
 const body=html.match(/<script id="archives-cloud-integration">([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(body,{window:{DuneApp:{getState:()=>({strictReadOnly:true})}},document:new Proxy({},{get(){assert.fail("A player must not initialise cloud controls");}})});
});
