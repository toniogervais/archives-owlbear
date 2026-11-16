import test from 'node:test';import assert from 'node:assert/strict';
import {fileChunks,fileReceiver,validSharedFile,digest,chunkBytes,publicFile} from '../src/v60/files.mjs';
import {autoBackup} from '../src/v71/autosave.mjs';
import {packBackup,inspectBackup} from '../src/v63/backup.mjs';
import fs from 'node:fs';import vm from 'node:vm';
test('A large original resumes missing windows after packet loss at 25%, preserving prior progress and every byte',async()=>{
 const bytes=new Uint8Array(9*1024*1024+31);for(let i=0;i<bytes.length;i++)bytes[i]=(i*97+(i>>>7))&255;
 const blob=new Blob([bytes],{type:'image/png'}),publication={id:crypto.randomUUID(),version:crypto.randomUUID(),title:'Image partagée',mime:blob.type,size:blob.size,hash:await digest(blob),transferMode:'window-v1'},transfer=crypto.randomUUID(),receiver=fileReceiver(publication,validSharedFile,{transfer});
 let result,round=0,previous=0;const lost=new Set();
 while(!result?.blob){
  const missing=receiver.missing(16);assert.ok(missing.length>0&&missing.length<=16);round++;
  for await(const part of fileChunks(blob,missing.slice().reverse())){
   if(part.index>Math.floor(bytes.length/chunkBytes/4)&&part.index%3===0&&!lost.has(part.index)){lost.add(part.index);continue}
   const next=await receiver.push({...part,id:publication.id,version:publication.version,transfer});if(next)result=next;
  }
  const progress=receiver.progress();assert.ok(progress>=previous,'a retry never discards received blocks');previous=progress;assert.ok(round<300);
 }
 assert.ok(lost.size>50);assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),bytes);assert.equal(publicFile(publication).transferMode,'window-v1');
});
test('Manual backup stays manual and selecting a restored version never creates a new checkpoint',async()=>{
 let uploads=0,captures=0,stored;const engine=autoBackup({cloud:{context:async()=>({user:{id:'owner'},project:'project'}),save:async()=>({revision:++uploads}),versions:async()=>({revision:uploads,rows:[]})},capture:async()=>{captures++;return {fingerprint:'x'}},read:()=>null,write:v=>stored=v,delay:5});
 await engine.bind({owner:'owner',project:'project',campaignId:'campaign',revision:0},{automatic:false});assert.equal(uploads,1);assert.equal(stored.enabled,false);
 engine.change();await new Promise(r=>setTimeout(r,15));await engine.save();assert.equal(captures,1);
 await engine.bind({...stored,fingerprint:null},{automatic:false,save:false});assert.equal(uploads,1);
 await engine.manualSave();assert.equal(uploads,2);assert.equal(stored.enabled,false);engine.dispose();
});
test('A revealed cell retains its private MJ description in backups and never in a player projection',async()=>{
 const scenario={activeBoardId:'a',boards:[{id:'a',nodes:[{id:'n',title:'Visible',category:'lieu',revealed:true,desc:'Description publique',gmDescription:'DESCRIPTION_MJ_SECRETE_453',clues:[]}],links:[]}]};
 const html=fs.readFileSync('archives-app-v64-v55.html','utf8'),start=html.indexOf('// BEGIN SECURITY: player projection V4.7'),end=html.indexOf('// END SECURITY: player projection V4.7',start),project=vm.runInNewContext(html.slice(start,end)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
 const publicView=project(scenario);assert.equal(publicView.boards[0].nodes[0].desc,'Description publique');assert.ok(!JSON.stringify(publicView).includes('DESCRIPTION_MJ_SECRETE_453'));
 const result=await packBackup({scenario,images:[],files:[],presets:[]}),restored=await inspectBackup(result.blob);assert.equal(restored.scenario.boards[0].nodes[0].gmDescription,'DESCRIPTION_MJ_SECRETE_453');
});
