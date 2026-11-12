import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',player='33333333-3333-4333-8333-333333333333',campaign='22222222-2222-4222-8222-222222222222';
const hash='a'.repeat(64),parts=JSON.stringify([{bytes:4,hash}]);
test('Real PostgreSQL: owner-only storage/RLS, atomic conflicts, idempotent retry, ten retained copies and protected committed bytes',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.campaigns(id uuid primary key,owner_id uuid not null,name text);
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id bigint generated always as identity,bucket_id text,name text,metadata jsonb);
   create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(regexp_replace(name,'/[^/]+$',''),'/')$$;
   grant usage on schema public,auth,storage to authenticated,anon;
   grant select on public.campaigns to authenticated;
   grant select,insert,update,delete on storage.objects to authenticated;
   grant usage,select on sequence storage.objects_id_seq to authenticated;
   alter table public.campaigns enable row level security;
   create policy visible_campaigns on public.campaigns for select to authenticated using(true);
   alter table storage.objects enable row level security;
   insert into auth.users values('${owner}'),('${player}');
   insert into public.campaigns values('${campaign}','${owner}','Campagne privée');
  `);
  const migration=await readFile(new URL('../sql/archives-cloud-backups-v446.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration); // activation may safely be repeated
  async function as(user,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role '+role)}
  const path=id=>owner+'/'+campaign+'/'+id+'/0';
  async function object(id){await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['archives-campaign-backups',path(id),JSON.stringify({size:4})])}
  async function commit(id,revision){return (await db.query('select public.archives_commit_backup($1,$2,$3,$4,$5,$6,$7) as result',[campaign,id,revision,parts,hash,hash,'{"cells":1}'])).rows[0].result}
  const first='44444444-4444-4444-8444-444444444444';
  await as(owner);await object(first);
  const saved=await commit(first,0);assert.equal(saved.backup.revision,1);
  assert.equal((await commit(first,0)).backup.id,first,'lost-response retry is idempotent');
  await assert.rejects(commit('55555555-5555-4555-8555-555555555555',0),/ARCHIVES_BACKUP_CONFLICT/);
  await assert.rejects(commit('55555555-5555-4555-8555-555555555555',1),/Bloc manquant/);
  assert.equal((await db.query('select count(*)::int as n from public.archives_campaign_backups')).rows[0].n,1);
  // Authenticated direct writes cannot bypass the compare-and-publish function.
  await assert.rejects(db.query('delete from public.archives_campaign_backups'),/permission denied/);
  const blockedDelete=await db.query('delete from storage.objects where name=$1 returning name',[path(first)]);assert.equal(blockedDelete.rows.length,0);
  await as(player);
  assert.equal((await db.query('select count(*)::int as n from public.campaigns')).rows[0].n,1,'participant sees the campaign');
  assert.equal((await db.query('select * from public.archives_campaign_backups')).rows.length,0,'participant cannot see backup metadata');
  assert.equal((await db.query('select * from storage.objects')).rows.length,0,'participant cannot read backup bytes');
  await assert.rejects(object('55555555-5555-4555-8555-555555555555'),/row-level security/);
  await assert.rejects(commit('55555555-5555-4555-8555-555555555555',1),/inaccessible/);
  await as('', 'anon');await assert.rejects(db.query('select * from public.archives_campaign_backups'),/permission denied/);
  await assert.rejects(commit('55555555-5555-4555-8555-555555555555',1),/permission denied/);
  await as(owner);
  let last;
  for(let revision=1;revision<=10;revision++){
   const id='77777777-7777-4777-8777-'+String(revision).padStart(12,'0');await object(id);last=await commit(id,revision);
  }
  assert.equal(last.backup.revision,11);assert.deepEqual(last.removed,[path(first)]);
  assert.equal((await db.query('select count(*)::int as n from public.archives_campaign_backups')).rows[0].n,10);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path(first)])).rows.length,1,'expired bytes can be pruned through Storage');
  await db.exec('reset role');assert.equal((await db.query("select public from storage.buckets where id='archives-campaign-backups'")).rows[0].public,false);
 }finally{await db.close()}
});
