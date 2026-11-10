/* Régression V4.26 — comportements critiques demandés pour Les Archives.
 * Tests statiques de câblage + validation du catalogue, sans connexion SoundShow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {safeCellAttachments} from '../src/soundshow/cell-media-core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');

test('Les commandes du lecteur SoundShow restent présentes',()=>{
  const player=source('src/soundshow/mini-player.mjs');
  for(const action of ['toggle_player_playback','toggle_player_loop','stop_player','fade_out_player','set_player_volume'])
    assert.ok(player.includes(action),'Commande manquante : '+action);
  assert.doesNotMatch(player,/ss-wave-canvas/);
  assert.match(player,/lastPlayed/);
  assert.match(player,/play_playable/);
  assert.match(player,/ss-player-seek/);
});

test('La fenêtre sons reste détachable, redimensionnable et à cases adaptatives',()=>{
  const script=source('src/soundshow/sounds-dock.mjs');
  const css=source('src/soundshow/sounds-dock.css');
  assert.match(script,/function floatWindow\(/);
  assert.match(script,/function anchorWindow\(/);
  assert.match(script,/ss-resize-handle/);
  assert.match(css,/grid-template-columns:repeat\(auto-fill,minmax\(/);
  assert.match(css,/\.ss-floating/);
  assert.match(css,/\.ss-tile-name/);
});

test('Les barres déplaçables restent intégrées sans espace supplémentaire',()=>{
  const workspace=source('src/v66/workspace.mjs');
  assert.match(workspace,/moveBar\('canvas-integrations-dock'/);
  assert.match(workspace,/moveBar\('top-hud'/);
  assert.match(workspace,/\.hud-row > \.top-group:first-child/);
  assert.doesNotMatch(workspace,/handle\.ondblclick/);
  assert.doesNotMatch(workspace,/handle\.title=/);
  assert.doesNotMatch(workspace,/requestFullscreen/);
  assert.match(workspace,/localStorage\.setItem/);
});

test('La révélation de cellules n’envoie que des médias valides et sans doublons',()=>{
  const catalogue=[
    {id:'s1',kind:'sound',locked:false},
    {id:'v1',kind:'video',locked:false},
    {id:'secret',kind:'sound',locked:true}
  ];
  assert.deepEqual(
    safeCellAttachments([
      {id:'s1',action:'fade_in'},
      {id:'s1',action:'start'},
      {id:'v1',action:'replace'},
      {id:'secret',action:'start'},
      {id:'unknown',action:'start'}
    ],catalogue),
    [{id:'s1',kind:'sound',action:'fade_in'},{id:'v1',kind:'video',action:'replace'}]
  );
  assert.deepEqual(safeCellAttachments([{id:'v1',action:'commande-inconnue'}],catalogue),[
    {id:'v1',kind:'video',action:'start'}
  ]);
  assert.deepEqual(safeCellAttachments(null,catalogue),[]);
});

test('Les contrôles des médias de cellules sont réservés au MJ',()=>{
  const sourceCode=source('src/soundshow/cell-media.mjs');
  assert.match(sourceCode,/requireGM\(\)/);
  assert.match(sourceCode,/strictReadOnly/);
  assert.match(sourceCode,/archives:cell-revealed/);
  assert.match(sourceCode,/getCellRevealMedia/);
});

test('La diffusion vidéo vers les joueurs garde le contrôle des rôles Owlbear',()=>{
  const owl=source('src/soundshow/owlbear.mjs');
  assert.match(owl,/OBR\.player\.getRole\(\)/);
  assert.match(owl,/role==='PLAYER'/);
  assert.match(owl,/role==='GM'/);
  assert.match(owl,/soundshow-player\.html/);
  assert.match(owl,/if\(!data\.active\)return;/);
  const main=source('src/soundshow/archives.mjs');
  assert.doesNotMatch(main,/player\.use\(document\.hidden\?null:/);
  const html=source('archives-app-v64-v55.html');
  assert.doesNotMatch(html,/id="archives-fullscreen-toggle"/);
});
