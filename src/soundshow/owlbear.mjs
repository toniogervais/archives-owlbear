import {localRoom,roomMembers} from '../v57/room.mjs';
import {validSession,sameSession,soundShowChannel,soundShowModal} from './protocol.mjs';
import {SoundShowConnection} from './connection.mjs?v=014';
import {isPacket,packet} from '../v56/link.mjs';
export async function installSoundShow(OBR) {
  const {channel,connectionId:initial}=await localRoom(OBR),member=roomMembers(OBR);
  let role=await OBR.player.getRole(),connectionId=initial,session=null,owner='',watcher,lastCue='',closed=false;
  let requestTimer,requestSerial=0,requestAttempts=0;
  let mainWindow,mainTimer,mainAttempts=0;
  let viewOpen=false,viewToken='',modalQueue=Promise.resolve(),sessionEpoch=0;
  const receivers=new Map();
  const send=data=>OBR.broadcast.sendMessage(soundShowChannel,data);
  const viewerSession=()=>channel.postMessage({type:'soundshow-viewer-session',session});
  const playerReport=state=>{if(role==='PLAYER'&&session)void send({type:'player-status',peer:session.peer,state}).catch(console.warn);};
  async function roomStats(){
    let participants;
    try{participants=(await OBR.party.getPlayers()).filter(player=>player.role==='PLAYER');}
    catch{return {players:null,ready:0,connecting:0,error:0};}
    const states=participants.map(player=>receivers.get(player.connectionId));
    return {players:participants.length,ready:states.filter(state=>state==='ready').length,
      connecting:states.filter(state=>state==='connecting').length,error:states.filter(state=>state==='error').length};
  }
  async function notifyRoom(){if(role==='GM')channel.postMessage({type:'soundshow-room-status',...await roomStats()});}
  function closeView(){
    lastCue='';
    modalQueue=modalQueue.catch(()=>{}).then(async()=>{viewOpen=false;viewToken='';try{await OBR.modal.close(soundShowModal);}catch{}});
    return modalQueue;
  }
  function openView(){
    modalQueue=modalQueue.catch(()=>{}).then(async()=>{
      if(closed||role!=='PLAYER'||!session||viewOpen)return;
      const token=crypto.randomUUID(),url=new URL('../../soundshow-player.html',import.meta.url);
      url.searchParams.set('v','015');url.searchParams.set('viewer',token);viewToken=token;
      try{
        await OBR.modal.open({id:soundShowModal,url:url.href,width:780,height:500,hideBackdrop:true,hidePaper:true});
        if(viewToken===token)viewOpen=true;
      }catch(error){
        viewToken='';viewOpen=false;lastCue='';
        console.warn('SoundShow : ouverture du lecteur impossible',error);
        void OBR.notification.show('SoundShow : le lecteur n’a pas pu s’ouvrir. Demande au MJ de relier les joueurs à nouveau.','ERROR').catch(console.warn);
      }
    });
    return modalQueue;
  }
  async function receiveSession(value,sender='',reopen=false) {
    if(value!==null&&!validSession(value))return;
    if(sameSession(value,session)){if(reopen&&value&&role==='PLAYER'){await openView();channel.postMessage({type:'soundshow-viewer-report'});}return;}
    const epoch=++sessionEpoch;
    watcher?.stop();watcher=null;session=value;owner=sender;lastCue='';viewerSession();
    if(role!=='PLAYER'||!value){await closeView();return;}
    // Show the receiving frame before trying the hidden background connection.
    // The visible reader can connect independently and show network errors.
    await openView();
    if(closed||role!=='PLAYER'||epoch!==sessionEpoch||!sameSession(value,session))return;
    watcher=new SoundShowConnection({mode:'watch',onPlayback:data=>{
      if(closed||role!=='PLAYER')return;
      if(!data.active){if(lastCue)void closeView();return;}
      if(lastCue===data.id)return;lastCue=data.id;
      void openView();
    }});
    await watcher.use(value);
  }
  async function request(){
    clearTimeout(requestTimer);if(closed||role!=='PLAYER')return;
    const serial=++requestSerial;requestAttempts++;
    try{await send({type:'session-request'});}catch{}
    // Owlbear's subscription may not be active when a newly joined player asks.
    if(!closed&&role==='PLAYER'&&requestSerial===serial&&requestAttempts<6)
      requestTimer=setTimeout(()=>void request(),Math.min(800*2**(requestAttempts-1),6000));
  }
  channel.addEventListener('message',event=>{
    const data=event.data;
    if(data?.type==='soundshow-viewer-ready'&&role==='PLAYER')viewerSession();
    if(data?.type==='soundshow-viewer-status'&&role==='PLAYER'&&data.viewer===viewToken&&['ready','connecting','error'].includes(data.state))playerReport(data.state);
    if(data?.type==='soundshow-viewer-closed'&&role==='PLAYER'&&data.viewer===viewToken){viewOpen=false;viewToken='';playerReport('closed');}
    if(!data||!['soundshow-set','soundshow-get'].includes(data.type)||typeof data.id!=='string'||data.id.length>100)return;
    void(async()=>{
      if(closed||role!=='GM'||await OBR.player.getRole()!=='GM')throw Error('Commande réservée au maître de jeu.');
      if(data.type==='soundshow-set'){
        if(data.session!==null&&!validSession(data.session))throw Error('Code SoundShow invalide.');
        session=data.session?{version:1,peer:data.session.peer,secret:data.session.secret}:null;
        receivers.clear();await send({type:'session',session,reopen:true});await notifyRoom();
        try{mainWindow?.postMessage(packet('soundshow-main-update',{session,roomId:OBR.room.id}),location.origin);}catch{}
      }
      channel.postMessage({type:'soundshow-result',id:data.id,safe:true,session,...await roomStats()});
    })().catch(error=>channel.postMessage({type:'soundshow-result',id:data.id,safe:false,message:error.message}));
  });
  const offBroadcast=OBR.broadcast.onMessage(soundShowChannel,event=>{void(async()=>{
    const data=event.data;if(closed||!data)return;
    if(role==='GM'&&data.type==='player-status'&&session&&data.peer===session.peer&&['ready','connecting','error','closed'].includes(data.state)&&await member(event.connectionId,'PLAYER')&&await OBR.player.getRole()==='GM'){
      receivers.set(event.connectionId,data.state);await notifyRoom();return;
    }
    if(role==='GM'&&data.type==='session-request'&&await member(event.connectionId,'PLAYER')&&await OBR.player.getRole()==='GM'){
      await send({type:'session',session,to:event.connectionId});
    }else if(role==='PLAYER'&&data.type==='session'&&(!data.to||data.to===connectionId)&&await member(event.connectionId,'GM')&&await OBR.player.getRole()==='PLAYER'){
      requestSerial++;requestAttempts=0;clearTimeout(requestTimer);
      await receiveSession(data.session,event.connectionId,data.reopen===true);
    }
  })().catch(console.warn);});
  const offParty=OBR.party.onChange(players=>{if(role==='GM')void notifyRoom().catch(console.warn);if(role==='PLAYER'&&owner&&!players.some(player=>player.connectionId===owner&&player.role==='GM'))void receiveSession(null);});
  const offRole=OBR.player.onChange(player=>{if(player.connectionId)connectionId=player.connectionId;if(role===player.role)return;role=player.role;receivers.clear();requestSerial++;requestAttempts=0;clearTimeout(requestTimer);void receiveSession(null);void request().catch(console.warn);});
  const refresh=()=>{requestAttempts=0;void request().catch(console.warn);};window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
  function askMain(){
    if(closed||role!=='GM')return;
    try{
      const opener=window.top.opener;
      if(opener&&opener.location.origin===location.origin&&/\/archives-app-v64-v55\.html$/.test(opener.location.pathname)){
        mainWindow=opener;opener.postMessage(packet('soundshow-main-request',{roomId:OBR.room.id}),location.origin);
        if(mainAttempts++<4)mainTimer=setTimeout(askMain,1000);
      }
    }catch{}
  }
  function fromMain(event){
    const data=event.data;
    if(closed||role!=='GM'||event.source!==mainWindow||event.origin!==location.origin||!isPacket(data)||data.type!=='soundshow-main-session'||data.roomId!==OBR.room.id||data.session!==null&&!validSession(data.session))return;
    clearTimeout(mainTimer);
    void(async()=>{if(await OBR.player.getRole()!=='GM'||closed)return;session=data.session;receivers.clear();await send({type:'session',session,reopen:true});await notifyRoom();})().catch(console.warn);
  }
  window.addEventListener('message',fromMain);askMain();
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(requestTimer);clearTimeout(mainTimer);watcher?.stop();member.dispose();offBroadcast?.();offParty?.();offRole?.();channel.close();window.removeEventListener('message',fromMain);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);},{once:true});
  await request();
}
