-- AUDIT EN LECTURE SEULE du projet Supabase Les Archives.
-- Aucun mot de passe, aucun jeton, aucune ligne de campagne n'est demandé.
-- À exécuter dans le SQL Editor du projet Supabase réel.

-- A. Les tables critiques doivent activer RLS.
select n.nspname as schema_name,c.relname as table_name,
 c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
  and c.relname in (
 'campaigns','campaign_members','personal_notes','owlbear_room_links',
 'campaign_live_state','archives_owlbear_reveals','archives_owlbear_cell_transfers')
order by c.relname;

-- B. Politiques réellement installées (pas de lignes utilisateur).
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public' and tablename in (
 'campaigns','campaign_members','personal_notes','owlbear_room_links',
 'campaign_live_state','archives_owlbear_reveals','archives_owlbear_cell_transfers')
order by tablename,policyname;

-- C. Autorisations SQL, à confronter AUX politiques RLS.
select c.relname as table_name,
 has_table_privilege('anon',c.oid,'SELECT') as anon_select,
 has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
 has_table_privilege('anon',c.oid,'UPDATE') as anon_update,
 has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
 has_table_privilege('authenticated',c.oid,'INSERT') as auth_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') as auth_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
 and c.relname in (
 'campaigns','campaign_members','personal_notes','owlbear_room_links',
 'campaign_live_state','archives_owlbear_reveals','archives_owlbear_cell_transfers')
order by c.relname;

-- D. Classification des buckets, pas de contenu de fichiers.
select id,public,allowed_mime_types,file_size_limit
from storage.buckets order by id;

-- E. Privilèges d'exécution des fonctions et usage de SECURITY DEFINER.
select p.proname as function_name,
 p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'archives_set_mode','archives_queue_reveal','archives_retry_reveal',
 'has_active_campaign_access','is_campaign_owner')
order by p.proname;
