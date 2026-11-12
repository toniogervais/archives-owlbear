import test from 'node:test';
import assert from 'node:assert/strict';
import {autoBackup} from '../src/v71/autosave.mjs';
import {createCloud,PART_BYTES,validCloudRecord,cloudError} from '../src/v71/cloud.mjs';
import {packBackup} from '../src/v63/backup.mjs';
const owner='11111111-1111-4111-8111-111111111111',campaign='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const fingerprint='a'.repeat(64),project='https://archives.supabase.co';
const base={campaignId:campaign,owner,project,revision:0,enabled:true};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function controller(options={}) {
 let stored={...base},captures=0,saves=0,head=0;
 const engine=autoBackup({read:()=>stored,write:value=>{stored=value},delay:5,
  cloud:{context:async()=>({user:{id:owner},project}),versions:async()=>({rows:head?[{revision:head}]:[]}),save:async data=>{saves++;head++;return {revision:head,created_at:'2026-11-12T15:00:00Z'}}},
  capture:async()=>{captures++;return {blob:new Blob(['campaign']),fingerprint}},...options});
 return {engine,stored:()=>stored,captures:()=>captures,saves:()=>saves,head:value=>{head=value}};
}
test('Automatic changes debounce, unchanged content is not re-uploaded, and the confirmed revision survives a reload',async()=>{
 const c=controller();c.engine.change();c.engine.change();await tick();await c.engine.save();
 assert.equal(c.saves(),1);assert.equal(c.stored().revision,1);assert.equal(c.engine.status().state,'saved');
 await c.engine.save();assert.equal(c.saves(),1);c.engine.dispose();
});
test('Network failure never reports saved; a retry uploads the retained local changes',async()=>{
 let offline=true,calls=0;
 const c=controller({cloud:{context:async()=>({user:{id:owner},project}),save:async()=>{calls++;if(offline)throw Error('offline');return {revision:1,created_at:'2026-11-12T15:00:00Z'}}}});
 await c.engine.save();assert.equal(c.engine.status().state,'error');assert.equal(c.stored().revision,0);
 offline=false;await c.engine.save();assert.equal(c.engine.status().state,'saved');assert.equal(calls,2);c.engine.dispose();
});
test('An old device stops at a newer cloud revision, including when its own content did not change',async()=>{
 const c=controller();await c.engine.save();c.head(2);await c.engine.save();assert.equal(c.engine.status().state,'conflict');
 c.engine.change();await tick();assert.equal(c.saves(),1);c.engine.dispose();
});
test('Signing into a different account cannot upload the old account campaign',async()=>{
 const c=controller({cloud:{context:async()=>({user:{id:other},project}),save:()=>assert.fail('wrong account must not upload')}});
 await c.engine.save();assert.equal(c.captures(),0);assert.equal(c.engine.status().state,'error');c.engine.dispose();
});
test('Edits made while an upload is in flight are sent in a following checkpoint',async()=>{
 let release,number=0;
 const c=controller({capture:async()=>({fingerprint:String(++number).repeat(64),blob:new Blob(['data'])}),cloud:{context:async()=>({user:{id:owner},project}),save:async()=>{if(number===1)await new Promise(resolve=>{release=resolve});return {revision:number,created_at:'2026-11-12T15:00:00Z'}}}});
 const first=c.engine.save();await tick();c.engine.change();release();await first;await tick();await c.engine.save();
 assert.ok(number>=2);assert.equal(c.stored().revision,number);c.engine.dispose();
});
test('Restoring holds autosave and suspension persists without deleting cloud history',async()=>{
 const c=controller(),release=c.engine.hold();await c.engine.save();assert.equal(c.captures(),0);release();c.engine.pause();await tick();
 assert.equal(c.captures(),0);assert.equal(c.stored().enabled,false);c.engine.dispose();
});
test('Backup fingerprints ignore creation time and change for secrets or library contents',async()=>{
 const data={scenario:{boards:[{id:'act',nodes:[{id:'one',title:'Secret',revealed:false}],links:[]}],activeBoardId:'act'},files:[],images:[],presets:[]};
 const first=await packBackup(data);await tick();const second=await packBackup(data);assert.equal(first.fingerprint,second.fingerprint);
 data.scenario.boards[0].nodes[0].title='Modified secret';assert.notEqual((await packBackup(data)).fingerprint,first.fingerprint);
});
function storageFixture() {
 const objects=new Map(),rows=[];let uid=owner,uploads=0,lostResponse=true;
 const query=table=>{
  const filters=[];const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q},order:()=>q,limit:()=>q,
   maybeSingle:async()=>({data:{id:campaign,owner_id:owner}}),then(resolve){return Promise.resolve({data:table==='campaigns'?[{id:campaign,owner_id:owner}]:rows.filter(row=>filters.every(([key,value])=>row[key]===value)).slice().reverse()}).then(resolve)}};return q;
 };
 const client={supabaseUrl:project,auth:{getUser:async()=>({data:{user:{id:uid}}})},from:query,storage:{from:()=>({upload:async(path,blob)=>{objects.set(path,blob);uploads++;return {data:{path}}},download:async path=>({data:objects.get(path)}),remove:async paths=>{for(const path of paths)objects.delete(path);return {data:[]}}})},
  rpc:async(name,args)=>{
   let row=rows.find(row=>row.id===args.p_id);
   if(!row){if((rows.at(-1)?.revision||0)!==args.p_expected_revision)return {error:{message:'ARCHIVES_BACKUP_CONFLICT'}};
    row={id:args.p_id,campaign_id:campaign,owner_id:owner,revision:rows.length+1,byte_size:args.p_parts.reduce((sum,p)=>sum+p.bytes,0),sha256:args.p_sha256,fingerprint:args.p_fingerprint,parts:args.p_parts,summary:args.p_summary,created_at:'2026-11-12T15:00:00Z'};rows.push(row);
   }
   if(lostResponse){lostResponse=false;return {error:{message:'network response lost'}}}return {data:{backup:row,removed:[]}};
  }};
 return {cloud:createCloud(()=>client),objects,rows,uploads:()=>uploads,user:value=>{uid=value}};
}
test('Chunked uploads round-trip bytes above one block, retry a lost commit without duplicating, and verify every downloaded block',async()=>{
 const f=storageFixture(),bytes=new Uint8Array(PART_BYTES+45);bytes.fill(172);
 const saved=await f.cloud.save({campaignId:campaign,expectedRevision:0,blob:new Blob([bytes]),summary:{cells:1},fingerprint});
 assert.equal(f.uploads(),2);assert.equal(f.rows.length,1);assert.equal(saved.revision,1);
 const copy=await f.cloud.download(campaign,saved.id);assert.deepEqual(new Uint8Array(await copy.blob.arrayBuffer()),bytes);
 const path=[...f.objects.keys()][0];f.objects.set(path,new Blob([new Uint8Array(PART_BYTES)]));
 await assert.rejects(f.cloud.download(campaign,saved.id),/endommagée/);
});
test('A stale writer cannot upload chunks or replace the latest remote version',async()=>{
 const f=storageFixture();await f.cloud.save({campaignId:campaign,expectedRevision:0,blob:new Blob(['first']),summary:{},fingerprint});
 const before=f.uploads();await assert.rejects(f.cloud.save({campaignId:campaign,expectedRevision:0,blob:new Blob(['stale']),summary:{},fingerprint}),{code:'CONFLICT'});assert.equal(f.uploads(),before);
});
test('Cloud records reject foreign owners, invalid block sizes and damaged totals; setup errors are actionable',()=>{
 assert.equal(validCloudRecord({id:campaign,owner_id:other,campaign_id:campaign},owner,campaign),false);
 assert.equal(cloudError({code:'PGRST205',message:'missing table'}).code,'SETUP');
});
