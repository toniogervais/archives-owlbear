import test from 'node:test';
import assert from 'node:assert/strict';
import {autoBackup} from '../src/v71/autosave.mjs';
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),project='https://archives.supabase.co',savedAt='2026-11-16T12:00:00Z';
function fixture({local=B,head=A,remote=4,revision=3,enabled=false,empty=false}={}){
 let binding={campaignId:'campaign',owner:'owner',project,revision,fingerprint:A,savedAt,enabled},writes=[];
 const cloud={context:async()=>({user:{id:'owner'},project}),versions:async()=>({revision:remote,rows:empty?[]:[{revision:remote,fingerprint:head,created_at:savedAt}]}),
  save:async input=>{writes.push(input);return {revision:input.expectedRevision+1,created_at:savedAt}}};
 const engine=autoBackup({cloud,capture:async()=>({fingerprint:local,blob:new Blob(['complete session']),summary:{cells:3,images:2}}),read:()=>binding,write:b=>binding=b});
 return {engine,cloud,writes,binding:()=>binding};
}
test('A catalogue advance over the same remote base is repaired before a manual save, preserving CAS and manual mode',async()=>{
 const f=fixture();const result=await f.engine.manualSave();assert.equal(result.state,'saved');assert.equal(f.writes.length,1);assert.equal(f.writes[0].expectedRevision,4);assert.equal(f.binding().revision,5);assert.equal(f.binding().fingerprint,B);assert.equal(f.binding().enabled,false);f.engine.dispose();
});
test('An already committed identical full archive acknowledges the remote version without uploading another copy',async()=>{
 const f=fixture({head:B});assert.equal((await f.engine.manualSave()).state,'saved');assert.equal(f.writes.length,0);assert.equal(f.binding().revision,4);assert.equal(f.binding().fingerprint,B);f.engine.dispose();
});
test('A conflict stops automatic writes but a later deliberate manual retry can recognize a successful commit',async()=>{
 const f=fixture({head:C,enabled:true});f.cloud.save=async()=>{const e=Error('conflict');e.code='CONFLICT';throw e};
 assert.equal((await f.engine.save()).state,'conflict');f.cloud.versions=async()=>({revision:5,rows:[{revision:5,fingerprint:B,created_at:savedAt}]});
 assert.equal((await f.engine.manualSave()).state,'saved');assert.equal(f.binding().revision,5);assert.equal(f.binding().fingerprint,B);f.engine.dispose();
});
test('Different remote contents stay protected on every manual retry',async()=>{
 const f=fixture({head:C});for(let n=0;n<2;n++)assert.equal((await f.engine.manualSave()).state,'conflict');assert.equal(f.writes.length,0);assert.equal(f.binding().revision,3);assert.equal(f.binding().fingerprint,A);f.engine.dispose();
});
test('A deliberate manual save after all versions were deleted writes against the monotonic catalogue revision',async()=>{
 const f=fixture({empty:true,remote:8,local:A});assert.equal((await f.engine.manualSave()).state,'saved');assert.equal(f.writes.length,1);assert.equal(f.writes[0].expectedRevision,8);assert.equal(f.binding().revision,9);f.engine.dispose();
});
test('A racing writer or account change cannot bypass the conflict check',async()=>{
 const f=fixture();f.cloud.save=async input=>{assert.equal(input.expectedRevision,4);const e=Error('racing writer');e.code='CONFLICT';throw e};
 assert.equal((await f.engine.manualSave()).state,'conflict');f.cloud.context=async()=>({user:{id:'someone-else'},project});assert.equal((await f.engine.manualSave()).state,'error');assert.equal(f.binding().fingerprint,A);f.engine.dispose();
});
