-- Les Archives de l'Imaginaire — stockage privé des tokens Owlbear (V4.31)
-- À exécuter une seule fois dans SQL Editor du projet Supabase utilisé par Les Archives.
-- NE PAS rendre ce bucket public : les images cachées ne sont jamais accessibles sans URL signée.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('archives-owlbear-assets','archives-owlbear-assets',false,5242880,array['image/png','image/webp','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/png','image/webp','image/jpeg'];

drop policy if exists "archives tokens select owner" on storage.objects;
drop policy if exists "archives tokens insert owner" on storage.objects;
drop policy if exists "archives tokens update owner" on storage.objects;
drop policy if exists "archives tokens delete owner" on storage.objects;

create policy "archives tokens select owner" on storage.objects for select to authenticated
using (bucket_id = 'archives-owlbear-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "archives tokens insert owner" on storage.objects for insert to authenticated
with check (bucket_id = 'archives-owlbear-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "archives tokens update owner" on storage.objects for update to authenticated
using (bucket_id = 'archives-owlbear-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'archives-owlbear-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "archives tokens delete owner" on storage.objects for delete to authenticated
using (bucket_id = 'archives-owlbear-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text);
