import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, watchState, publicConfig, SCENE_KEY } from '../src/v37/session.mjs';
const campaignId = '12345678-1234-1234-1234-123456789012';
function fixture() {
  const state = { role: 'GM', user: { id: 'owner' }, owner: 'owner', room: 'room', scene: 'scene', ready: true, mode: 'ARCHIVES', calls: [], error: null };
  const db = {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table) {
      const filters = {};
      const query = {
        select() { return query; }, eq(key, value) { filters[key] = value; return query; },
        order() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) {
          let value;
          if (table === 'campaigns') value = filters.id ? { id: campaignId, name: 'Test', owner_id: state.owner } : [{ id: campaignId, owner_id: state.owner }];
          if (table === 'owlbear_room_links') value = filters.campaign_id ? { room_id: state.room } : (state.room === filters.room_id ? [{ campaign_id: campaignId }] : []);
          if (table === 'campaign_live_state') value = { active_mode: state.mode, owlbear_scene_id: state.scene };
          return Promise.resolve({ data: value, error: state.error }).then(resolve, reject);
        }
      };
      return query;
    },
    async rpc(name, args) { state.calls.push({ name, args }); if (!state.error) state.mode = args.p_mode; return { data: {}, error: state.error }; }
  };
  const obr = { room: { id: 'room' }, player: { getRole: async () => state.role }, scene: { isReady: async () => state.ready, getMetadata: async () => ({ [SCENE_KEY]: 'scene' }) } };
  return { state, db, session: createSession(db, obr) };
}
test('retrouve uniquement la campagne liée à la salle', async () => {
  const f = fixture(); assert.equal((await f.session.campaigns()).campaigns.length, 1);
  f.state.room = 'other'; assert.equal((await f.session.campaigns()).campaigns.length, 0);
});
test('lit le schéma actif et confirme la commande RPC', async () => {
  const f = fixture(); assert.equal((await f.session.read(campaignId)).active_mode, 'ARCHIVES');
  assert.equal((await f.session.setMode(campaignId, 'OWLBEAR')).active_mode, 'OWLBEAR');
  assert.deepEqual(f.state.calls, [{ name: 'archives_set_mode', args: { p_campaign_id: campaignId, p_mode: 'OWLBEAR' } }]);
});
for (const [name, patch, mode] of [
  ['joueur Owlbear', { role: 'PLAYER' }, 'ARCHIVES'],
  ['compte déconnecté', { user: null }, 'ARCHIVES'],
  ['compte non propriétaire', { owner: 'other' }, 'ARCHIVES'],
  ['campagne déplacée dans une autre salle', { room: 'other' }, 'ARCHIVES'],
  ['scène fermée', { ready: false }, 'OWLBEAR'],
  ['autre scène active', { scene: 'other' }, 'OWLBEAR'],
  ['erreur serveur', { error: new Error('network') }, 'ARCHIVES']
]) test('refuse sans écriture : ' + name, async () => {
  const f = fixture(); Object.assign(f.state, patch);
  await assert.rejects(f.session.setMode(campaignId, mode)); assert.equal(f.state.calls.length, 0);
});
test('refuse un mode invalide', async () => { const f = fixture(); await assert.rejects(f.session.setMode(campaignId, 'OTHER')); assert.equal(f.state.calls.length, 0); });
test('accepte les clés publiques, refuse service_role et secret', () => {
  const config = key => ({ getItem: name => name === 'archives_owlbear_public_config_v27' ? JSON.stringify({ url: 'https://test.supabase.co', key }) : null });
  assert.equal(publicConfig(config('sb_publishable_example')).url, 'https://test.supabase.co');
  const jwt = role => 'header.' + btoa(JSON.stringify({ role })) + '.signature';
  assert.equal(publicConfig(config(jwt('anon'))).key, jwt('anon'));
  assert.throws(() => publicConfig(config(jwt('service_role'))));
  assert.throws(() => publicConfig(config('sb_secret_example')));
});
test('lecture initiale sans Realtime, secours périodique et arrêt propre', async () => {
  let tick, removed = 0, cleared = 0, changes, reads = 0;
  const events = [];
  const channel = { on(_event, _filter, callback) { changes = callback; return this; }, subscribe() { return this; } };
  const db = { channel: () => channel, removeChannel: async () => { removed++; } };
  const watcher = watchState(db, campaignId, async () => ({ revision: ++reads }), value => events.push(value), { setInterval: fn => { tick = fn; return 1; }, clearInterval: () => { cleared++; } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(events.length, 1); assert.equal(events[0].connected, false);
  await tick(); assert.equal(events.length, 2);
  await changes(); assert.equal(events.length, 3);
  watcher.dispose(); await tick(); assert.equal(events.length, 3); assert.equal(removed, 1); assert.equal(cleared, 1);
});
test('une réponse tardive après changement de campagne est ignorée', async () => {
  let resolveRead;
  const events = [];
  const channel = { on() { return this; }, subscribe() { return this; } };
  const watcher = watchState({ channel: () => channel, removeChannel: async () => {} }, campaignId,
    () => new Promise(resolve => { resolveRead = resolve; }), value => events.push(value), { setInterval: () => 1, clearInterval() {} });
  watcher.dispose(); resolveRead({ revision: 5 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(events.length, 0);
});
test('regroupe les notifications arrivées pendant une lecture', async () => {
  const resolvers = [], events = [];
  let changed;
  const channel = { on(_event, _filter, fn) { changed = fn; return this; }, subscribe() { return this; } };
  const watcher = watchState({ channel: () => channel, removeChannel: async () => {} }, campaignId,
    () => new Promise(resolve => resolvers.push(resolve)), event => events.push(event), { setInterval: () => 1, clearInterval() {} });
  changed(); changed(); resolvers[0]({ revision: 1 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(resolvers.length, 2);
  resolvers[1]({ revision: 2 }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events.map(e => e.state.revision), [1, 2]); watcher.dispose();
});
