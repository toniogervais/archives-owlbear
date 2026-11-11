import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {trustedOwlbearSdk} from '../v56/link.mjs';
import {localRoom} from '../v57/room.mjs';
import {soundShowModal,validSession} from './protocol.mjs';
import {mountPlayer} from './player.mjs?v=4400';
if(trustedOwlbearSdk()){
  document.documentElement.classList.add('soundshow-obr-frame');
  await new Promise(resolve=>OBR.onReady(resolve));
  if(await OBR.player.getRole()==='PLAYER'){
    const {channel}=await localRoom(OBR);
    const viewer=new URLSearchParams(location.search).get('viewer');
    const closed=()=>channel.postMessage({type:'soundshow-viewer-closed',viewer});
    let lastState='connecting';
    const report=()=>channel.postMessage({type:'soundshow-viewer-status',viewer,state:lastState});
    const player=mountPlayer({showWaiting:true,onState:state=>{lastState=state;report();},close:()=>{closed();void OBR.modal.close(soundShowModal).catch(console.warn);}});
    document.getElementById('waiting')?.remove();
    channel.onmessage=event=>{if(event.data?.type==='soundshow-viewer-session'&&(event.data.session===null||validSession(event.data.session)))void player.use(event.data.session);else if(event.data?.type==='soundshow-viewer-report')report();};
    channel.postMessage({type:'soundshow-viewer-ready'});
    OBR.player.onChange(value=>{if(value.role!=='PLAYER'){player.destroy();void OBR.modal.close(soundShowModal).catch(console.warn);}});
    window.addEventListener('pagehide',()=>{closed();player.destroy();channel.close();},{once:true});
  }
}else document.getElementById('waiting').textContent='Ouvre ce lecteur depuis ta salle Owlbear.';
