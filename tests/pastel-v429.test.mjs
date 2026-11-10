import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('V4.29.2 : uniquement bleu pastel et vert menthe, réservés aux icônes du canevas',()=>{
  const html=read('archives-app-v64-v55.html');
  const start=html.indexOf('<style id="archives-pastel-v4292">');
  assert.ok(start>=0,'La feuille CSS limitée au canevas doit être présente.');
  const css=html.slice(start,html.indexOf('</style>',start));
  const workspace=read('src/v66/workspace.mjs');
  for(const selector of [
    '#quick-icon-dock .quick-icon-btn',
    '#canvas-integrations-dock .canvas-integration-icon:not(:disabled)',
    '#soundshow-sounds-dock > .ss-sound-trigger',
    '#soundshow-sounds-dock > .ss-video-trigger',
    '#settings-fab','#archives-home-fab','#create-fab'
  ])assert.ok(css.includes(selector),'Icône du canevas absente : '+selector);
  assert.match(css,/#b9d9f8/);
  assert.match(css,/#bcebd9/);
  assert.doesNotMatch(css,/--arc-pastel-(lavender|pink|peach|sand)/);
  assert.doesNotMatch(css,/#top-hud\s+[^\n{]+\s*\{/);
  assert.doesNotMatch(css,/\.cell-actions\s+\.mini-btn\s*\{/);
  assert.doesNotMatch(css,/#soundshow-sounds-panel\s+\.ss-player-btn/);
  assert.doesNotMatch(css,/pointer-events:\s*none/);
  assert.match(workspace,/window\.addEventListener\('pointermove',onMove,true\)/);
  assert.doesNotMatch(html,/<style id="archives-pastel-v4291">/);
});
