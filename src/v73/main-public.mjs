// A GM keeping the main Archives open must publish without opening a second
// editor inside Owlbear. Only the sender's explicit public projection is used.
import {editEvent,isPacket,packet,validRoomId,validSession} from '../v56/link.mjs?v=4510';
export function installMainPublic(api) {
  let background,room='',session='',timer,closed=false;
  const requests=new Map();
  window.ArchivesPresentationBridge={
    get connected(){return !closed&&!!background},
    request(command){
      if(closed||!background||!canPublish())return Promise.reject(Error('Ouvre Owlbear depuis les Archives pour relier la salle.'));
      const id=crypto.randomUUID();
      return new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{requests.delete(id);reject(Error('La présentation ne répond pas. Vérifie que la salle Owlbear est ouverte.'))},20000);
        requests.set(id,{resolve,reject,timeout});
        background.postMessage(packet('archives-main-image',{roomId:room,session,id,command}),location.origin);
      });
    }
  };
  const canPublish=()=>{const state=window.DuneApp?.getState?.();return state&&!state.playerMode&&!state.strictReadOnly};
  function publish(){
    clearTimeout(timer);if(closed||!background||!canPublish())return;
    const payload=api.publicView();
    background.postMessage(packet('archives-main-public',{roomId:room,session,payload}),location.origin);
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(!closed&&event.source===background&&event.origin===location.origin&&isPacket(data)&&data.type==='archives-main-image-result'&&data.roomId===room&&data.session===session){
      const entry=requests.get(data.id);if(!entry)return;
      requests.delete(data.id);clearTimeout(entry.timeout);
      if(data.safe)entry.resolve(data.result);else entry.reject(Error(data.message||'La présentation a échoué.'));
      return;
    }
    if(event.origin!==location.origin||!isPacket(data)||data.type!=='archives-main-public-ready'||!validRoomId(data.roomId)||!validSession(data.session)||!canPublish()||
      !window.ArchivesOwlbearBridge?.authorizeSoundShowFrame?.(event.source,data.roomId))return;
    const changed=background!==event.source||room!==data.roomId||session!==data.session;
    background=event.source;room=data.roomId;session=data.session;
    background.postMessage(packet('archives-main-public-ack',{roomId:room,session}),location.origin);if(changed)publish();
  });
  const schedule=()=>{if(!closed&&canPublish()){clearTimeout(timer);timer=setTimeout(publish,120)}};
  window.addEventListener(editEvent,schedule);window.addEventListener('archives:public-view',schedule);
  window.addEventListener('archives:presentation',schedule);
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer);for(const entry of requests.values()){clearTimeout(entry.timeout);entry.reject(Error('Les Archives ont été fermées.'))}requests.clear()},{once:true});
}
