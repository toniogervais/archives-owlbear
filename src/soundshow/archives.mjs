import {button,element,isGM,notice,requireGM,sheet} from '../v63/ui.mjs';
import {isPacket,packet} from '../v56/link.mjs';
import {decodeSession,encodeSession,validSession} from './protocol.mjs?v=017';
import {mountRemote} from './remote.mjs?v=017';
import {mountSoundDock} from './sounds-dock.mjs?v=4400';
import {mountCellMedia} from './cell-media.mjs?v=027';
let session=null,player,liveSession=null,infoView=null;const pending=new Map(),roomFrames=new Map();
const embedded=window.parent!==window;
let remoteUi=null,linkInfoView=null,soundsDock=null,cellMedia=null,remoteState=null,audienceState=null;
let playerLoading=null,playerEpoch=0,playerReadyTimer;
async function usePlayerSession(value,reopen=false){
  if(isGM()||value!==null&&!validSession(value))return;
  liveSession=value;const epoch=++playerEpoch;
  if(!value&&!player&&!playerLoading)return;
  if(!playerLoading)playerLoading=import('./player.mjs?v=4410').then(({mountPlayer})=>{
    player=mountPlayer({onState:state=>{
      if(embedded&&!isGM())window.parent.postMessage(packet('owl-soundshow-player-status',{state}),location.origin);
    }});return player;
  }).catch(error=>{playerLoading=null;throw error;});
  const reader=await playerLoading;
  if(epoch!==playerEpoch||isGM())return;
  await reader.use(value);if(reopen)reader.reopen();
}
async function request(type,value) {
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('La salle ne répond pas. Recharge Owlbear puis réessaie.'));},12000);
    pending.set(id,{resolve,reject,timer});window.parent.postMessage(packet(type,
      type==='owl-soundshow-remote-command'?{id,command:value}:{id,session:value}),location.origin);
  });
}
async function publish(value) {
  requireGM();
  if(embedded){const result=await request('owl-soundshow-command',value);session=result.session;return result;}
  else{
    session=value;window.ArchivesLiveInvitations?.publishSoundShow(value);
    for(const [frame,roomId] of roomFrames){
      if(window.ArchivesOwlbearBridge?.authorizeSoundShowFrame(frame,roomId))frame.postMessage(packet('soundshow-main-session',{session,roomId}),location.origin);
      else roomFrames.delete(frame);
    }
    return {rooms:roomFrames.size};
  }
}
function open() {
  try {
    requireGM();const view=sheet('archives-soundshow','SoundShow · télécommande');
    remoteUi?.destroy();remoteUi=null;
    if(embedded){
      const remoteHost=element('div');
      view.content.append(remoteHost);
      remoteUi=mountRemote(remoteHost,async command=>{
        const result=await request('owl-soundshow-remote-command',command);
        if(result.state)remoteUi?.update(result.state);
        return result;
      });
      const refresh=()=>void request('owl-soundshow-remote-get').then(value=>{
        if(view.dialog.isConnected&&value.state)remoteUi?.update(value.state);
      }).catch(error=>{if(view.dialog.isConnected)view.status.textContent=error.message;});
      refresh();const timer=setInterval(refresh,4000);
      view.cleanup(()=>{clearInterval(timer);remoteUi?.destroy();remoteUi=null;});
    }
    view.content.append(element('p','SoundShow se relie depuis Owlbear : ouvre Owlbear à partir du connecteur Windows, puis entre dans ta salle MJ. L’extension Les Archives relie les joueurs automatiquement. Aucun onglet Archives séparé.','studio-hint'));
    const simpleStatus=element('p',session?'SoundShow relié. Les prochaines vidéos s’ouvriront dans une fenêtre des Archives ou d’Owlbear.':'En attente du connecteur SoundShow. Aucun code à recopier.','studio-status');simpleStatus.setAttribute('role','status');linkInfoView=simpleStatus;view.content.append(simpleStatus);
    const download=element('a','Télécharger le connecteur Windows');download.href='https://github.com/toniogervais/archives-owlbear/releases/download/soundshow-bridge-v0.3.3/Archives-SoundShow-Connecteur.exe';download.target='_blank';download.rel='noopener';view.content.append(download);
    const advanced=element('details');const summary=element('summary','Dépannage : connexion manuelle avec un code');advanced.append(summary);
    const label=element('label','Code de connexion SoundShow'),input=element('input');input.type='password';input.autocomplete='off';input.placeholder='SS2.…';input.setAttribute('aria-label','Code de connexion SoundShow');input.value=session?encodeSession(session):'';label.append(input);advanced.append(label);
    const info=element('p',null,'studio-hint');info.id='soundshow-room-status';info.setAttribute('role','status');infoView=info;
    function connectionInfo(result){
      if(Number.isInteger(result?.players))info.textContent=result.players+' joueur(s) dans cette salle Owlbear · '+(result.ready||0)+' lecteur(s) relié(s) au connecteur.'+(result.players===0?' La tablette doit rejoindre cette salle avec le rôle Joueur.':result.ready===result.players?' Connexion confirmée ; vérifie la lecture de la vidéo.':result.error?' '+result.error+' lecteur(s) signale(nt) une erreur. Vérifie le message sur la tablette.':' Si le nombre ne progresse pas, vérifie le message sur la tablette.');
      else if(Number.isInteger(result?.rooms))info.textContent=result.rooms+' salle(s) Owlbear reliée(s) aux Archives principales.'+(result.rooms===0?' Pour cet essai, ouvre les Archives depuis le livre de ta salle Owlbear et relie SoundShow dans cette vue.':'');
    }
    const actions=element('div',null,'studio-actions');
    actions.append(button('Relier les joueurs',async()=>{try{view.busy(true);const result=await publish(decodeSession(input.value));connectionInfo(result);view.status.textContent='SoundShow relié. Lance maintenant tes vidéos dans SoundShow.';simpleStatus.textContent='SoundShow relié aux joueurs.';}catch(error){view.status.textContent=error.message;}finally{view.busy(false);}}),
      button('Déconnecter',async()=>{try{view.busy(true);await publish(null);input.value='';view.status.textContent='Diffusion SoundShow déconnectée.';simpleStatus.textContent='SoundShow déconnecté.';}catch(error){view.status.textContent=error.message;}finally{view.busy(false);}}));
    advanced.append(actions);view.content.append(info,advanced,element('p','La vidéo s’affiche dans une fenêtre intégrée. Les joueurs peuvent devoir autoriser le son la première fois. Le connecteur doit rester ouvert sur ton PC.','studio-hint'));
    let edited=false;input.addEventListener('input',()=>{edited=true;});
    if(embedded)void request('owl-soundshow-query').then(result=>{if(view.dialog.isConnected){connectionInfo(result);simpleStatus.textContent=result.session?'SoundShow est relié à cette salle Owlbear. Lance une vidéo dans SoundShow.':'SoundShow n’est pas encore relié : ouvre Owlbear depuis le connecteur Windows.';if(!edited){session=result.session;input.value=session?encodeSession(session):'';}}}).catch(error=>{if(view.dialog.isConnected)view.status.textContent=error.message;});
  }catch(error){notice(error.message);}
}
window.addEventListener('message',event=>{
  if(!embedded&&isGM()&&event.origin===location.origin&&isPacket(event.data)&&['soundshow-main-request','soundshow-main-update'].includes(event.data.type)){
    const data=event.data;
    if(!window.ArchivesOwlbearBridge?.authorizeSoundShowFrame(event.source,data.roomId))return;
    roomFrames.set(event.source,data.roomId);
    if(data.type==='soundshow-main-request')event.source.postMessage(packet('soundshow-main-session',{session,roomId:data.roomId}),location.origin);
    else if(data.session===null||validSession(data.session))void publish(data.session).catch(error=>notice(error.message));
    return;
  }
  if(event.source!==window.parent||event.origin!==location.origin||!isPacket(event.data))return;
  if(event.data.type==='owl-soundshow-player-session'){
    if(!isGM()&&(event.data.session===null||validSession(event.data.session))){
      clearInterval(playerReadyTimer);
      void usePlayerSession(event.data.session,event.data.reopen===true).catch(error=>notice(error.message));
    }
    return;
  }
  if(event.data.type==='owl-soundshow-status'){audienceState=event.data;soundsDock?.updateAudience(audienceState);if(infoView?.isConnected&&Number.isInteger(event.data.players)){const data=event.data;infoView.textContent=data.players+' joueur(s) dans cette salle Owlbear · '+(data.ready||0)+' lecteur(s) relié(s) au connecteur.'+(data.players===0?' La tablette doit rejoindre la salle avec le rôle Joueur.':data.ready===data.players?' Connexion confirmée ; vérifie la lecture de la vidéo.':data.error?' '+data.error+' lecteur(s) signale(nt) une erreur. Vérifie la tablette.':' Si le nombre ne progresse pas, vérifie le message sur la tablette.');}return;}
  if(event.data.type==='owl-soundshow-remote-state'){
    if(isGM()&&event.data.state){remoteState=event.data.state;remoteUi?.update(remoteState);soundsDock?.update(remoteState);}
    return;
  }
  if(!['owl-soundshow-result','owl-soundshow-remote-result'].includes(event.data.type))return;
  const entry=pending.get(event.data.id);if(!entry)return;pending.delete(event.data.id);clearTimeout(entry.timer);
  if(event.data.safe&&(event.data.type==='owl-soundshow-remote-result'||event.data.session===null||validSession(event.data.session)))entry.resolve(event.data);else entry.reject(Error(event.data.message||'La connexion SoundShow a échoué.'));
});
window.addEventListener('archives:soundshow-session',event=>{
  if(isGM())return; // Le joueur peut consulter les Archives même dans un cadre Owlbear.
  void usePlayerSession(event.detail?.session).catch(error=>notice(error.message));
});
if(embedded&&!isGM()){
  const ready=()=>window.parent.postMessage(packet('owl-soundshow-player-ready'),location.origin);
  ready();playerReadyTimer=setInterval(ready,3000);
}
// Ne jamais réinitialiser WebRTC lorsque l'utilisateur change d'onglet :
// le lecteur gère déjà la mise en sourdine pendant que l'onglet est masqué.
const control=document.querySelector('.canvas-integration-icon[aria-label^="Sound Show"]');
if(control){
  control.disabled=false;control.id='archives-soundshow-open';control.setAttribute('aria-label','SoundShow : sons, vidéos et télécommande');control.parentElement.title='SoundShow : sons, vidéos et télécommande MJ';control.onclick=()=>soundsDock?soundsDock.open():open();
  const refresh=()=>{const gm=isGM();control.disabled=!gm;control.parentElement.hidden=!gm;control.parentElement.style.display=gm?'':'none';};refresh();
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
}
function initializeSoundsDock(){
  if(!embedded||!isGM()||soundsDock)return;
  soundsDock=mountSoundDock({
    isGM,
    send:async command=>{
      requireGM();
      const result=await request('owl-soundshow-remote-command',command);
      if(result?.state){remoteState=result.state;soundsDock?.update(remoteState);remoteUi?.update(remoteState);}
      return result;
    },
    refresh:async()=>{
      if(!isGM())return;
      const response=await request('owl-soundshow-remote-get');
      if(response?.state){remoteState=response.state;soundsDock?.update(remoteState);}
    }
  });
  if(remoteState)soundsDock?.update(remoteState);
  if(audienceState)soundsDock?.updateAudience(audienceState);
  if(soundsDock){
    cellMedia=mountCellMedia({
      embedded,isGM,
      getRemote:()=>remoteState,
      send:async command=>request('owl-soundshow-remote-command',command),
      refreshRemote:async()=>{
        const result=await request('owl-soundshow-remote-get');
        if(result?.state){remoteState=result.state;soundsDock?.update(remoteState);}
        return result;
      }
    });
    void request('owl-soundshow-remote-get').then(result=>{
      if(result?.state){remoteState=result.state;soundsDock?.update(remoteState);}
    }).catch(()=>{});
  }
}
initializeSoundsDock();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeSoundsDock,{once:true});
else setTimeout(initializeSoundsDock,700);
window.ArchivesSoundShow={open,session:()=>session,
  openSounds:()=>{initializeSoundsDock();soundsDock?.open();},
  openCellMedia:(source='editor')=>{initializeSoundsDock();cellMedia?.openPicker(source);},
  getSoundDock:()=>soundsDock};
window.addEventListener('pagehide',()=>{playerEpoch++;clearInterval(playerReadyTimer);player?.destroy();cellMedia?.destroy();soundsDock?.destroy();},{once:true});
