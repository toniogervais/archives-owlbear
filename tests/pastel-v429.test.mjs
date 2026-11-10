import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('La V4.29 ajoute une palette pastel à toutes les principales barres sans modifier leur structure',()=>{
 const css=read('src/v66/pastel-icons.css');
 const html=read('archives-app-v64-v55.html');
 const workspace=read('src/v66/workspace.mjs');
 assert.match(html,/src\/v66\/pastel-icons\.css\?v=4290/);
 for(const selector of ['#quick-icon-dock','#top-hud','#tabs-bar','#canvas-integrations-dock','#soundshow-sounds-dock','#settings-fab','#create-fab','.cell-actions .mini-btn']){
   assert.ok(css.includes(selector),'Sélecteur absent : '+selector);
 }
 for(const pastel of ['--arc-pastel-lavender','--arc-pastel-blue','--arc-pastel-mint','--arc-pastel-peach','--arc-pastel-pink']){
   assert.ok(css.includes(pastel),'Couleur pastel absente : '+pastel);
 }
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/pointer-events:\s*none/);
 assert.match(workspace,/window\.addEventListener\('pointermove',onMove,true\)/);
});
