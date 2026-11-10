import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('La barre des actes reste déplaçable sans titre ni double clic',()=>{
  const source=read('src/v66/workspace.mjs');
  assert.match(source,/\.hud-row > \.top-group:first-child/);
  assert.match(source,/\.prepend\(handle\)/);
  assert.match(source,/setPointerCapture/);
  assert.doesNotMatch(source,/handle\.ondblclick|handle\.title\s*=/);
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
