-- Les Archives V4.48 : installation ou mise à jour des sauvegardes privées.
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
-- Le compteur reste présent même si toutes les versions sont supprimées.
create table if not exists public.archives_backup_heads (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check(revision >= 0)
);
insert into public.archives_backup_heads(campaign_id,owner_id,revision)
select campaign_id,owner_id,max(revision) from public.archives_campaign_backups group by campaign_id,owner_id
on conflict(campaign_id) do update set revision=greatest(public.archives_backup_heads.revision,excluded.revision);
-- Les fichiers en attente de nettoyage restent suivis après une coupure réseau.
create table if not exists public.archives_backup_cleanup (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  paths text[] not null check(cardinality(paths) between 1 and 128),
  byte_size bigint not null check(byte_size > 0),
  created_at timestamptz not null default now()
);
alter table public.archives_backup_heads enable row level security;
alter table public.archives_backup_cleanup enable row level security;
revoke all on public.archives_backup_heads,public.archives_backup_cleanup from anon,authenticated;
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
  insert into public.archives_backup_heads(campaign_id,owner_id,revision)
    values(p_campaign_id,uid,0) on conflict(campaign_id) do nothing;
  select revision into current_revision from public.archives_backup_heads where campaign_id=p_campaign_id for update;
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
  update public.archives_backup_heads set revision=current_revision+1,owner_id=uid where campaign_id=p_campaign_id;
  -- Dix versions au maximum ; le nettoyage utilise exclusivement l'API Storage.
  with expired as (
    delete from public.archives_campaign_backups where campaign_id=p_campaign_id and id in (
      select id from public.archives_campaign_backups where campaign_id=p_campaign_id order by revision desc offset 10
    ) returning id,parts,byte_size
  ), queued as (
    insert into public.archives_backup_cleanup(id,campaign_id,owner_id,paths,byte_size)
    select e.id,p_campaign_id,uid,array(
      select uid::text||'/'||p_campaign_id::text||'/'||e.id::text||'/'||i::text
      from generate_series(0,jsonb_array_length(e.parts)-1) i
    ),e.byte_size from expired e
    on conflict(id) do nothing returning paths
  ) select coalesce(array_agg(p.name),array[]::text[]) into removed_paths
    from queued q cross join lateral unnest(q.paths) p(name);
  return jsonb_build_object('backup',to_jsonb(saved),'removed',removed_paths);
end;
$$;
revoke all on function public.archives_commit_backup(uuid,uuid,bigint,jsonb,text,text,jsonb) from public,anon;
grant execute on function public.archives_commit_backup(uuid,uuid,bigint,jsonb,text,text,jsonb) to authenticated;

-- Catalogue cohérent : versions, compteur et espace restant à libérer.
create or replace function public.archives_backup_catalog(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=auth.uid()) then
    raise exception 'Campagne privée inaccessible' using errcode='42501';
  end if;
  return jsonb_build_object(
    'revision',coalesce((select revision from public.archives_backup_heads where campaign_id=p_campaign_id),0),
    'backups',coalesce((select jsonb_agg(to_jsonb(b) order by b.revision desc) from (
      select * from public.archives_campaign_backups where campaign_id=p_campaign_id order by revision desc limit 10
    ) b),'[]'::jsonb),
    'cleanup_pending',(select count(*) from public.archives_backup_cleanup where campaign_id=p_campaign_id),
    'cleanup_bytes',coalesce((select sum(byte_size) from public.archives_backup_cleanup where campaign_id=p_campaign_id),0)
  );
end;
$$;
-- Retire uniquement les versions choisies ; la campagne courante n'est pas effacée.
create or replace function public.archives_delete_backups(p_campaign_id uuid,p_ids uuid[],p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  current_revision bigint;
  latest_id uuid;
  removed jsonb;
begin
  perform 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=uid for update;
  if uid is null or not found then raise exception 'Campagne privée inaccessible' using errcode='42501'; end if;
  if p_ids is null or cardinality(p_ids) not between 1 and 10 or array_position(p_ids,null) is not null then
    raise exception 'Choisis entre une et dix sauvegardes';
  end if;
  insert into public.archives_backup_heads(campaign_id,owner_id,revision)
    values(p_campaign_id,uid,0) on conflict(campaign_id) do nothing;
  select revision into current_revision from public.archives_backup_heads where campaign_id=p_campaign_id for update;
  if p_expected_revision is null or current_revision<>p_expected_revision then
    raise exception 'ARCHIVES_BACKUP_CONFLICT' using errcode='40001';
  end if;
  select id into latest_id from public.archives_campaign_backups where campaign_id=p_campaign_id order by revision desc limit 1;
  with removed_rows as (
    delete from public.archives_campaign_backups where campaign_id=p_campaign_id and owner_id=uid and id=any(p_ids)
    returning id,parts,byte_size
  ), queued as (
    insert into public.archives_backup_cleanup(id,campaign_id,owner_id,paths,byte_size)
    select b.id,p_campaign_id,uid,array(
      select uid::text||'/'||p_campaign_id::text||'/'||b.id::text||'/'||i::text
      from generate_series(0,jsonb_array_length(b.parts)-1) i
    ),b.byte_size from removed_rows b
    on conflict(id) do nothing returning id,byte_size
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'bytes',byte_size)),'[]'::jsonb) into removed from queued;
  if jsonb_array_length(removed)>0 then
    update public.archives_backup_heads set revision=current_revision+1 where campaign_id=p_campaign_id;
  end if;
  return jsonb_build_object('deleted',removed,'latest_deleted',coalesce(latest_id=any(p_ids),false),
    'catalog',public.archives_backup_catalog(p_campaign_id));
end;
$$;
create or replace function public.archives_pending_backup_cleanup(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=auth.uid()) then
    raise exception 'Campagne privée inaccessible' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(j)) from (
    select id,paths,byte_size from public.archives_backup_cleanup where campaign_id=p_campaign_id order by created_at limit 20
  ) j),'[]'::jsonb);
end;
$$;
create or replace function public.archives_finish_backup_cleanup(p_campaign_id uuid,p_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=auth.uid()) then
    raise exception 'Campagne privée inaccessible' using errcode='42501';
  end if;
  if p_ids is null or cardinality(p_ids)>20 then raise exception 'Nettoyage invalide'; end if;
  delete from public.archives_backup_cleanup where campaign_id=p_campaign_id and owner_id=auth.uid() and id=any(p_ids);
end;
$$;
revoke all on function public.archives_backup_catalog(uuid),public.archives_delete_backups(uuid,uuid[],bigint),
  public.archives_pending_backup_cleanup(uuid),public.archives_finish_backup_cleanup(uuid,uuid[]) from public,anon;
grant execute on function public.archives_backup_catalog(uuid),public.archives_delete_backups(uuid,uuid[],bigint),
  public.archives_pending_backup_cleanup(uuid),public.archives_finish_backup_cleanup(uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
