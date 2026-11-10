/* V4.31 — commandes de transfert depuis l'onglet Archives principal.
   N'accepte que le background Owlbear déjà lié à cet onglet par le MJ. */
import {isPacket,packet,validRoomId,validSession} from '../v56/link.mjs?v=4210';

const pending=new Map();
let background=null,roomId='',lastSeen=0;

function allowed(event,data) {
  if(event.origin!==location.origin||!isPacket(data)||!validRoomId(data.roomId))return false;
  const bridge=window.ArchivesOwlbearBridge;
  return !!bridge?.authorizeSoundShowFrame?.(event.source,data.roomId);
}
function resolvePending(id,data){
  const entry=pending.get(id);
  if(!entry)return;
  pending.delete(id);clearTimeout(entry.timer);
  if(data.safe)entry.resolve(data.result);
  else entry.reject(Error(data.message||'Le transfert vers Owlbear a échoué.'));
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(!allowed(event,data))return;
  if(data.type==='artwork-main-ready'){
    // A GM background opened from the primary Archives main tab.
    background=event.source;roomId=data.roomId;lastSeen=Date.now();
    background.postMessage(packet('artwork-main-ack',{roomId}),location.origin);
  }else if(event.source===background&&data.roomId===roomId){
    lastSeen=Date.now();
    if(data.type==='artwork-main-progress'&&validSession(data.id))
      pending.get(data.id)?.report?.(String(data.message||''));
    else if(data.type==='artwork-main-result'&&validSession(data.id))resolvePending(data.id,data);
  }
});
export function requestDirectOwlbear(command,report) {
  const state=window.DuneApp?.getState?.();
  if(!state||state.playerMode||state.strictReadOnly)
    return Promise.reject(Error('Transfert réservé au maître de jeu.'));
  if(!background||!roomId||Date.now()-lastSeen>20*60*1000)
    return Promise.reject(Error('La salle Owlbear n’est pas reliée. Ouvre Owlbear depuis les Archives et garde sa fenêtre ouverte.'));
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      pending.delete(id);reject(Error('Owlbear ne répond pas. Vérifie que la salle est ouverte.'));
    },180000);
    pending.set(id,{resolve,reject,timer,report});
    try{background.postMessage(packet('artwork-main-command',{roomId,id,command}),location.origin);}
    catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
  });
}
window.ArchivesTokenBridge={
  request:requestDirectOwlbear,
  get connected(){return !!background&&!!roomId&&Date.now()-lastSeen<20*60*1000;}
};
