import {isPacket} from '../v56/link.mjs?v=4590';
import {button,element,sheet} from '../v63/ui.mjs?v=4590';

// Personal notes are browser-local, scoped by the identity supplied by the
// trusted room host. They never enter a scenario, public snapshot or RPC.
export function installPlayerNotebook() {
  if(window.ArchivesPlayerNotebook)return window.ArchivesPlayerNotebook;
  let scope = '',view;
  const key = () => 'archives:player-notebook:v1:'+scope;
  function open() {
    bind();if (!scope) return;
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
    const state=window.DuneApp?.getState?.();if(!state||!state.playerMode&&!state.strictReadOnly){view?.dialog.close();return;}
    const previousScope=scope;
    if(window.ArchivesPlayerScope)scope=window.ArchivesPlayerScope;
    else if(new URLSearchParams(location.search).get('owl-view')==='1')scope='';
    else scope=(state.strictReadOnly?'live:':'preview:')+(state.liveRoomId||new URLSearchParams(location.search).get('room')||location.pathname)+':'+(window.__archivesLivePlayerName||'Joueur');
    if(previousScope&&previousScope!==scope)view?.dialog.close();
    let control = document.getElementById('quick-player-notes');
    if(!control){const journal=document.getElementById('quick-player-journal');if(!journal)return;control=journal.cloneNode(true);control.id='quick-player-notes';control.removeAttribute('onclick');control.innerHTML='<svg class="quick-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4-1 12-12a2 2 0 0 0-5-5L3 14zM3 21h18"/></svg>';journal.after(control);}
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
  window.ArchivesPlayerNotebook={open,refresh:bind};
  window.addEventListener('archives:public-view',bind);window.addEventListener('archives:player-scope',bind);
  new MutationObserver(bind).observe(document.body,{attributes:true,attributeFilter:['class']});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  return window.ArchivesPlayerNotebook;
}
