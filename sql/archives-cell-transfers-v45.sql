-- Les Archives de l'Imaginaire V4.5 : file de transfert MJ vers Owlbear.
-- À installer UNE fois dans le SQL Editor du Supabase du projet.
-- Ne publie aucune cellule sans clic du MJ. Les joueurs n'ont pas accès à cette table.
begin;

create table if not exists public.archives_owlbear_cell_transfers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  room_id text not null check (length(room_id) between 1 and 200),
  scene_key text not null check (length(scene_key) between 1 and 300),
  source_board_id text not null check (length(source_board_id) between 1 and 160),
  source_node_id text not null check (length(source_node_id) between 1 and 160),
  title text not null check (length(title) between 1 and 120),
  category text not null check (category in
    ('personnage','groupe','lieu','objet','ressource','evenement')),
  item_layer text not null check (item_layer in ('CHARACTER','MAP','PROP')),
  image_url text not null check (length(image_url) between 10 and 4000 and image_url ~ '^https://'),
  image_mime text not null check (image_mime in
    ('image/png','image/jpeg','image/webp','image/svg+xml')),
  image_width integer not null check (image_width between 1 and 12000),
  image_height integer not null check (image_height between 1 and 12000),
  status text not null default 'pending' check (status in ('pending','done','failed')),
  applied_item_id text,
  error_text text check (length(error_text) <= 500),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists archives_cell_transfers_room_pending_idx
  on public.archives_owlbear_cell_transfers(room_id,created_at)
  where status='pending';

alter table public.archives_owlbear_cell_transfers enable row level security;
revoke all on public.archives_owlbear_cell_transfers from anon,public;
grant select,insert,update on public.archives_owlbear_cell_transfers to authenticated;

drop policy if exists "cell_transfers_owner_read" on public.archives_owlbear_cell_transfers;
create policy "cell_transfers_owner_read"
on public.archives_owlbear_cell_transfers for select to authenticated
using (
  created_by=auth.uid()
  and exists (
    select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=auth.uid()
  )
);
drop policy if exists "cell_transfers_owner_insert" on public.archives_owlbear_cell_transfers;
create policy "cell_transfers_owner_insert"
on public.archives_owlbear_cell_transfers for insert to authenticated
with check (
  created_by=auth.uid()
  and status='pending'
  and exists (
    select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=auth.uid()
  )
  and exists (
    select 1 from public.owlbear_room_links l
    where l.campaign_id=campaign_id and l.room_id=room_id
  )
  and exists (
    select 1 from public.campaign_live_state s
    where s.campaign_id=campaign_id and s.owlbear_scene_id=scene_key
  )
);
drop policy if exists "cell_transfers_owner_update" on public.archives_owlbear_cell_transfers;
create policy "cell_transfers_owner_update"
on public.archives_owlbear_cell_transfers for update to authenticated
using (
  created_by=auth.uid()
  and exists (
    select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=auth.uid()
  )
)
with check (
  created_by=auth.uid()
  and exists (
    select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=auth.uid()
  )
);

commit;
