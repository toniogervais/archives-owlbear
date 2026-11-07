import {isPacket,packet} from '../v56/link.mjs';
import {button,element,notice,requireGM} from '../v63/ui.mjs';
import {clampPanel,screenCommand} from './screen-model.mjs';

const pending = new Map();let scope = '',panel,entryTimer;
export function sendScreenCommand(value) {
  requireGM();const command = screenCommand(value),id = crypto.randomUUID();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { pending.delete(id);reject(Error('La salle ne confirme pas la demande. Les joueurs n’ont pas été déplacés automatiquement.')); },12000);
    pending.set(id,{resolve,reject,timer});window.parent.postMessage(packet('owl-screen-command',{id,command}),location.origin);
  });
}
function positionPanel() {
  if (!panel) return;
  let saved;try { saved = JSON.parse(localStorage.getItem('archives:screen-choice-position:'+scope)); } catch {}
  const rect = panel.getBoundingClientRect(),position = clampPanel(saved || {left:innerWidth-rect.width-18,top:85},rect.width,rect.height,innerWidth,innerHeight);
  panel.style.left=position.left+'px';panel.style.top=position.top+'px';
}
function remember() {
  if (!panel) return;const rect=panel.getBoundingClientRect();
  try { localStorage.setItem('archives:screen-choice-position:'+scope,JSON.stringify({left:rect.left,top:rect.top})); } catch {}
}
function offer(target) {
  requireGM();if (panel) { panel.focus();return Promise.resolve(null); }
  return new Promise(resolve => {
    panel=element('section',null,'studio-screen-choice');panel.id='archives-screen-choice';
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','archives-screen-choice-title');panel.tabIndex=-1;
    const header=element('header'),title=element('h2','Et les joueurs ?');title.id='archives-screen-choice-title';
    const grip=element('span','⠿','screen-choice-grip');grip.title='Maintenir pour déplacer cette fenêtre';header.append(grip,title);
    const close=button('×',() => finish('STAY'),'studio-close');close.setAttribute('aria-label','Laisser les joueurs sur leur écran');header.append(close);
    const description=element('p',target==='ARCHIVES'?'Tu ouvres les Archives.':'Tu passes sur la carte Owlbear.');
    const actions=element('div',null,'screen-choice-actions'),status=element('p','','studio-status');status.setAttribute('role','status');
    for (const [policy,label] of [['STAY','Les joueurs restent'],['OPTIONAL','Inviter à suivre'],['REQUIRED','Suivi obligatoire']]) {
      const control=button(label,() => { void finish(policy); });control.dataset.screenPolicy=policy;actions.append(control);
    }
    panel.append(header,description,actions,status);document.body.append(panel);positionPanel();
    let drag;
    header.style.touchAction='none';header.onpointerdown=event => {
      if (event.button!==0 || event.target.closest('button')) return;
      event.preventDefault();const rect=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};header.setPointerCapture(event.pointerId);
    };
    header.onpointermove=event => {
      if (!drag || event.pointerId!==drag.id) return;event.preventDefault();const rect=panel.getBoundingClientRect();
      const position=clampPanel({left:drag.left+event.clientX-drag.x,top:drag.top+event.clientY-drag.y},rect.width,rect.height,innerWidth,innerHeight);
      panel.style.left=position.left+'px';panel.style.top=position.top+'px';
    };
    header.onpointerup=header.onpointercancel=() => { drag=null;remember(); };
    async function finish(policy) {
      if (!panel || panel.dataset.busy) return;panel.dataset.busy='1';panel.querySelectorAll('button').forEach(control => {control.disabled=true;});
      try {
        if(policy==='STAY') {
          // Returning alone must remain available when the invitation service is offline.
          window.parent.postMessage(packet('owl-screen-command',{id:crypto.randomUUID(),command:{target,policy}}),location.origin);
        } else await sendScreenCommand({target,policy});
        remember();panel.remove();panel=null;resolve(policy);
      } catch (error) {
        status.textContent=error.message;delete panel.dataset.busy;panel.querySelectorAll('button').forEach(control => {control.disabled=false;});
      }
    }
  });
}
export async function leaveToMap() {
  const state=window.DuneApp?.getState?.();
  if (!state?.playerMode && !state?.strictReadOnly && new URLSearchParams(location.search).has('owl-editor')) {
    const choice=await offer('OWLBEAR');if (!choice) return;
  }
  window.parent.postMessage(packet('go-map'),location.origin);
}
export function installScreenControls() {
  window.ArchivesScreenControl={leaveToMap,send:sendScreenCommand};
}
window.addEventListener('message',event => {
  if (event.source!==window.parent || event.origin!==location.origin || !isPacket(event.data)) return;
  const data=event.data;
  if (data.type==='owl-editor-init' && typeof data.scope==='string') {
    scope=data.scope;
    function whenReady(){
      if([...document.querySelectorAll('.archives-bridge-notice')].some(el=>!el.hidden)){entryTimer=setTimeout(whenReady,100);return;}
      void offer('ARCHIVES').catch(error=>notice(error.message));
    }
    entryTimer=setTimeout(whenReady,0);
  } else if (data.type==='owl-screen-result') {
    const entry=pending.get(data.id);if (!entry) return;pending.delete(data.id);clearTimeout(entry.timer);
    if (data.safe) entry.resolve(data.result);else entry.reject(Error(data.message || 'Demande de changement d’écran refusée.'));
  }
});
window.addEventListener('resize',positionPanel);
window.addEventListener('pagehide',()=>clearTimeout(entryTimer),{once:true});
