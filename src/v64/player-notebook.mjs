import {isPacket} from '../v56/link.mjs';
import {button,element,sheet} from '../v63/ui.mjs';

// Personal notes are browser-local, scoped by the identity supplied by the
// trusted room host. They never enter a scenario, public snapshot or RPC.
export function installPlayerNotebook() {
  let scope = '',view;
  const key = () => 'archives:player-notebook:v1:'+scope;
  function open() {
    if (!scope) return;
    view = sheet('archives-player-notebook','Mes notes','Carnet personnel');
    const textarea = element('textarea');textarea.setAttribute('aria-label','Mes notes personnelles');
    textarea.maxLength = 100000;textarea.rows = 16;textarea.style.cssText = 'width:100%;min-height:38dvh;resize:vertical;box-sizing:border-box;line-height:1.65';
    view.content.append(element('p','Ces notes restent dans ce navigateur et dans cette salle, séparées des informations envoyées par le MJ. Enregistre une copie pour les garder ailleurs.','studio-hint'),textarea);
    try { textarea.value = localStorage.getItem(key()) || '';view.status.textContent = 'Enregistrement automatique sur cet appareil.'; }
    catch { view.status.textContent = 'Ce navigateur bloque l’enregistrement. Enregistre une copie avant de fermer.'; }
    const status = view.status;
    textarea.oninput = () => {
      try { localStorage.setItem(key(),textarea.value);status.textContent = 'Notes enregistrées sur cet appareil.'; }
      catch { status.textContent = 'Enregistrement impossible. Enregistre une copie avant de fermer.'; }
    };
    view.content.append(button('Enregistrer une copie',() => {
      const url = URL.createObjectURL(new Blob([textarea.value],{type:'text/plain;charset=utf-8'}));
      const link = element('a');link.href = url;link.download = 'Mes-notes-Archives.txt';link.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    }));
    textarea.focus();
  }
  function bind() {
    const control = document.getElementById('quick-player-journal');if (!control) return;
    control.title = 'Mes notes';control.setAttribute('aria-label','Mes notes');control.disabled = !scope;
    control.onclick = open;
  }
  window.addEventListener('message',event => {
    if (event.source !== window.parent || event.origin !== location.origin || !isPacket(event.data) ||
      event.data.type !== 'owl-player-identity' || typeof event.data.scope !== 'string' ||
      !event.data.scope || event.data.scope.length > 500) return;
    if (scope && scope !== event.data.scope) view?.dialog.close();
    scope = event.data.scope;bind();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
}
