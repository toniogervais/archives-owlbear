import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {autoBackup} from '../src/v71/autosave.mjs';
const owner='11111111-1111-4111-8111-111111111111',player='33333333-3333-4333-8333-333333333333',campaign='22222222-2222-4222-8222-222222222222';
const hash='a'.repeat(64),parts=JSON.stringify([{bytes:4,hash}]);
test('PostgreSQL: selected and complete deletion retain a monotonic revision, queue actual Storage cleanup and reject stale writers and participants',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.campaigns(id uuid primary key,owner_id uuid not null,name text);
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id bigint generated always as identity,bucket_id text,name text,metadata jsonb);
   create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(regexp_replace(name,'/[^/]+$',''),'/')$$;
   grant usage on schema public,auth,storage to authenticated,anon;
   grant select on public.campaigns to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
   grant usage,select on sequence storage.objects_id_seq to authenticated;
   alter table public.campaigns enable row level security;
   create policy visible_campaigns on public.campaigns for select to authenticated using(true);
   alter table storage.objects enable row level security;
   insert into auth.users values('${owner}'),('${player}');
   insert into public.campaigns values('${campaign}','${owner}','Campagne privée');
  `);
  const old=await readFile(new URL('../sql/archives-cloud-backups-v446.sql',import.meta.url),'utf8');await db.exec(old);
  async function as(user,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role '+role)}
  const id=n=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0'),path=n=>owner+'/'+campaign+'/'+id(n)+'/0';
  async function object(n){await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['archives-campaign-backups',path(n),'{"size":4}'])}
  async function commit(n,revision){return (await db.query('select public.archives_commit_backup($1,$2,$3,$4,$5,$6,$7) as v',[campaign,id(n),revision,parts,hash,hash,'{"cells":1}'])).rows[0].v}
  async function rpc(name,args=[campaign]){const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query('select public.'+name+'('+placeholders+') as v',args)).rows[0].v}
  await as(owner);await object(1);await commit(1,0);
  await db.exec('reset role');const upgrade=await readFile(new URL('../sql/archives-cloud-backups-v448.sql',import.meta.url),'utf8');await db.exec(upgrade);await db.exec(upgrade);
  await as(owner);assert.equal((await rpc('archives_backup_catalog')).revision,1,'upgrade seeds the existing campaign revision');
  await object(2);await commit(2,1);await object(3);await commit(3,2);
  let result=await rpc('archives_delete_backups',[campaign,[id(1)],3]);
  assert.equal(result.deleted.length,1);assert.equal(result.latest_deleted,false);assert.equal(result.catalog.revision,4);assert.equal(result.catalog.backups.length,2);
  assert.deepEqual((await rpc('archives_pending_backup_cleanup'))[0].paths,[path(1)]);
  assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,3,'metadata deletion alone does not pretend Storage bytes were removed');
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path(1)])).rows.length,1,'Storage can now remove the selected bytes');
  await rpc('archives_finish_backup_cleanup',[campaign,[id(1)]]);assert.equal((await rpc('archives_pending_backup_cleanup')).length,0);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path(2)])).rows.length,0,'unselected backups remain protected');
  await object(4);await assert.rejects(commit(4,3),/ARCHIVES_BACKUP_CONFLICT/,'an upload in flight cannot reappear after deletion');
  result=await rpc('archives_delete_backups',[campaign,[id(3)],4]);assert.equal(result.latest_deleted,true);assert.equal(result.catalog.revision,5);
  result=await rpc('archives_delete_backups',[campaign,[id(2)],5]);assert.equal(result.catalog.backups.length,0);assert.equal(result.catalog.revision,6);
  await assert.rejects(commit(4,0),/ARCHIVES_BACKUP_CONFLICT/);await assert.rejects(commit(4,2),/ARCHIVES_BACKUP_CONFLICT/);
  await as(player);
  for(const [fn,args] of [['archives_backup_catalog',[campaign]],['archives_delete_backups',[campaign,[id(2)],6]],['archives_pending_backup_cleanup',[campaign]],['archives_finish_backup_cleanup',[campaign,[id(2)]]]])await assert.rejects(rpc(fn,args),/inaccessible/);
  await assert.rejects(db.query('select * from public.archives_backup_heads'),/permission denied/);
  await assert.rejects(db.query('select * from public.archives_backup_cleanup'),/permission denied/);
  await as('', 'anon');await assert.rejects(rpc('archives_delete_backups',[campaign,[id(2)],6]),/permission denied/);
  await db.exec('reset role');await db.exec(upgrade);await as(owner);assert.equal((await rpc('archives_backup_catalog')).revision,6,'running setup again never resets a deleted history');
  const saved=await commit(4,6);assert.equal(saved.backup.revision,7,'explicit reactivation can create a fresh backup after full deletion');
  for(let n=5;n<=15;n++){await object(n);await commit(n,n+2)}
  const catalog=await rpc('archives_backup_catalog');assert.equal(catalog.backups.length,10);assert.ok(catalog.cleanup_pending>0,'automatic retention also queues reclaimable Storage bytes');
  await db.exec('reset role');assert.equal((await db.query("select public from storage.buckets where id='archives-campaign-backups'")).rows[0].public,false);
 }finally{await db.close()}
});
test('The current device keeps autosave for an older deletion and suspends after deleting its latest copy',async()=>{
 let binding={enabled:true,campaignId:campaign,owner,project:'https://archives.supabase.co',revision:5,fingerprint:hash,savedAt:'2026-11-12T15:00:00Z'},saves=0;
 const engine=autoBackup({cloud:{context:async()=>({user:{id:owner},project:binding.project}),versions:async()=>({rows:[],revision:binding.revision}),save:()=>{saves++;throw Error('unexpected')}},capture:async()=>({fingerprint:hash}),read:()=>binding,write:value=>{binding=value}});
 engine.removed({campaignId:campaign,owner,project:binding.project,previousRevision:5,revision:6,latestDeleted:false});
 assert.equal(binding.enabled,true);assert.equal(binding.revision,6);assert.equal(binding.fingerprint,hash);
 engine.removed({campaignId:campaign,owner,project:binding.project,previousRevision:6,revision:7,latestDeleted:true});
 await engine.save();assert.equal(saves,0);assert.equal(binding.enabled,false);assert.equal(binding.fingerprint,null);assert.equal(binding.savedAt,null);engine.dispose();
});
