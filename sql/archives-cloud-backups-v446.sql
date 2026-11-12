-- Les Archives V4.46 : exécuter une seule fois dans SQL Editor de Supabase.
-- Ajoute des sauvegardes privées ; ne modifie ni les campagnes ni les accès joueurs.
begin;
create table if not exists public.archives_campaign_backups (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  created_at timestamptz not null default now(),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 536870912),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  summary jsonb not null,
  parts jsonb not null,
  unique(campaign_id,revision)
);
alter table public.archives_campaign_backups enable row level security;
revoke all on public.archives_campaign_backups from anon, authenticated;
grant select on public.archives_campaign_backups to authenticated;
drop policy if exists "archives backups owner read" on public.archives_campaign_backups;
create policy "archives backups owner read" on public.archives_campaign_backups
for select to authenticated using (owner_id = (select auth.uid()) and exists (
  select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())
));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('archives-campaign-backups','archives-campaign-backups',false,4194304,array['application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=4194304,allowed_mime_types=array['application/octet-stream'];
drop policy if exists "archives backups objects read" on storage.objects;
drop policy if exists "archives backups objects insert" on storage.objects;
drop policy if exists "archives backups objects delete" on storage.objects;
create policy "archives backups objects read" on storage.objects for select to authenticated using (
  bucket_id='archives-campaign-backups' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and exists(select 1 from public.campaigns c where c.id::text=(storage.foldername(storage.objects.name))[2] and c.owner_id=(select auth.uid()))
);
create policy "archives backups objects insert" on storage.objects for insert to authenticated with check (
  bucket_id='archives-campaign-backups' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and exists(select 1 from public.campaigns c where c.id::text=(storage.foldername(storage.objects.name))[2] and c.owner_id=(select auth.uid()))
);
-- Immutable bytes: no UPDATE/upsert policy. Committed copies cannot be deleted.
create policy "archives backups objects delete" on storage.objects for delete to authenticated using (
  bucket_id='archives-campaign-backups' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.archives_campaign_backups b where b.id::text=(storage.foldername(storage.objects.name))[3]
    and b.owner_id=(select auth.uid()))
);
-- SECURITY DEFINER is required for the atomic compare-and-publish transaction;
-- every call checks ownership, locks that campaign and checks all uploaded parts.
create or replace function public.archives_commit_backup(
  p_campaign_id uuid,p_id uuid,p_expected_revision bigint,p_parts jsonb,
  p_sha256 text,p_fingerprint text,p_summary jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  current_revision bigint;
  saved public.archives_campaign_backups;
  item jsonb;
  idx integer := 0;
  total bigint := 0;
  actual_size bigint;
  object_path text;
  removed_paths text[] := array[]::text[];
begin
  if uid is null or not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=uid) then
    raise exception 'Campagne privée inaccessible' using errcode='42501';
  end if;
  perform 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=uid for update;
  if not found then raise exception 'Campagne privée inaccessible' using errcode='42501'; end if;
  select * into saved from public.archives_campaign_backups where id=p_id;
  if found then
    if saved.owner_id<>uid or saved.campaign_id<>p_campaign_id or saved.sha256<>p_sha256 or saved.fingerprint<>p_fingerprint then
      raise exception 'Identifiant de sauvegarde invalide';
    end if;
    return jsonb_build_object('backup',to_jsonb(saved),'removed',array[]::text[]);
  end if;
  select coalesce(max(revision),0) into current_revision from public.archives_campaign_backups where campaign_id=p_campaign_id;
  if p_expected_revision is null or p_expected_revision<>current_revision then
    raise exception 'ARCHIVES_BACKUP_CONFLICT' using errcode='40001';
  end if;
  if p_id is null or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or
    p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or
    p_parts is null or jsonb_typeof(p_parts)<>'array' or jsonb_array_length(p_parts) not between 1 and 128 or
    p_summary is null or jsonb_typeof(p_summary)<>'object' or octet_length(p_summary::text)>4096 then
    raise exception 'Sauvegarde invalide';
  end if;
  for item in select value from jsonb_array_elements(p_parts) loop
    if jsonb_typeof(item)<>'object' or coalesce(item->>'hash','') !~ '^[a-f0-9]{64}$' or
      coalesce(item->>'bytes','') !~ '^[0-9]{1,7}$' then raise exception 'Bloc invalide'; end if;
    actual_size := (item->>'bytes')::bigint;
    if actual_size not between 1 and 4194304 then raise exception 'Bloc trop volumineux'; end if;
    total := total+actual_size;
    object_path := uid::text||'/'||p_campaign_id::text||'/'||p_id::text||'/'||idx::text;
    perform 1 from storage.objects o where o.bucket_id='archives-campaign-backups' and o.name=object_path
      and (o.metadata->>'size')::bigint=actual_size for share;
    if not found then raise exception 'Bloc manquant : sauvegarde non publiée'; end if;
    idx := idx+1;
  end loop;
  if total>536870912 then raise exception 'Sauvegarde trop volumineuse'; end if;
  insert into public.archives_campaign_backups(id,campaign_id,owner_id,revision,byte_size,sha256,fingerprint,summary,parts)
    values(p_id,p_campaign_id,uid,current_revision+1,total,p_sha256,p_fingerprint,p_summary,p_parts) returning * into saved;
  -- Keep ten complete versions. Deletion of expired bytes uses Storage's API.
  with expired as (
    delete from public.archives_campaign_backups where campaign_id=p_campaign_id and id in (
      select id from public.archives_campaign_backups where campaign_id=p_campaign_id order by revision desc offset 10
    ) returning id,parts
  ) select coalesce(array_agg(uid::text||'/'||p_campaign_id::text||'/'||e.id::text||'/'||(part.ordinality-1)::text),array[]::text[])
    into removed_paths from expired e cross join lateral jsonb_array_elements(e.parts) with ordinality part;
  return jsonb_build_object('backup',to_jsonb(saved),'removed',removed_paths);
end;
$$;
revoke all on function public.archives_commit_backup(uuid,uuid,bigint,jsonb,text,text,jsonb) from public,anon;
grant execute on function public.archives_commit_backup(uuid,uuid,bigint,jsonb,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
