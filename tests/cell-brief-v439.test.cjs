const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = path => fs.readFileSync(path,'utf8');

test('V4.39 — fiche MJ de chaque cellule, portrait, description, révélations et garde joueur',async()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="nodes-layer"><div class="node-cell" data-id="n-test"><div class="cell-actions"></div></div></div></body></html>',{
  url:'https://toniogervais.github.io/archives-owlbear/archives-app-v64-v55.html',
  runScripts:'outside-only',pretendToBeVisual:true
 });
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 const node={
  id:'n-test',title:'Les trois disparus',category:'personnage',faction:'Enquête',
  desc:'Une description importante.\nUn secret réservé au MJ.',
  bgImg:'data:image/png;base64,iVBORw0KGgo=',
  revealed:true,
  clues:[
   {id:'c1',text:'Indice déjà découvert',revealed:true},
   {id:'c2',text:'Indice à découvrir',revealed:false}
  ]
 };
 const state={playerMode:false,strictReadOnly:false,nodes:[node]};
 const calls=[];
 w.DuneApp={
  getState:()=>state,
  setBriefClueRevealed:(nodeId,clueId,next)=>{
   calls.push({nodeId,clueId,next});
   const clue=node.clues.find(c=>c.id===clueId);
   if(!clue)return false;
   clue.revealed=next;return true;
  }
 };
 try{
  w.eval(read('src/v68/cell-brief.mjs'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(resolve=>setTimeout(resolve,65));
  const btn=w.document.querySelector('.node-cell .archives-cell-brief-trigger');
  assert.ok(btn,'A GM-only fiche button should appear above every node');
  btn.click();
  const dlg=w.document.getElementById('archives-cell-brief');
  assert.ok(dlg.open,'The game brief should open independently of editing');
  assert.equal(w.document.getElementById('archives-brief-title').textContent,'Les trois disparus');
  assert.match(w.document.getElementById('archives-brief-description').textContent,/Un secret réservé au MJ/);
  assert.ok(w.document.querySelector('#archives-brief-figure img'));
  assert.equal(w.document.querySelectorAll('.brief-clue-checkbox').length,2);
  assert.equal(w.document.getElementById('archives-brief-count').textContent,'1 / 2 révélés');
  const second=w.document.querySelectorAll('.brief-clue-checkbox')[1];
  assert.equal(second.checked,false);
  second.checked=true;
  second.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.deepEqual(calls,[{nodeId:'n-test',clueId:'c2',next:true}]);
  assert.equal(w.document.getElementById('archives-brief-count').textContent,'2 / 2 révélés');
  dlg.close();
  state.playerMode=true;
  w.ArchivesCellBrief.open(node.id);
  assert.equal(dlg.open,false,'A player must not be able to open MJ notes');
 } finally {dom.window.close()}
});

test('Google Drive launcher is no longer loaded; the new game brief is loaded',()=>{
 const html=read('archives-app-v64-v55.html');
 assert.doesNotMatch(html,/<script[^>]*src="\.\/src\/v67\/google-drive\.mjs/);
 assert.match(html,/src\/v68\/cell-brief\.mjs/);
 assert.match(html,/setBriefClueRevealed: function/);
});
