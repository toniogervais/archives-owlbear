import {isPacket,packet} from '../v56/link.mjs';
const pending = new Map();
export const isGM = () => { const state = window.DuneApp?.getState?.();return !!state && !state.playerMode && !state.strictReadOnly; };
export function requireGM() { if (!isGM()) throw Error('Commande réservée au maître de jeu.'); }
export function nativeEditor() { return window.parent !== window && new URLSearchParams(location.search).get('owl-editor') === '1'; }
export function request(kind,command = {}) {
  if (kind === 'campaign') { requireGM();if (!nativeEditor()) throw Error('Ouvre les Archives depuis le livre dans ta salle Owlbear pour sauvegarder les bibliothèques de cette salle.'); }
  if(kind === 'dossier' && window.parent === window) throw Error('Ouvre les Archives dans ta salle Owlbear pour partager des fichiers avec les joueurs.');
  const types = kind === 'campaign' ? ['owl-campaign-command','owl-campaign-result'] : kind === 'dossier' ? ['owl-dossier-command','owl-dossier-result'] : ['owl-public-items-request','owl-public-items-result'];
  const id = crypto.randomUUID();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { pending.delete(id);reject(Error('La salle ne répond pas. Garde cet onglet ouvert et réessaie.')); },kind === 'campaign' || kind === 'dossier' ? 180000 : 15000);
    pending.set(id,{resolve,reject,timer,kind,resultType:types[1]});
    window.parent.postMessage(packet(types[0],{id,command}),location.origin);
  });
}
window.addEventListener('message',event => {
  if (event.source !== window.parent || event.origin !== location.origin || !isPacket(event.data)) return;
  const data = event.data,entry = pending.get(data.id);
  if (!entry || data.type !== entry.resultType) return;
  pending.delete(data.id);clearTimeout(entry.timer);
  if (data.safe) entry.resolve(data.result);else entry.reject(Error(data.message || 'Opération impossible.'));
});
export function element(tag,text,className) {
  const el = document.createElement(tag);if (text != null) el.textContent = text;if (className) el.className = className;return el;
}
export function button(text,handler,className) {
  const el = element('button',text,className);el.type = 'button';el.onclick = handler;return el;
}
export function notice(message) {
  let el = document.getElementById('archives-studio-notice');
  if (!el) { el = element('p',null,'studio-status');el.id = 'archives-studio-notice';el.setAttribute('role','status');el.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:50000;max-width:min(440px,90vw);padding:14px 18px;background:#241e2e;color:#f3dfba;border:1px solid #c8ab724d;border-radius:12px;box-shadow:0 8px 30px #0004;font:14px/1.5 system-ui';document.body.append(el); }
  el.textContent = message;el.hidden = false;clearTimeout(notice.timer);notice.timer = setTimeout(() => { el.hidden = true; },10000);
}
export function sheet(id,title,eyebrow = 'Les Archives') {
  document.getElementById(id)?.close();
  document.getElementById(id)?.remove();
  const dialog = element('dialog',null,'studio-sheet');dialog.id = id;
  const header = element('header'),heading = element('div'),titleEl = element('h2',title);
  titleEl.id = id + '-title';dialog.setAttribute('aria-labelledby',titleEl.id);
  heading.append(element('p',eyebrow,'eyebrow'),titleEl);
  const close = button('×',() => { if (!busy) dialog.close(); },'studio-close');close.setAttribute('aria-label','Fermer '+title.toLocaleLowerCase('fr'));
  header.append(heading,close);const content = element('section'),status = element('p','','studio-status');status.setAttribute('role','status');
  dialog.append(header,content,status);let busy = false,cleanup = () => {};
  dialog.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close',() => { cleanup();if (!window.ArchivesAppearance?.retire(dialog)) dialog.remove(); },{once:true});
  document.body.append(dialog);dialog.showModal();
  return {dialog,content,status,close,title:titleEl,cleanup:fn => { cleanup = fn; },busy(value) { busy = value;dialog.querySelectorAll('button,input,select').forEach(el => { el.disabled = value; }); }};
}
