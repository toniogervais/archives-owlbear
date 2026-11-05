import { O as OBR } from '../../assets/index-BfJgTiPE.js';
import { c as createClient } from '../../assets/index-D5xPhma_.js';
import { createSession, publicConfig, watchState } from './session.mjs';
const $ = id => document.getElementById(id);
const frame = $('archives-frame');
const modalId = 'fr.archives-imaginaire.bridge/archives-viewer';
let db, service, watcher, authSubscription, roleSubscription;
let selected = null, current = null, busy = false, generation = 0, userId = null, allowed = false;
let connecting = false, reconnect = false, closed = false;
const message = text => { $('session-status').textContent = text; };
function controls() {
  $('mode-archives').disabled = !allowed || !selected || !current || busy || !navigator.onLine;
  $('mode-owlbear').disabled = $('mode-archives').disabled;
  $('campaign').disabled = busy;
}
function stop() {
  generation++;
  watcher?.dispose(); watcher = null;
  selected = null; current = null;
  controls(); sendContext();
}
function sendContext() {
  frame.contentWindow?.postMessage({ type: 'archives:context:v37', campaignId: selected, roomId: OBR.room.id }, location.origin);
}
async function selectCampaign() {
  stop();
  selected = $('campaign').value || null;
  if (!selected) { message('Choisis la campagne à synchroniser.'); return; }
  const id = selected, epoch = generation;
  localStorage.setItem('archives_owlbear_last_campaign_v33:' + userId + ':' + OBR.room.id, id);
  message('Vérification de la campagne…');
  sendContext();
  watcher = watchState(db, id, service.read, result => {
    if (epoch !== generation || selected !== id) return;
    if (result.error) {
      current = null;
      message('Synchronisation indisponible : ' + result.error.message);
    } else {
      current = result.state;
      // A linked campaign may have no shared state yet. Allow explicit initialization only.
      if (!current) current = { active_mode: null, revision: 0 };
      const mode = current.active_mode || 'à définir';
      message('Mode partagé : ' + mode + ' · ' + (result.connected ? 'suivi en direct' : 'vérification toutes les 10 s'));
    }
    controls();
  });
}
async function connect() {
  if (closed) return;
  if (connecting) { reconnect = true; return; }
  connecting = true;
  stop();
  const epoch = generation;
  try {
    allowed = await OBR.player.getRole() === 'GM';
    if (!allowed) throw new Error('Cet espace de préparation est réservé au meneur.');
    if (!db) {
      const config = publicConfig(localStorage);
      // Keep the established extension project and the embedded application on the same endpoint.
      localStorage.setItem('archives_supabase_url', config.url);
      localStorage.setItem('archives_supabase_public_key', config.key);
      db = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      service = createSession(db, OBR);
      authSubscription = db.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') {
          stop(); userId = null; $('campaign').replaceChildren(new Option('Compte déconnecté', ''));
          message('Compte déconnecté. Reconnecte-toi dans Comptes et campagnes, puis clique sur Actualiser.');
        } else if (event === 'SIGNED_IN') { setTimeout(() => { void connect(); }, 0); }
      }).data.subscription;
    }
    const { user, campaigns } = await service.campaigns();
    if (closed || epoch !== generation) return;
    userId = user.id;
    $('campaign').replaceChildren(new Option('Choisir une campagne…', ''));
    for (const campaign of campaigns) $('campaign').add(new Option(campaign.name || campaign.id, campaign.id));
    const remembered = localStorage.getItem('archives_owlbear_last_campaign_v33:' + user.id + ':' + OBR.room.id);
    const chosen = campaigns.find(c => c.id === remembered) || (campaigns.length === 1 ? campaigns[0] : null);
    if (chosen) { $('campaign').value = chosen.id; await selectCampaign(); }
    else message(campaigns.length ? 'Plusieurs campagnes sont liées à cette salle : choisis celle de la partie.' : 'Associe cette salle à une campagne depuis le panneau de l’extension.');
  } catch (error) {
    current = null; message(error.message);
  } finally {
    controls(); connecting = false;
    if (reconnect && !closed) { reconnect = false; void connect(); }
  }
}
async function close() {
  $('return-owlbear').disabled = true;
  try { await OBR.modal.close(modalId); }
  catch (error) { message('Retour impossible : ' + error.message); $('return-owlbear').disabled = false; }
}
async function mode(next) {
  if (busy || !selected || !current || !navigator.onLine) return;
  busy = true; controls();
  const id = selected, epoch = generation;
  message('Enregistrement du mode ' + next + '…');
  try {
    const result = await service.setMode(id, next);
    if (epoch !== generation || selected !== id) return;
    if (result?.active_mode !== next) throw new Error('Le mode demandé n’a pas été confirmé.');
    current = result;
    message('Mode partagé : ' + next + ' · enregistrement confirmé');
    if (next === 'OWLBEAR') await close();
  } catch (error) {
    if (epoch === generation) message('Changement non confirmé : ' + error.message);
  } finally { busy = false; controls(); }
}
$('return-owlbear').addEventListener('click', close);
$('mode-archives').addEventListener('click', () => mode('ARCHIVES'));
$('mode-owlbear').addEventListener('click', () => mode('OWLBEAR'));
$('refresh').addEventListener('click', () => connect());
$('campaign').addEventListener('change', () => { void selectCampaign().catch(e => message(e.message)); });
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'archives:ready:v37') sendContext();
  if (event.data?.type === 'archives:return:v37') void close();
});
window.addEventListener('offline', () => { current = null; controls(); message('Hors ligne : les changements de mode sont suspendus.'); });
window.addEventListener('online', () => { void connect(); });
window.addEventListener('pagehide', () => { closed = true; stop(); authSubscription?.unsubscribe(); roleSubscription?.(); });
async function start() {
  if (!OBR.isAvailable) throw new Error('Ouvre Les Archives depuis ta salle Owlbear.');
  await new Promise(resolve => OBR.onReady(resolve));
  if (await OBR.player.getRole() !== 'GM') throw new Error('Cet espace de préparation est réservé au meneur.');
  // Start the local editor even when the shared connection is unavailable.
  try { const config = publicConfig(localStorage); localStorage.setItem('archives_supabase_url', config.url); localStorage.setItem('archives_supabase_public_key', config.key); } catch {}
  frame.src = new URL('../../archives-app-v51-v37.html', import.meta.url).href;
  $('display').hidden = false;
  roleSubscription = OBR.player.onChange(player => {
    if (player.role !== 'GM') {
      allowed = false; stop(); frame.removeAttribute('src'); $('display').hidden = true;
      message('L’accès de préparation a été fermé : rôle meneur requis.');
    }
  });
  await connect();
}
start().catch(error => message(error.message));
