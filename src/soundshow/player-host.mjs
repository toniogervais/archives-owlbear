import {localRoom} from '../v57/room.mjs';
import {validSession} from './protocol.mjs';

// Only the player's own, same-origin Archives frame talks to this relay.
// SoundShow credentials still come from the background's verified GM broadcast.
export async function makeSoundShowPlayerHost(OBR,post,canRead) {
  if(await OBR.player.getRole()!=='PLAYER')throw Error('Lecteur réservé aux joueurs.');
  const {channel}=await localRoom(OBR),viewer=crypto.randomUUID();
  let disposed=false,ready=false,timer;
  const presence=()=>{
    if(!disposed&&ready&&canRead())channel.postMessage({type:'soundshow-archives-open',viewer});
  };
  channel.addEventListener('message',event=>{
    const data=event.data;
    if(disposed||!ready||!canRead()||data?.type!=='soundshow-archives-session'||data.viewer!==viewer||
       data.session!==null&&!validSession(data.session))return;
    post('owl-soundshow-player-session',{session:data.session,reopen:data.reopen===true});
  });
  return {
    receive(data){
      if(disposed||!canRead())return;
      if(data.type==='owl-soundshow-player-ready'){
        if(!ready){ready=true;timer=setInterval(presence,4000);}
        presence();
      }else if(ready&&data.type==='owl-soundshow-player-status'&&
        ['ready','connecting','error','playing','blocked','closed'].includes(data.state)){
        channel.postMessage({type:'soundshow-archives-status',viewer,state:data.state});
      }
    },
    dispose(){
      if(disposed)return;disposed=true;clearInterval(timer);
      if(ready)channel.postMessage({type:'soundshow-archives-closed',viewer});
      channel.close();
    }
  };
}
