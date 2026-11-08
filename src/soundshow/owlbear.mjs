import {localRoom,roomMembers} from '../v57/room.mjs';
import {validSession,sameSession,soundShowChannel,soundShowModal} from './protocol.mjs';
import {SoundShowConnection} from './connection.mjs';
export async function installSoundShow(OBR) {
  const {channel,connectionId:initial}=await localRoom(OBR),member=roomMembers(OBR);
  let role=await OBR.player.getRole(),connectionId=initial,session=null,owner='',watcher,lastCue='',closed=false;
  const send=data=>OBR.broadcast.sendMessage(soundShowChannel,data);
  const viewerSession=()=>channel.postMessage({type:'soundshow-viewer-session',session});
  async function closeView(){lastCue='';try{await OBR.modal.close(soundShowModal);}catch{}}
  async function receiveSession(value,sender='') {
    if(value!==null&&!validSession(value))return;
    if(sameSession(value,session))return;
    watcher?.stop();watcher=null;session=value;owner=sender;lastCue='';viewerSession();
    if(role!=='PLAYER'||!value){await closeView();return;}
    watcher=new SoundShowConnection({mode:'watch',onPlayback:data=>{
      if(closed||role!=='PLAYER')return;
      if(!data.active){void closeView();return;}
      if(lastCue===data.id)return;lastCue=data.id;
      void OBR.modal.open({id:soundShowModal,url:new URL('../../soundshow-player.html',import.meta.url).href,
        fullScreen:true,hideBackdrop:true,hidePaper:true}).catch(()=>{lastCue='';});
    }});
    await watcher.use(value);
  }
  async function request(){if(!closed&&role==='PLAYER')await send({type:'session-request'});}
  channel.addEventListener('message',event=>{
    const data=event.data;
    if(data?.type==='soundshow-viewer-ready'&&role==='PLAYER')viewerSession();
    if(!data||!['soundshow-set','soundshow-get'].includes(data.type)||typeof data.id!=='string'||data.id.length>100)return;
    void(async()=>{
      if(closed||role!=='GM'||await OBR.player.getRole()!=='GM')throw Error('Commande réservée au maître de jeu.');
      if(data.type==='soundshow-set'){
        if(data.session!==null&&!validSession(data.session))throw Error('Code SoundShow invalide.');
        session=data.session?{version:1,peer:data.session.peer,secret:data.session.secret}:null;
        await send({type:'session',session});
      }
      channel.postMessage({type:'soundshow-result',id:data.id,safe:true,session});
    })().catch(error=>channel.postMessage({type:'soundshow-result',id:data.id,safe:false,message:error.message}));
  });
  const offBroadcast=OBR.broadcast.onMessage(soundShowChannel,event=>{void(async()=>{
    const data=event.data;if(closed||!data)return;
    if(role==='GM'&&data.type==='session-request'&&await member(event.connectionId,'PLAYER')&&await OBR.player.getRole()==='GM'){
      await send({type:'session',session,to:event.connectionId});
    }else if(role==='PLAYER'&&data.type==='session'&&(!data.to||data.to===connectionId)&&await member(event.connectionId,'GM')&&await OBR.player.getRole()==='PLAYER'){
      await receiveSession(data.session,event.connectionId);
    }
  })().catch(console.warn);});
  const offParty=OBR.party.onChange(players=>{if(role==='PLAYER'&&owner&&!players.some(player=>player.connectionId===owner&&player.role==='GM'))void receiveSession(null);});
  const offRole=OBR.player.onChange(player=>{if(player.connectionId)connectionId=player.connectionId;if(role===player.role)return;role=player.role;void receiveSession(null);void request().catch(console.warn);});
  const refresh=()=>{void request().catch(console.warn);};window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
  window.addEventListener('pagehide',()=>{closed=true;watcher?.stop();member.dispose();offBroadcast?.();offParty?.();offRole?.();channel.close();window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);},{once:true});
  await request();
}
