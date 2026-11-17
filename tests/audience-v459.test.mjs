import test from 'node:test';
import assert from 'node:assert/strict';
import {createSealedMessages} from '../src/v79/sealed-messages.mjs';
import {fileChunks,fileReceiver,digest,publicFile,validSharedFile} from '../src/v60/files.mjs';
import fs from 'node:fs';import vm from 'node:vm';

test('A selected recipient alone can decrypt a presentation over the Owlbear fallback',async()=>{
 const roles=new Map([['gm','GM'],['alix','PLAYER'],['noa','PLAYER']]),nodes=new Map(),wire=[],received=new Map();let pending=[];
 for(const [self,role]of roles){
  received.set(self,[]);
  nodes.set(self,createSealedMessages({self:()=>self,role:()=>role,authorize:async(id,expected)=>roles.get(id)===expected,
   send:async data=>{wire.push({from:self,data:structuredClone(data)});for(const [to,node]of nodes)if(to!==self){const next=Promise.resolve().then(()=>node.handle({connectionId:self,data:structuredClone(data)}));pending.push(next);}},
   onData:event=>received.get(self).push(event)}));
 }
 const drain=async()=>{while(pending.length){const current=pending;pending=[];await Promise.all(current);}};
 try{
  await Promise.all([...nodes.values()].map(node=>node.announce()));await drain();
  const secret={type:'show',id:crypto.randomUUID(),title:'INDICE_RÉSERVÉ_459',to:'alix'};
  await nodes.get('gm').send('alix',secret);await drain();
  assert.deepEqual(received.get('alix').map(e=>e.data),[secret]);assert.equal(received.get('noa').length,0);
  assert.ok(!JSON.stringify(wire).includes(secret.title),'room broadcasts contain no plaintext private title');
  const encrypted=wire.findLast(p=>p.data.type==='audience-sealed');
  await nodes.get('noa').handle({connectionId:'gm',data:{...encrypted.data,to:'noa'}});assert.equal(received.get('noa').length,0,'changing the destination cannot decrypt another player’s message');
  const bytes=new Uint8Array(6000);crypto.getRandomValues(bytes);
  const data={type:'data',id:crypto.randomUUID(),to:['alix'],chunk:btoa(String.fromCharCode(...bytes))};
  await nodes.get('gm').send('alix',data);await drain();assert.deepEqual(received.get('alix').at(-1).data,data);
  assert.ok(wire.filter(p=>p.data.type==='audience-sealed').every(p=>JSON.stringify(p.data).length<16000));
  roles.delete('alix');await assert.rejects(nodes.get('gm').send('alix',secret),/déconnecté/);
 }finally{for(const node of nodes.values())node.dispose();}
});

test('Encrypted transfers resume the exact original with their smaller packet size',async()=>{
 const bytes=new Uint8Array(61001);for(let i=0;i<bytes.length;i++)bytes[i]=(i*127)&255;
 const blob=new Blob([bytes],{type:'application/pdf'}),entry={id:crypto.randomUUID(),version:crypto.randomUUID(),title:'Document',mime:blob.type,size:blob.size,hash:await digest(blob),chunkBytes:6000};
 const publication=publicFile(entry),transfer=crypto.randomUUID(),receiver=fileReceiver(publication,validSharedFile,{transfer});let result;
 assert.equal(publication.chunkBytes,6000);
 for await(const part of fileChunks(blob,undefined,6000))if(part.index!==3)result=await receiver.push({...part,id:entry.id,version:entry.version,transfer});
 assert.deepEqual(receiver.missing(),[3]);
 for await(const part of fileChunks(blob,[3],6000))result=await receiver.push({...part,id:entry.id,version:entry.version,transfer});
 assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),bytes);
});

test('A selected presentation is excluded from the general public snapshot and same-device broadcast',()=>{
 const html=fs.readFileSync('archives-app-v64-v55.html','utf8'),start=html.indexOf('// BEGIN SECURITY: player projection V4.7'),end=html.indexOf('// END SECURITY: player projection V4.7',start);
 const projection=vm.runInNewContext(html.slice(start,end)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
 const image={id:crypto.randomUUID(),image:'data:image/png;base64,QUJD',published:true};
 const payload={boards:[{id:'a',nodes:[],links:[]}],playerPresentation:image,playerPresentationRecipients:['alix']};
 const publicView=projection(payload);assert.equal(publicView.playerPresentation,null);assert.ok(!JSON.stringify(publicView).includes('QUJD'));assert.ok(!Object.hasOwn(publicView,'playerPresentationRecipients'));
 const state={playerPresentation:image,playerPresentationRecipients:['alix']},helper=html.slice(html.indexOf('  function playerViewForPeer('),html.indexOf('  function saveState('));
 const forPeer=vm.runInNewContext(helper+'\nplayerViewForPeer;',{state,playerImageProjection:v=>v});
 assert.equal(forPeer(publicView,{peer:'alix'}).playerPresentation,image);assert.equal(forPeer(publicView,{peer:'noa'}).playerPresentation,null);
 assert.equal(projection({...payload,playerPresentationRecipients:undefined}).playerPresentation.image,image.image,'an explicitly all-player presentation is public');
});
