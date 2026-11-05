const frame = document.getElementById('archives');
const dialog = document.getElementById('room-setup');
const input = document.getElementById('room-url');
const error = document.getElementById('error');
const feedback = document.getElementById('feedback');
const STORAGE_KEY = 'archives_owlbear_room_url_v38';
const owlPanel = document.getElementById('owlbear-panel');
const owlFrame = document.getElementById('owlbear-frame');
const closeOwlbear = document.getElementById('owlbear-close');
let framedRoom = null;

export function checkRoomUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('Ce lien Owlbear n’est pas valide.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !['owlbear.rodeo','www.owlbear.rodeo'].includes(host) || url.username || url.password) {
    throw new Error('Utilise une adresse HTTPS du site officiel owlbear.rodeo.');
  }
  if (url.pathname === '/' || !url.pathname) throw new Error('Colle le lien complet de ta salle, pas la page d’accueil.');
  return url.href;
}
function notify(message, url) {
  feedback.replaceChildren(document.createTextNode(message));
  if (url) {
    feedback.append(' ');
    const link = document.createElement('a');
    link.href = url; link.target = 'archives-owlbear-room'; link.rel = 'noopener';
    link.textContent = 'Ouvrir la carte';
    feedback.append(link);
  }
  feedback.hidden = false;
}
function showSetup() {
  error.textContent = '';
  input.value = localStorage.getItem(STORAGE_KEY) || '';
  dialog.showModal();
  input.focus();
}
function showOwlbear(url) {
  // Never open a second tab. Keep the original canvas mounted, with its live state intact.
  if (framedRoom !== url) {
    owlFrame.src = url;
    framedRoom = url;
  }
  owlPanel.hidden = false;
  closeOwlbear.focus();
}
function returnToArchives() {
  owlPanel.hidden = true;
  // Do not unload either frame; retain the map scene and unsaved canvas state in memory.
  try {
    const icon = frame.contentDocument?.querySelector('#canvas-integrations-dock .canvas-integration-item:first-child button');
    icon?.focus();
  } catch {}
}
closeOwlbear.addEventListener('click', returnToArchives);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !owlPanel.hidden) returnToArchives();
});
function openOwlbear() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) { showSetup(); return; }
  try { showOwlbear(checkRoomUrl(saved)); }
  catch { localStorage.removeItem(STORAGE_KEY); showSetup(); }
}
document.getElementById('room-cancel').addEventListener('click', () => dialog.close());
document.getElementById('room-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const url = checkRoomUrl(input.value);
    localStorage.setItem(STORAGE_KEY, url);
    dialog.close();
    showOwlbear(url);
  } catch (e) { error.textContent = e.message; }
});
frame.addEventListener('load', () => {
  let doc;
  try { doc = frame.contentDocument; } catch { notify('Impossible d’accéder au canevas des Archives.'); return; }
  if (!doc) return;
  const title = doc.getElementById('archives-title-screen');
  if (title) { title.hidden = true; title.style.setProperty('display', 'none', 'important'); }
  // Reuse the existing Owlbear icon: no extra toolbar or redundant mode buttons.
  const icon = doc.querySelector('#canvas-integrations-dock .canvas-integration-item:first-child button');
  if (!icon) { notify('Le canevas est ouvert, mais le bouton Owlbear est introuvable.'); return; }
  icon.disabled = false;
  icon.setAttribute('aria-label', 'Owlbear — afficher la carte intégrée');
  icon.title = 'Afficher la carte Owlbear';
  icon.parentElement.title = 'Afficher la carte Owlbear';
  icon.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openOwlbear();
  }, { capture: true });
});
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type === 'archives:return:v37') openOwlbear();
});
