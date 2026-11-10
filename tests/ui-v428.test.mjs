import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('La barre des actes reste déplaçable sans titre ni double clic',()=>{
  const source=read('src/v66/workspace.mjs');
  assert.match(source,/\.hud-row > \.top-group:first-child/);
  assert.match(source,/target\.prepend\(grip\)/);
  assert.match(source,/window\.addEventListener\('pointermove',onMove,true\)/);
  assert.doesNotMatch(source,/grip\.ondblclick|grip\.title\s*=/);
});

test('La barre SoundShow passe du vertical à l’horizontal et mémorise son orientation',()=>{
  const js=read('src/soundshow/sounds-dock.mjs');
  const css=read('src/soundshow/sounds-dock.css');
  assert.match(js,/horizontal:.*\.classList\.contains\('ss-horizontal'\)/s);
  assert.match(js,/dock\.classList\.toggle\('ss-horizontal',horizontal\)/);
  assert.match(js,/positionDock\(/);
  assert.match(css,/#soundshow-sounds-dock\.ss-horizontal\{flex-direction:row/);
  assert.doesNotMatch(js,/dragButton\.title\s*=/);
});

test('Le catalogue affiche une description déroulante accessible et un retour depuis les bibliothèques',()=>{
  const html=read('archives-app-v64-v55.html');
  assert.match(html,/catalogue-desc" tabindex="0" role="region"/);
  assert.match(html,/#archives-catalogue-modal \.catalogue-grid\.search-mode \.catalogue-desc/);
  assert.match(html,/max-height:132px;min-height:45px;overflow-y:auto/);
  assert.match(html,/back\.textContent='← Retour'/);
  assert.match(html,/catalogue\.classList\.toggle\('open',!!goBack\)/);
  assert.match(html,/back\.onclick=function\(\)\{leave\(true\)\}/);
  assert.doesNotMatch(html,/class="quick-dock-handle" title=/);
});

test('Le glissement de la poignée des actes déplace réellement le groupe de boutons',async()=>{
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM('<!doctype html><html><head></head><body><div id="canvas-integrations-dock"></div><div id="top-hud"><div class="hud-row"><div class="top-group"><div id="tabs-bar">Acte 1</div></div></div></div></body></html>',{
    url:'https://archives.test/',runScripts:'outside-only'
  });
  const {window}=dom;
  window.DuneApp={getState:()=>({playerMode:false,strictReadOnly:false})};
  const script=read('src/v66/workspace.mjs').replace(/^import\s+\{isGM\}\s+from\s+['"][^'"]+['"];?/m,'const isGM=()=>true;');
  window.eval(script);
  const handle=window.document.querySelector('#top-hud .archives-dock-move');
  const acts=window.document.querySelector('#top-hud .top-group');
  assert.ok(handle,'La poignée doit être dans la zone visible des actes.');
  function pointer(type,x,y){
    const event=new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
    Object.defineProperty(event,'pointerId',{value:17});
    (type==='pointerdown'?handle:window).dispatchEvent(event);
  }
  pointer('pointerdown',40,15);
  pointer('pointermove',200,85);
  pointer('pointerup',200,85);
  assert.equal(acts.style.position,'fixed');
  assert.ok(parseFloat(acts.style.left)>0,'La position horizontale doit changer.');
  assert.ok(parseFloat(acts.style.top)>0,'La position verticale doit changer.');
  assert.ok(window.localStorage.getItem('archives:dock-location:v426:top-hud'),'La position doit être mémorisée.');
  dom.window.close();
});
