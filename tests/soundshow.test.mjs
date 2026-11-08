import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {decodeSession,encodeSession,validSession,publicPlayback,autoLinkProtocol,owlbearLinkProtocol,validLocalBridgeOrigin} from '../src/soundshow/protocol.mjs';
import {explainConnectionFailure} from '../src/soundshow/connection.mjs';
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
