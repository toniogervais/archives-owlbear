import {button,element,isGM,notice,requireGM,sheet} from '../v63/ui.mjs';
import {isPacket,packet} from '../v56/link.mjs';
import {decodeSession,encodeSession,validSession} from './protocol.mjs';
let session=null,player;const pending=new Map();
const embedded=window.parent!==window;
async function request(type,value) {
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('La salle ne répond pas. Recharge Owlbear puis réessaie.'));},12000);
    pending.set(id,{resolve,reject,timer});window.parent.postMessage(packet(type,{id,session:value}),location.origin);
  });
}
async function publish(value) {
  requireGM();
  if(embedded){const result=await request('owl-soundshow-command',value);session=result.session;}
  else{session=value;window.ArchivesLiveInvitations?.publishSoundShow(value);}
}
function open() {
  try {
    requireGM();const view=sheet('archives-soundshow','SoundShow · vidéos des joueurs');
    view.content.append(element('p','Lance le connecteur sur ton PC, associe tes vidéos puis colle son code ici. Pendant la partie, déclenche les vidéos directement dans SoundShow.','studio-hint'));
    const download=element('a','Télécharger le connecteur Windows');download.href='https://github.com/toniogervais/archives-owlbear/releases/tag/soundshow-bridge-v0.1.0';download.target='_blank';download.rel='noopener';view.content.append(download);
    const label=element('label','Code de connexion SoundShow'),input=element('input');input.type='password';input.autocomplete='off';input.placeholder='SS2.…';input.setAttribute('aria-label','Code de connexion SoundShow');input.value=session?encodeSession(session):'';label.append(input);view.content.append(label);
    const actions=element('div',null,'studio-actions');
    actions.append(button('Relier les joueurs',async()=>{try{view.busy(true);await publish(decodeSession(input.value));view.status.textContent='Code transmis. Les vidéos associées se présenteront quand tu les lanceras dans SoundShow.';}catch(error){view.status.textContent=error.message;}finally{view.busy(false);}}),
      button('Déconnecter',async()=>{try{view.busy(true);await publish(null);input.value='';view.status.textContent='Diffusion SoundShow déconnectée.';}catch(error){view.status.textContent=error.message;}finally{view.busy(false);}}));
    view.content.append(actions,element('p','Le lecteur peut demander aux joueurs d’autoriser l’image et le son. Le connecteur et son onglet doivent rester ouverts.','studio-hint'));
    let edited=false;input.addEventListener('input',()=>{edited=true;});
    if(embedded)void request('owl-soundshow-query').then(result=>{if(!edited){session=result.session;if(view.dialog.isConnected)input.value=session?encodeSession(session):'';}}).catch(error=>{if(view.dialog.isConnected)view.status.textContent=error.message;});
  }catch(error){notice(error.message);}
}
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||!isPacket(event.data)||event.data.type!=='owl-soundshow-result')return;
  const entry=pending.get(event.data.id);if(!entry)return;pending.delete(event.data.id);clearTimeout(entry.timer);
  if(event.data.safe&&(event.data.session===null||validSession(event.data.session)))entry.resolve(event.data);else entry.reject(Error(event.data.message||'La connexion SoundShow a échoué.'));
});
window.addEventListener('archives:soundshow-session',event=>{
  if(isGM()||embedded)return;
  const value=event.detail?.session;if(value!==null&&!validSession(value))return;
  void(async()=>{if(!player){const {mountPlayer}=await import('./player.mjs');player=mountPlayer();}await player.use(value);})().catch(error=>notice(error.message));
});
const control=document.querySelector('.canvas-integration-icon[aria-label^="Sound Show"]');
if(control){
  control.disabled=false;control.id='archives-soundshow-open';control.setAttribute('aria-label','SoundShow : diffuser les vidéos');control.parentElement.title='SoundShow : connexion et vidéos des joueurs';control.onclick=open;
  const refresh=()=>{control.parentElement.hidden=!isGM();};refresh();
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
}
window.ArchivesSoundShow={open,session:()=>session};
window.addEventListener('pagehide',()=>player?.destroy(),{once:true});
