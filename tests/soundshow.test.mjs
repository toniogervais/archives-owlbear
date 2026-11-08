import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {decodeSession,encodeSession,validSession,publicPlayback} from '../src/soundshow/protocol.mjs';
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
