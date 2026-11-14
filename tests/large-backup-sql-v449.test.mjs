import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',player='33333333-3333-4333-8333-333333333333',campaign='22222222-2222-4222-8222-222222222222',id='44444444-4444-4444-8444-444444444444',hash='a'.repeat(64);
test('V4.49 migration upgrades old constraints for 512 chunks / 2 GiB, retains RLS and queues all bytes for deletion',async()=>{const db=new PGlite();try{
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

 await db.exec(await readFile(new URL('../sql/archives-cloud-backups-v448.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../sql/archives-cloud-backups-v449.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
 const parts=Array.from({length:512},()=>({bytes:4194304,hash}));
 await db.query("insert into storage.objects(bucket_id,name,metadata) select 'archives-campaign-backups',$1 || '/' || i::text,'{\"size\":4194304}'::jsonb from generate_series(0,511) i",[owner+'/'+campaign+'/'+id]);
 const saved=(await db.query('select public.archives_commit_backup($1,$2,$3,$4,$5,$6,$7) as value',[campaign,id,0,JSON.stringify(parts),hash,hash,'{}'])).rows[0].value;
 assert.equal(saved.backup.byte_size,2147483648);assert.equal(saved.backup.parts.length,512);
 let cat=(await db.query('select public.archives_backup_catalog($1) as value',[campaign])).rows[0].value;assert.equal(cat.max_bytes,2147483648);
 await db.query('select public.archives_delete_backups($1,$2,$3)',[campaign,[id],1]);
 const jobs=(await db.query('select public.archives_pending_backup_cleanup($1) as value',[campaign])).rows[0].value;assert.equal(jobs[0].paths.length,512);
 await db.query('delete from storage.objects where bucket_id=$1',['archives-campaign-backups']);await db.query('select public.archives_finish_backup_cleanup($1,$2)',[campaign,[id]]);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.archives_backup_catalog($1)',[campaign]),/inaccessible/);
 }finally{await db.close()}});
