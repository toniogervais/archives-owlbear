import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {packBackup,inspectBackup,maxBackupBytes} from '../src/v63/backup.mjs';
import {digest} from '../src/v72/integrity.mjs';
import {createCloud} from '../src/v71/cloud.mjs';
const scenario={boards:[{id:'act',name:'ACTE_PRIVE',nodes:[],links:[]}],activeBoardId:'act'};
const sha=value=>createHash('sha256').update(value).digest('hex');
test('Incremental SHA-256 matches WebCrypto vectors across unaligned chunks without reading a large Blob at once',async()=>{
 const bytes=Buffer.alloc(9*1024*1024+37,0x8d);bytes[4194303]=7;bytes[4194304]=8;
 class SlicedBlob extends Blob{arrayBuffer(){throw Error('Full archive allocation forbidden')}}
 assert.equal(await digest(new SlicedBlob([bytes])),sha(bytes));assert.equal(await digest(new Uint8Array()),sha(''));
});
test('A campaign and its library round-trip more than 64 MiB of original image bytes, with deduplication and a small metadata index',async()=>{
 const images=Array.from({length:8},(_,i)=>{const bytes=Buffer.alloc(9*1024*1024,i+1);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);return {id:'image-'+i,name:'Original '+i,category:'personnage',data:'data:image/png;base64,'+bytes.toString('base64')}});
 const input={...scenario,boards:[{...scenario.boards[0],nodes:images.map((img,i)=>({id:'n'+i,title:'Cellule '+i,bgImg:img.data,revealed:false,gmDetails:[{id:'private',title:'Secret',text:'INFORMATION_MJ'}]}))}]};
 const result=await packBackup({scenario:input,images,files:[],presets:[]});assert.ok(result.blob.size>64*1024*1024);assert.ok(result.blob.size<73*1024*1024,'same originals must not be stored twice');assert.equal(maxBackupBytes,2*1024*1024*1024);
 const start=new TextEncoder().encode('ARCHIVES-CAMPAGNE/1\n').length,head=new Uint8Array(await result.blob.slice(0,start+36).arrayBuffer());
 const size=new DataView(head.buffer).getUint32(start,true);assert.ok(size<20000,'images no longer occupy the JSON index');
 const owner='11111111-1111-4111-8111-111111111111',campaign='22222222-2222-4222-8222-222222222222',objects=new Map();let row;
 const client={supabaseUrl:'https://fixture.supabase.co',auth:{getUser:async()=>({data:{user:{id:owner}}})},from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:campaign,owner_id:owner}})};return q},storage:{from:()=>({upload:async(path,blob)=>{objects.set(path,blob);return {data:{path}}},download:async path=>({data:objects.get(path)})})},rpc:async(name,args)=>{
   if(name==='archives_backup_catalog')return {data:{max_bytes:2147483648,revision:row?1:0,backups:row?[row]:[]}};
   if(name==='archives_pending_backup_cleanup')return {data:[]};
   assert.equal(name,'archives_commit_backup');row={id:args.p_id,owner_id:owner,campaign_id:campaign,revision:1,sha256:args.p_sha256,fingerprint:args.p_fingerprint,byte_size:args.p_parts.reduce((n,p)=>n+p.bytes,0),parts:args.p_parts};return {data:{backup:row,removed:[]}};
 }};
 const cloud=createCloud(()=>client);await cloud.save({campaignId:campaign,expectedRevision:0,...result});assert.ok(row.parts.length>16,'large archives upload in independent 4 MiB parts');
 const downloaded=await cloud.download(campaign,row.id);assert.equal(downloaded.blob.size,result.blob.size);
 const restored=await inspectBackup(downloaded.blob);
 for(let i=0;i<images.length;i++){assert.equal(restored.images[i].data,images[i].data);assert.equal(restored.scenario.boards[0].nodes[i].bgImg,images[i].data)}
 assert.equal(restored.scenario.boards[0].nodes[0].gmDetails[0].text,'INFORMATION_MJ');
 const damaged=new Uint8Array(await result.blob.slice(-20).arrayBuffer());damaged[0]^=1;
 await assert.rejects(inspectBackup(new Blob([result.blob.slice(0,-20),damaged])),/endommagé/);
});
test('Existing schema 1 archives remain readable, including original inline image library data',async()=>{
 const manifest={format:'archives-campagne',schema:1,created:'2026-11-12T15:00:00Z',scenario,images:[{id:'img',name:'Ancien portrait',category:'lieu',data:'data:image/png;base64,aGVsbG8='}],files:[],presets:[],subcategories:{}};
 const header=new TextEncoder().encode(JSON.stringify(manifest)),length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,header.length,true);
 const original=new Blob(['ARCHIVES-CAMPAGNE/1\n',length,Buffer.from(sha(header),'hex'),header]);
 const restored=await inspectBackup(original);assert.equal(restored.images[0].data,manifest.images[0].data);assert.deepEqual(restored.scenario,scenario);
});

test('Editing a canvas while its binary assets are being packed cannot alter the captured scenario',async()=>{
 const current={...scenario,boards:[{...scenario.boards[0],nodes:[{id:'n',title:'Avant',bgImg:'data:image/png;base64,aGVsbG8=',gmDetails:[{title:'Voix',text:'Grave'}]}]}]};
 const promise=packBackup({scenario:current,images:[],files:[],presets:[]});current.boards[0].nodes[0].title='Après';current.boards[0].nodes[0].gmDetails[0].text='Aiguë';
 const restored=await inspectBackup((await promise).blob);assert.equal(restored.scenario.boards[0].nodes[0].title,'Avant');assert.equal(restored.scenario.boards[0].nodes[0].gmDetails[0].text,'Grave');
});
