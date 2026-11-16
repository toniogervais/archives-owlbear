import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectFiles} from '../src/v76/direct-files.mjs';
const session='11111111-1111-4111-8111-111111111111';
class Peer extends EventTarget{
 constructor(){super();this.iceGatheringState='complete';this.connectionState='new';this.remote=null}
 async setRemoteDescription(value){this.remote=value}
 async setLocalDescription(value){this.localDescription=value}
 async createAnswer(){return {type:'answer',sdp:'v=0\r\n'}}
 close(){this.connectionState='closed';this.dispatchEvent(new Event('connectionstatechange'))}
}
class Channel extends EventTarget{
 constructor(){super();this.label='archives-original-files-v1';this.readyState='open';this.bufferedAmount=0;this.sent=[]}
 send(data){this.sent.push(JSON.parse(data))}
 close(){this.readyState='closed';this.dispatchEvent(new Event('close'))}
}
function setup(){
 const peers=[],signals=[],received=[];
 const transport=createDirectFiles({self:()=> 'gm',role:()=> 'GM',authorize:async(id,role)=>id==='player'&&role==='PLAYER',signal:async value=>signals.push(value),onData:value=>received.push(value),makePeer:()=>{const p=new Peer();peers.push(p);return p}});
 const offer=(remote='player',overrides={})=>transport.handle({connectionId:remote,data:{type:'direct-offer',id:session,to:'gm',description:{type:'offer',sdp:'v=0\r\n'},...overrides}});
 const attach=()=>{const c=new Channel(),event=new Event('datachannel');event.channel=c;peers[0].dispatchEvent(event);c.dispatchEvent(new Event('open'));return c};
 return {transport,peers,signals,received,offer,attach};
}
test('Only an authenticated player can negotiate a direct file channel with this GM',async()=>{
 const h=setup();try{
  await h.offer('stranger');await h.offer('player',{to:'another-gm'});await h.offer('player',{id:'not-a-session'});await h.offer('player',{description:{type:'offer',sdp:'x'.repeat(12001)}});assert.equal(h.peers.length,0);
  await h.offer();assert.equal(h.peers.length,1);assert.equal(h.signals.length,1);assert.equal(h.signals[0].type,'direct-answer');assert.equal(h.signals[0].to,'player');assert.equal(h.signals[0].id,session);
 }finally{h.transport.dispose()}
});
test('Direct files respect receiver backpressure and fall back when a channel is lost',async()=>{
 const h=setup();try{
  await h.offer();const c=h.attach();c.bufferedAmount=300000;
  const pending=h.transport.send('player',{type:'data',chunk:'aGVsbG8='});await Promise.resolve();assert.equal(c.sent.length,0);
  c.bufferedAmount=0;c.dispatchEvent(new Event('bufferedamountlow'));assert.equal(await pending,true);assert.equal(c.sent[0].chunk,'aGVsbG8=');
  c.close();assert.equal(await h.transport.send('player',{type:'data'}),false,'the caller can resume missing parts with the relay');
 }finally{h.transport.dispose()}
});
test('The direct channel admits only bounded file protocol messages and keeps sender identity',async()=>{
 const h=setup();try{
  await h.offer();const c=h.attach();const message=data=>{const e=new Event('message');e.data=data;c.dispatchEvent(e)};
  message(JSON.stringify({type:'published',privateCampaign:'not a file'}));message('x'.repeat(16001));message('bad json');assert.equal(h.received.length,0);
  const data={type:'request',id:session,missing:[2]};message(JSON.stringify(data));assert.deepEqual(h.received,[{connectionId:'player',data}]);
  h.transport.dispose();message(JSON.stringify(data));assert.equal(h.received.length,1);
 }finally{h.transport.dispose()}
});
