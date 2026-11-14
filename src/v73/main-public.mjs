// A GM keeping the main Archives open must publish without opening a second
// editor inside Owlbear. Only the sender's explicit public projection is used.
import {editEvent,isPacket,packet,validRoomId,validSession} from '../v56/link.mjs?v=4500';
export function installMainPublic(api) {
  let background,room='',session='',timer,closed=false;
  const canPublish=()=>{const state=window.DuneApp?.getState?.();return state&&!state.playerMode&&!state.strictReadOnly};
  function publish(){
    clearTimeout(timer);if(closed||!background||!canPublish())return;
    const payload=api.publicView();
    background.postMessage(packet('archives-main-public',{roomId:room,session,payload}),location.origin);
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.origin!==location.origin||!isPacket(data)||data.type!=='archives-main-public-ready'||!validRoomId(data.roomId)||!validSession(data.session)||!canPublish()||
      !window.ArchivesOwlbearBridge?.authorizeSoundShowFrame?.(event.source,data.roomId))return;
    const changed=background!==event.source||room!==data.roomId||session!==data.session;
    background=event.source;room=data.roomId;session=data.session;
    background.postMessage(packet('archives-main-public-ack',{roomId:room,session}),location.origin);if(changed)publish();
  });
  const schedule=()=>{if(!closed&&canPublish()){clearTimeout(timer);timer=setTimeout(publish,120)}};
  window.addEventListener(editEvent,schedule);window.addEventListener('archives:public-view',schedule);
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer)},{once:true});
}
