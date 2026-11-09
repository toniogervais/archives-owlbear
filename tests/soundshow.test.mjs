import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {decodeSession,encodeSession,validSession,publicPlayback,autoLinkProtocol,owlbearLinkProtocol,validLocalBridgeOrigin} from '../src/soundshow/protocol.mjs';
import {explainConnectionFailure} from '../src/soundshow/connection.mjs';
import {clickCommand,validSoundAction} from '../src/soundshow/sounds-dock.mjs';
import {safeCellAttachments} from '../src/soundshow/cell-media-core.mjs';
import {safeProgress,formatClock} from '../src/soundshow/mini-player.mjs';
test('SoundShow pairing accepts only a versioned peer and a strong secret',()=>{
  const session={version:1,peer:'host-12345678',secret:'a'.repeat(64)};
  assert.deepEqual(decodeSession(encodeSession(session)),session);
  for(const code of ['SS2.https://evil.test.'+'a'.repeat(64),'SS2.host-12345678.short','JDR-1234','SS2.host-12345678.'+'a'.repeat(64)+'.extra'])assert.throws(()=>decodeSession(code));
  assert.equal(validSession({...session,version:2}),false);
});
test('Only playback metadata intended for players passes through',()=>{
  const data=publicPlayback({type:'playback',active:true,id:'cue-12345678',title:'Une vidéo',playing:true,volume:3,password:'PRIVATE',path:'C:/PRIVATE/video.mp4'});
  assert.equal(data.volume,1);assert.equal(data.playing,true);assert.ok(!JSON.stringify(data).includes('PRIVATE'));
  assert.equal(publicPlayback({type:'playback',active:true}),null);
  assert.deepEqual(publicPlayback({type:'playback',active:false,private:'PRIVATE'}),{type:'playback',active:false});
});
test('The active Archives application still parses after the SoundShow live-session hooks',()=>{
  const html=fs.readFileSync(new URL('../archives-app-v64-v55.html',import.meta.url),'utf8');let count=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    if(/\bsrc\s*=|\btype\s*=\s*["']module/.test(match[1]))continue;
    new vm.Script(match[2],{filename:'Archives-inline-'+(++count)});
  }
  assert.ok(count>5);
});

test('SoundShow player provides useful diagnostics without exposing codes',()=>{
  assert.match(explainConnectionFailure('peer-unavailable','peer'),/code SoundShow peut être périmé/);
  assert.match(explainConnectionFailure('webrtc','peer'),/pare-feu Windows/);
  assert.match(explainConnectionFailure('network','signal'),/Serveur de mise en relation/);
  assert.match(explainConnectionFailure('timeout','handshake'),/PC n’a pas confirmé/);
  assert.doesNotMatch(explainConnectionFailure('peer-unavailable','peer'),/SS2\.|secret|password/);
});

test('Automatic SoundShow pairing accepts only a loopback origin with explicit local port',()=>{
  assert.equal(autoLinkProtocol,'archives:soundshow:link-v1');
  assert.equal(owlbearLinkProtocol,'archives:soundshow:owlbear-link-v1');
  assert.equal(validLocalBridgeOrigin('http://127.0.0.1:47321'),true);
  assert.equal(validLocalBridgeOrigin('http://localhost:56781'),true);
  for(const origin of ['https://127.0.0.1:47321','http://192.168.1.9:47321',
    'http://127.0.0.1','https://toniogervais.github.io','http://127.0.0.1.evil.test:47321',
    'http://user:pass@localhost:47321','null']){
    assert.equal(validLocalBridgeOrigin(origin),false,origin);
  }
});
test('The simplified UI never requires a code as its primary action',()=>{
  const app=fs.readFileSync(new URL('../src/soundshow/archives.mjs',import.meta.url),'utf8');
  const bridge=fs.readFileSync(new URL('../soundshow-bridge/web/index.html',import.meta.url),'utf8');
  assert.match(app,/Dépannage : connexion manuelle avec un code/);
  assert.match(bridge,/Ouvrir Owlbear et relier les joueurs/);
  assert.match(bridge,/Connexion manuelle \(uniquement en cas de problème\)/);
  assert.match(app,/Ouvre Owlbear depuis le connecteur Windows|ouvre Owlbear à partir du connecteur Windows/i);
  const owl=fs.readFileSync(new URL('../src/soundshow/owlbear.mjs',import.meta.url),'utf8');
  assert.match(owl,/type:'request',challenge:localChallenge/);
  assert.match(owl,/event.source!==localConnector/);
  assert.match(owl,/await OBR.player.getRole\(\)!=='GM'/);
});

test('The Owlbear SoundShow telecommand covers audio and video with GM-only local authorization',()=>{
  const ui=fs.readFileSync(new URL('../src/soundshow/remote.mjs',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../src/soundshow/archives.mjs',import.meta.url),'utf8');
  const remoteHost=fs.readFileSync(new URL('../src/soundshow/host.mjs',import.meta.url),'utf8');
  const background=fs.readFileSync(new URL('../src/soundshow/owlbear.mjs',import.meta.url),'utf8');
  const connector=fs.readFileSync(new URL('../soundshow-bridge/web/host.mjs',import.meta.url),'utf8');
  assert.match(ui,/\['sound','Sons'\]/);
  assert.match(ui,/\['video','Vidéos'\]/);
  for(const action of ['play_playable','pause_all','resume_all','stop_all','fade_out_all',
    'toggle_player_playback','stop_player','fade_out_player','set_player_volume',
    'set_next_sound_volume']){
    assert.ok(ui.includes(action),action);
  }
  assert.match(app,/mountRemote\(remoteHost/);
  assert.match(app,/if\(embedded\)/);
  assert.match(background,/role!=='GM'/);
  assert.match(background,/await OBR.player.getRole\(\)!=='GM'/);
  assert.match(background,/controlToken:localControlToken/);
  assert.match(remoteHost,/owl-soundshow-remote-command/);
  assert.match(connector,/data.controlToken===controlToken/);
  assert.doesNotMatch(connector,/owlWindow=window.open\(archivesPath/);
});

test('SoundShow grid sends one real native playable action according to the selected mouse click',()=>{
  const rain={id:'rain',kind:'sound',locked:false};
  for(const action of ['start','fade_in','crossfade','replace','toggle','toggle_fade']){
    assert.equal(validSoundAction(action),action);
    assert.deepEqual(clickCommand(rain,action),{type:'play_playable',playable_id:'rain',action});
  }
  assert.equal(validSoundAction('delete_project'),'none');
  assert.equal(clickCommand(rain,'none'),null);
  assert.equal(clickCommand({...rain,locked:true},'start'),null);
  assert.equal(clickCommand({id:'fake',kind:'instruction'},'start'),null);
  const html=fs.readFileSync(new URL('../archives-app-v64-v55.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../src/soundshow/archives.mjs',import.meta.url),'utf8');
  const dock=fs.readFileSync(new URL('../src/soundshow/sounds-dock.mjs',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../src/soundshow/sounds-dock.css',import.meta.url),'utf8');
  assert.match(html,/id="main-area"/);
  assert.match(app,/mountSoundDock\(/);
  assert.match(app,/isGM/);
  assert.match(dock,/app.append\(panel\)/);
  assert.match(dock,/window.DuneApp\?\.resetView\?\.\(\)/);
  assert.match(dock,/ondblclick/);
  assert.match(dock,/oncontextmenu/);
  assert.match(dock,/onauxclick/);
  assert.match(css,/#app>#main-area\{min-width:0/);
  assert.match(css,/flex:0 0 min\(370px,34vw\)/);
  assert.match(css,/body.player-mode #soundshow-sounds-dock/);
});

test('SoundShow mini-player uses real timeline and media-controls commands',()=>{
  assert.equal(safeProgress(25,100),25);
  assert.equal(safeProgress(500,100),100);
  assert.equal(safeProgress(0,0),0);
  assert.equal(formatClock(125),'02:05');
  const player=fs.readFileSync(new URL('../src/soundshow/mini-player.mjs',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../src/soundshow/sounds-dock.css',import.meta.url),'utf8');
  const bridge=fs.readFileSync(new URL('../soundshow-bridge/bridge.py',import.meta.url),'utf8');
  const background=fs.readFileSync(new URL('../src/soundshow/owlbear.mjs',import.meta.url),'utf8');
  for(const cmd of ['toggle_player_playback','toggle_player_loop','stop_player','fade_out_player','seek_player','set_player_volume']){
    assert.ok(player.includes(cmd),cmd);
    assert.ok(bridge.includes(cmd),cmd);
  }
  assert.match(background,/seek_player/);
  assert.match(player,/forme réelle des échantillons n’est pas disponible/);
  assert.match(css,/\.ss-wave-canvas/);
  assert.match(css,/\.ss-player-volume/);
  assert.match(css,/\.ss-tile-name\{font-size:10\.5px/);
  assert.match(css,/grid-template-columns:repeat\(auto-fill,minmax\(72px,1fr\)\)/);
});
test('Linked cell media remains GM-side and is limited to valid loaded SoundShow assets',()=>{
  const catalog=[{id:'rain',kind:'sound',locked:false},{id:'trailer',kind:'video',locked:false},{id:'locked',kind:'sound',locked:true}];
  assert.deepEqual(safeCellAttachments([
    {id:'rain',action:'fade_in'}, {id:'trailer',action:'start'}, {id:'rain',action:'start'},
    {id:'locked',action:'start'}, {id:'missing',action:'start'}],catalog),[
    {id:'rain',kind:'sound',action:'fade_in'},
    {id:'trailer',kind:'video',action:'start'}]);
  const html=fs.readFileSync(new URL('../archives-app-v64-v55.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../src/soundshow/archives.mjs',import.meta.url),'utf8');
  assert.match(html,/getCellRevealMedia: function/);
  assert.match(html,/setCellRevealMedia: function/);
  assert.match(html,/archives:cell-revealed/);
  assert.match(html,/ctx-cell-media/);
  assert.match(html,/id="cell-media-editor"/);
  assert.match(app,/mountCellMedia/);
  const match=html.match(/var safeFields = \[([\s\S]*?)\];/);
  assert.ok(match);
  assert.doesNotMatch(match[1],/revealMedia/,'Cell media associations must never be projected to players');
});
test('Movable Archives docks retain the Owlbear header back button and offer fullscreen',()=>{
  const layout=fs.readFileSync(new URL('../src/v66/workspace.mjs',import.meta.url),'utf8');
  const host=fs.readFileSync(new URL('../archives-host-v55.html',import.meta.url),'utf8');
  assert.match(layout,/moveBar\('canvas-integrations-dock'/);
  assert.match(layout,/moveBar\('top-hud'/);
  assert.match(layout,/requestFullscreen/);
  assert.match(host,/allowfullscreen/);
  assert.doesNotMatch(host,/<strong><img src="\.\/icon-archives-v43\.svg"[^>]*>Les Archives de l.Imaginaire/);
  assert.match(host,/id="return"/);
});
