import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');

test('V4.69 — révélation des cellules et Hide/Show Owlbear sont deux états indépendants',()=>{
  const app=read('archives-app-v64-v55.html'),ui=read('src/v58/transfer-ui.mjs');
  assert.match(app,/toggleRevealById: function\(id, ev\)/);
  assert.doesNotMatch(app,/archives:cell-visibility/);
  assert.doesNotMatch(app,/setTransferredCellReveal/);
  assert.doesNotMatch(ui,/archives:cell-visibility/);
  assert.doesNotMatch(ui,/setTransferredCellReveal/);
  assert.match(ui,/function applyTokenSync\(data\)/);
  assert.match(ui,/tokenSync\.records=data\.records/);
});
test('V4.69 — Hide/Show explicitement choisi dans les Archives sans re-transfert',()=>{
  const ui=read('src/v58/transfer-ui.mjs');
  assert.match(ui,/async function setTokenVisibility\(sourceKey,reveal\)/);
  assert.match(ui,/request\(\{action:'visibility',scene,assetId:id,reveal\}\)/);
  assert.match(ui,/archives-ctx-owl-hide/);
  assert.match(ui,/archives-ctx-owl-show/);
  assert.match(ui,/Placer en Hide \(joueurs\)/);
  assert.match(ui,/Placer en Show \(joueurs\)/);
  assert.match(ui,/Ce personnage n’a pas encore de token/);
});
test('V4.69 — Owlbear crée une vraie visibilité native, sans doublon local du token',()=>{
  const transfers=read('src/v58/transfers.mjs');
  const native=transfers.slice(transfers.indexOf('async function visibility'),transfers.indexOf('const safeImage'));
  assert.match(native,/if\(record\.kind==='TOKEN'\)/);
  assert.match(native,/item\.visible=reveal/);
  assert.match(native,/OBR\.scene\.items\.addItems\(\[item\]\)/);
  assert.match(native,/await removeLocal\(record\.id\)/);
  assert.match(transfers,/record\.kind!=='TOKEN'&&!shared\(record\.id\)/);
  assert.match(transfers,/await OBR\.scene\.items\.addItems\(\[item\]\)/);
  assert.doesNotMatch(native,/DuneApp|toggleRevealById|setTransferredCellReveal/);
});
test('V4.69 — sécurité MJ : aucun contenu de fiche dans le marqueur du token',()=>{
  const transfers=read('src/v58/transfers.mjs');
  const ui=read('src/v58/transfer-ui.mjs');
  assert.match(transfers,/\.metadata\(\{\[assetKey\]:\{\.\.\.publicTokenMarker\(record\),privateForGM:hidden\}\}\)/);
  assert.match(ui,/if\(!record\s*\|\|\s*record\.kind!=='TOKEN'\)/);
  assert.match(ui,/gmState\(\)/);
});
