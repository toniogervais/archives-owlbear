import { O as OBR } from '../../assets/index-BfJgTiPE.js';
const modalId = 'fr.archives-imaginaire.bridge/archives-viewer';
const frame = document.getElementById('app');
const message = document.getElementById('message');
const button = document.getElementById('return');
let closed = false;
function fail(error) {
  message.textContent = error?.message || String(error);
  message.hidden = false;
  frame.hidden = true;
}
async function returnToMap() {
  if (closed) return;
  button.disabled = true;
  try { await OBR.modal.close(modalId); closed = true; }
  catch (error) { button.disabled = false; fail(error); }
}
button.addEventListener('click', () => { void returnToMap(); });
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type === 'archives:return:v37') void returnToMap();
});
frame.addEventListener('load', () => {
  try {
    const screen = frame.contentDocument?.getElementById('archives-title-screen');
    if (screen) { screen.hidden = true; screen.style.setProperty('display', 'none', 'important'); }
  } catch (error) { fail(error); }
});
async function start() {
  if (!OBR.isAvailable) throw new Error('Ouvre cette interface depuis Owlbear.');
  await new Promise(resolve => OBR.onReady(resolve));
  if (await OBR.player.getRole() !== 'GM') throw new Error('Espace réservé au meneur.');
  OBR.player.onChange(player => {
    if (player.role !== 'GM') { frame.removeAttribute('src'); fail('Accès fermé : rôle meneur requis.'); }
  });
  frame.src = new URL('../../archives-app-v51-v37.html', import.meta.url).href;
  frame.hidden = false;
}
start().catch(fail);
