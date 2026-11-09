import {localRoom,roomMembers} from '../v57/room.mjs';
import {validSession,sameSession,soundShowChannel,soundShowModal,validLocalBridgeOrigin,owlbearLinkProtocol} from './protocol.mjs?v=016';
import {SoundShowConnection} from './connection.mjs?v=014';
import {isPacket,packet} from '../v56/link.mjs';
export async function installSoundShow(OBR) {
  const {channel,connectionId:initial}=await localRoom(OBR),member=roomMembers(OBR);
  let role=await OBR.player.getRole(),connectionId=initial,session=null,owner='',watcher,lastCue='',closed=false;
  let requestTimer,requestSerial=0,requestAttempts=0;
  let mainWindow,mainTimer,mainAttempts=0;
  let viewOpen=false,viewToken='',modalQueue=Promise.resolve(),sessionEpoch=0;
  let localConnector=null,localChallenge=crypto.randomUUID(),localTimer=null,localLinkReady=false;
  let localControlToken='',localOrigin='',remoteState={connected:false,media:[],active:[]};
  const remotePending=new Map();
  const receivers=new Map();
  const send=data=>OBR.broadcast.sendMessage(soundShowChannel,data);
  function getLocalConnector(){
    try{
      // Only a tab that Owlbear itself was opened from may offer the local bridge.
      const opener=window.top.opener;
      if(!opener||opener.closed)return null;
      return opener;
    }catch{return null;}
  }
  async function linkLocalSession(value){
    if(closed||role!=='GM'||await OBR.player.getRole()!=='GM'||!validSession(value))return false;
    session={version:1,peer:value.peer,secret:value.secret};
    receivers.clear();
    await send({type:'session',session,reopen:true});
    await notifyRoom();
    channel.postMessage({type:'soundshow-room-session',session});
    // Le connecteur Windows peut établir une session différente de celle des Archives principales.
    // Mettre à jour le Salon Live pour les joueurs qui ne sont pas dans la vue Owlbear.
    try{mainWindow?.postMessage(packet('soundshow-main-update',{session,roomId:OBR.room.id}),location.origin);}catch{}
    return true;
  }
  function tryLocalConnector(){
    if(closed||role!=='GM'||localLinkReady)return;
    const opener=getLocalConnector();if(!opener)return;
    localConnector=opener;
    try{opener.postMessage({protocol:owlbearLinkProtocol,type:'request',challenge:localChallenge},'*');}
    catch{}
  }
  function receiveLocalConnector(event){
    const data=event.data;
    if(closed||role!=='GM'||data?.protocol!==owlbearLinkProtocol||
       event.source!==localConnector||!validLocalBridgeOrigin(event.origin))return;
    if(data.type==='offer'){
      if(data.challenge!==localChallenge||!validSession(data.session)||
         typeof data.controlToken!=='string'||!/^[0-9a-f-]{36}$/.test(data.controlToken))return;
      void(async()=>{
        if(!await linkLocalSession(data.session))return;
        localControlToken=data.controlToken;localOrigin=event.origin;
        localLinkReady=true;clearInterval(localTimer);localTimer=null;
        event.source.postMessage({protocol:owlbearLinkProtocol,type:'accepted',challenge:localChallenge},event.origin);
        void OBR.notification.show('SoundShow et sa télécommande sont reliés à Owlbear.','SUCCESS').catch(console.warn);
      })().catch(error=>console.warn('SoundShow : connexion automatique refusée',error));
    }else if(localLinkReady && event.origin===localOrigin && data.type==='remote-state'){
      const value=data.state;
      if(!value||typeof value!=='object'||!Array.isArray(value.media)||!Array.isArray(value.active))return;
      remoteState={connected:value.connected===true,simulation:value.simulation===true,
        project:String(value.project||'').slice(0,160),
        media:value.media.slice(0,500),active:value.active.slice(0,100),
        nextVolume:value.nextVolume};
      channel.postMessage({type:'soundshow-remote-state',state:remoteState});
    }else if(localLinkReady && event.origin===localOrigin && data.type==='remote-result'){
      const entry=remotePending.get(data.id);
      if(!entry)return;
      remotePending.delete(data.id);clearTimeout(entry);
      channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:data.ok===true,
        message:String(data.message||'').slice(0,200),state:remoteState});
    }
  }
  window.addEventListener('message',receiveLocalConnector);
  // The connector knows only the Owlbear tab; the installed Archives background
  // asks for the session from that tab's opener, never via a public room code.
  if(role==='GM'){
    tryLocalConnector();
    localTimer=setInterval(tryLocalConnector,1200);
  }
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
      url.searchParams.set('v','028');url.searchParams.set('viewer',token);viewToken=token;
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
      // Garder la fenêtre prête lorsque la vidéo se termine : le MJ pourra relancer sans reconnexion.
      if(!data.active)return;
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
    if(data?.type==='soundshow-remote-get'||data?.type==='soundshow-remote-command'){
      void(async()=>{
        if(closed||role!=='GM'||await OBR.player.getRole()!=='GM')return;
        if(typeof data.id!=='string'||!/^[0-9a-f-]{36}$/.test(data.id))return;
        if(data.type==='soundshow-remote-get'){
          channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:true,state:remoteState});
          return;
        }
        if(!localLinkReady||!localConnector||!localControlToken||!remoteState.connected){
          channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:false,
            message:'SoundShow n’est pas relié. Ouvre Owlbear depuis le connecteur Windows.',state:remoteState});
          return;
        }
        const allowed=['play_playable','toggle_player_playback','stop_player','fade_out_player',
          'set_player_volume','set_next_sound_volume','toggle_player_loop','seek_player',
          'pause_all','resume_all','stop_all','fade_out_all'];
        if(!data.command||!allowed.includes(data.command.type)){
          channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:false,
            message:'Commande non autorisée.',state:remoteState});return;
        }
        const timeout=setTimeout(()=>{
          remotePending.delete(data.id);
          channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:false,
            message:'Le connecteur SoundShow ne répond pas. Aucune relance automatique.',state:remoteState});
        },10000);
        remotePending.set(data.id,timeout);
        try{
          localConnector.postMessage({protocol:owlbearLinkProtocol,type:'remote-command',
            challenge:localChallenge,controlToken:localControlToken,id:data.id,command:data.command},localOrigin);
        }catch(error){
          clearTimeout(timeout);remotePending.delete(data.id);
          channel.postMessage({type:'soundshow-remote-result',id:data.id,safe:false,
            message:'Le connecteur Windows est inaccessible.',state:remoteState});
        }
      })().catch(console.warn);
      return;
    }
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
  const offRole=OBR.player.onChange(player=>{
    if(player.connectionId)connectionId=player.connectionId;
    if(role===player.role)return;
    role=player.role;receivers.clear();requestSerial++;requestAttempts=0;clearTimeout(requestTimer);
    localLinkReady=false;localControlToken='';localOrigin='';remoteState={connected:false,media:[],active:[]};clearInterval(localTimer);localTimer=null;
    if(role==='GM'){tryLocalConnector();localTimer=setInterval(tryLocalConnector,1200);}
    void receiveSession(null);void request().catch(console.warn);
  });
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
    void(async()=>{
      if(await OBR.player.getRole()!=='GM'||closed)return;
      if(localLinkReady&&validSession(session)){
        // Ne pas écraser la connexion automatique active par une ancienne session vide du Salon Live.
        if(!sameSession(data.session,session))try{mainWindow?.postMessage(packet('soundshow-main-update',{session,roomId:OBR.room.id}),location.origin);}catch{}
        return;
      }
      session=data.session;receivers.clear();await send({type:'session',session,reopen:true});await notifyRoom();
    })().catch(console.warn);
  }
  window.addEventListener('message',fromMain);askMain();
  window.addEventListener('pagehide',()=>{
    closed=true;clearTimeout(requestTimer);clearTimeout(mainTimer);clearInterval(localTimer);
    for(const timer of remotePending.values())clearTimeout(timer);remotePending.clear();
    watcher?.stop();member.dispose();offBroadcast?.();offParty?.();offRole?.();channel.close();
    window.removeEventListener('message',fromMain);
    window.removeEventListener('message',receiveLocalConnector);
    window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);
  },{once:true});
  await request();
}
