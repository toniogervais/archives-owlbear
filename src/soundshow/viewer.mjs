import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {trustedOwlbearSdk} from '../v56/link.mjs';
import {localRoom} from '../v57/room.mjs';
import {soundShowModal,validSession} from './protocol.mjs';
import {mountPlayer} from './player.mjs';
if(trustedOwlbearSdk()){
  await new Promise(resolve=>OBR.onReady(resolve));
  if(await OBR.player.getRole()==='PLAYER'){
    const {channel}=await localRoom(OBR);
    const player=mountPlayer({close:()=>{void OBR.modal.close(soundShowModal).catch(console.warn);}});
    channel.onmessage=event=>{if(event.data?.type==='soundshow-viewer-session'&&(event.data.session===null||validSession(event.data.session)))void player.use(event.data.session);};
    channel.postMessage({type:'soundshow-viewer-ready'});
    OBR.player.onChange(value=>{if(value.role!=='PLAYER'){player.destroy();void OBR.modal.close(soundShowModal).catch(console.warn);}});
    window.addEventListener('pagehide',()=>{player.destroy();channel.close();},{once:true});
  }
}else document.getElementById('waiting').textContent='Ouvre ce lecteur depuis ta salle Owlbear.';
