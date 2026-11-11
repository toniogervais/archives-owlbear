import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundShowConnection} from '../src/soundshow/connection.mjs';

class Events {
  constructor(){this.listeners=new Map();}
  on(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);return this;}
  emit(type,value){for(const fn of this.listeners.get(type)||[])fn(value);}
}
class VideoTrack extends EventTarget {
  constructor(muted=false){super();this.muted=muted;this.readyState='live';}
  setMuted(value){this.muted=value;this.dispatchEvent(new Event(value?'mute':'unmute'));}
  end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
}
const session={version:1,peer:'host-recovery-1234',secret:'a'.repeat(64)};
const active={type:'playback',active:true,id:'cue-recovery-1234',playing:true,muted:false,volume:1};
async function fixture(t,mode='view'){
  const peers=[],statuses=[],streams=[];
  const previous={window:globalThis.window,Peer:globalThis.Peer,document:globalThis.document};
  class Peer extends Events {
    constructor(){super();peers.push(this);}
    connect(){const data=new Events();data.open=false;data.sent=[];data.send=value=>data.sent.push(value);this.data=data;return data;}
    destroy(){this.destroyed=true;if(this.data)this.data.open=false;}
  }
  globalThis.Peer=Peer;globalThis.window={Peer};globalThis.document={hidden:false};
  t.mock.timers.enable({apis:['setTimeout']});
  const connection=new SoundShowConnection({mode,onStatus:value=>statuses.push(value),onStream:value=>streams.push(value)});
  t.after(()=>{connection.stop();t.mock.timers.reset();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  async function handshake(){
    await Promise.resolve();await Promise.resolve();
    const peer=peers.at(-1);peer.emit('open');peer.data.open=true;peer.data.emit('open');
    peer.data.emit('data',{type:'welcome',session:'nonce-recovery-1234'});return peer;
  }
  function media(peer,track=new VideoTrack()){
    const call=new Events();call.peer=session.peer;call.metadata={session:'nonce-recovery-1234'};
    const stream={getVideoTracks:()=>[track]};
    call.close=()=>call.emit('close');call.answer=()=>call.emit('stream',stream);
    peer.emit('call',call);return {call,track,stream};
  }
  await connection.use(session);const peer=await handshake();
  return {connection,peer,peers,statuses,streams,handshake,media,tick:ms=>t.mock.timers.tick(ms)};
}

test('Repeated playback snapshots cannot postpone recovery of an absent video stream',async t=>{
  const f=await fixture(t);f.peer.data.emit('data',active);f.tick(6000);
  f.peer.data.emit('data',active);f.tick(6000);
  assert.equal(f.peer.destroyed,true);assert.match(f.statuses.at(-1),/Liaison vidéo interrompue/);
  f.tick(2000);await f.handshake();assert.equal(f.peers.length,2);
});

test('A stream waiting for packets is recovered; live packets cancel the watchdog',async t=>{
  const f=await fixture(t);f.peer.data.emit('data',active);
  const {track}=f.media(f.peer,new VideoTrack(true));f.tick(6000);track.setMuted(false);f.tick(20000);
  assert.equal(f.peers.length,1);assert.notEqual(f.peer.destroyed,true);
  track.end();f.tick(12000);assert.equal(f.peer.destroyed,true);
});

test('Normal pause or stop never restarts a receiver when its media call closes',async t=>{
  const f=await fixture(t);f.peer.data.emit('data',active);const {call}=f.media(f.peer);
  call.close();f.peer.data.emit('data',{...active,playing:false});f.tick(20000);
  assert.notEqual(f.peer.destroyed,true);
  f.peer.data.emit('data',{type:'playback',active:false});f.tick(20000);assert.equal(f.peers.length,1);
});

test('Replacing a call ignores its old stream events; a real call error reconnects',async t=>{
  const f=await fixture(t);f.peer.data.emit('data',active);const old=f.media(f.peer);
  const current=f.media(f.peer);old.call.emit('stream',old.stream);old.track.setMuted(true);f.tick(20000);
  assert.equal(f.streams.at(-1),current.stream);assert.notEqual(f.peer.destroyed,true);
  current.call.emit('error',Error('lost media'));assert.equal(f.peer.destroyed,true);
  f.tick(2000);await f.handshake();assert.equal(f.peers.length,2);
});

test('Hidden tabs and watch-only connections do not trigger false media reconnections',async t=>{
  const f=await fixture(t);f.peer.data.emit('data',active);globalThis.document.hidden=true;f.tick(20000);
  assert.notEqual(f.peer.destroyed,true);
  globalThis.document.hidden=false;f.connection.resume();f.tick(12000);assert.equal(f.peer.destroyed,true);
});

test('A background watcher needs no media stream',async t=>{
  const f=await fixture(t,'watch');f.peer.data.emit('data',active);f.tick(60000);
  assert.notEqual(f.peer.destroyed,true);assert.equal(f.peers.length,1);
});

test('A connected data channel cannot reset the six-attempt media recovery limit',async t=>{
  const f=await fixture(t);
  for(let attempt=1;attempt<=7;attempt++){
    f.peers.at(-1).data.emit('data',active);f.tick(12000);
    if(attempt<=6){f.tick(Math.min(1000*2**attempt,15000));await f.handshake();}
  }
  assert.match(f.statuses.at(-1),/Connexion impossible après plusieurs essais/);
  const count=f.peers.length;f.tick(120000);assert.equal(f.peers.length,count);
  f.connection.resume();await f.handshake();assert.equal(f.peers.length,count+1);
});
