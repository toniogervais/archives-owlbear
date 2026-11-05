// Shared-state access. All writes are re-authorized; Supabase RLS remains authoritative.
export const SCENE_KEY = 'fr.archives-imaginaire.bridge/scene-key';
export function data(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function publicConfig(storage) {
  const raw = storage.getItem('archives_owlbear_public_config_v27');
  const saved = raw ? JSON.parse(raw) : {};
  const url = saved.url || storage.getItem('archives_supabase_url');
  const key = saved.key || storage.getItem('archives_supabase_public_key');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url || '') || typeof key !== 'string') {
    throw new Error('Connecte ton compte dans le panneau de l’extension Owlbear.');
  }
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = payload.role === 'anon';
    } catch {}
  }
  if (!publicKey) throw new Error('Une clé publique anon ou publishable est nécessaire.');
  return { url: url.replace(/\/$/, ''), key };
}
export function createSession(db, obr) {
  async function owner(campaignId) {
    if (await obr.player.getRole() !== 'GM') throw new Error('Action réservée au meneur Owlbear.');
    const user = data(await db.auth.getUser())?.user;
    if (!user) throw new Error('Connecte ton compte Archives.');
    if (campaignId) {
      const campaign = data(await db.from('campaigns').select('id,name,owner_id').eq('id', campaignId).maybeSingle());
      if (!campaign || campaign.owner_id !== user.id) throw new Error('Campagne inaccessible au compte MJ.');
      const link = data(await db.from('owlbear_room_links').select('room_id').eq('campaign_id', campaignId).maybeSingle());
      if (!link || link.room_id !== obr.room.id) throw new Error('Cette campagne n’est plus liée à la salle ouverte.');
      return campaign;
    }
    return user;
  }
  async function campaigns() {
    const user = await owner();
    const owned = data(await db.from('campaigns').select('id,name,owner_id').eq('owner_id', user.id).order('name')) || [];
    const links = data(await db.from('owlbear_room_links').select('campaign_id').eq('room_id', obr.room.id)) || [];
    const ids = new Set(links.map(link => link.campaign_id));
    return { user, campaigns: owned.filter(campaign => ids.has(campaign.id)) };
  }
  async function read(campaignId) {
    await owner(campaignId);
    return data(await db.from('campaign_live_state')
      .select('active_mode,owlbear_scene_id,revision,updated_at').eq('campaign_id', campaignId).maybeSingle());
  }
  async function setMode(campaignId, mode) {
    if (!['ARCHIVES', 'OWLBEAR'].includes(mode)) throw new Error('Mode inconnu.');
    await owner(campaignId);
    // Prevent resuming the shared map on the wrong scene, without changing scene metadata.
    if (mode === 'OWLBEAR') {
      if (!await obr.scene.isReady()) throw new Error('Ouvre une scène Owlbear avant de reprendre la carte.');
      const state = await read(campaignId);
      const metadata = await obr.scene.getMetadata();
      if (!state?.owlbear_scene_id || state.owlbear_scene_id !== metadata?.[SCENE_KEY]) {
        throw new Error('Active la scène ouverte depuis le panneau de l’extension.');
      }
    }
    await owner(campaignId);
    data(await db.rpc('archives_set_mode', { p_campaign_id: campaignId, p_mode: mode }));
    return read(campaignId);
  }
  return { campaigns, read, setMode };
}

// Immediate read, Realtime invalidation and a fallback read. Disposal invalidates pending work.
export function watchState(db, campaignId, read, notify, timers = globalThis) {
  let disposed = false, busy = false, pending = false, connected = false;
  async function refresh() {
    if (disposed) return;
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const state = await read(campaignId);
      if (!disposed) notify({ state, connected, error: null });
    } catch (error) {
      if (!disposed) notify({ state: null, connected, error });
    } finally {
      busy = false;
      if (pending && !disposed) { pending = false; void refresh(); }
    }
  }
  const channel = db.channel('archives-v37-' + campaignId + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_live_state', filter: 'campaign_id=eq.' + campaignId }, refresh)
    .subscribe(status => {
      connected = status === 'SUBSCRIBED';
      if (!disposed) void refresh();
    });
  const interval = timers.setInterval(refresh, 10000);
  void refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      timers.clearInterval(interval);
      void Promise.resolve(db.removeChannel(channel)).catch(() => {});
    }
  };
}
