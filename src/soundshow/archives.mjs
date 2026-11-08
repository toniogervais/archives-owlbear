import {button,element,isGM,notice,requireGM,sheet} from '../v63/ui.mjs';
import {isPacket,packet} from '../v56/link.mjs';
import {decodeSession,encodeSession,validSession,autoLinkProtocol,validLocalBridgeOrigin} from './protocol.mjs';
let session=null,player,liveSession=null,infoView=null;const pending=new Map(),roomFrames=new Map();
const embedded=window.parent!==window;
let pendingAutoLink=null,autoLinkBusy=false,autoLinkTimer=null,linkInfoView=null;
async function applyAutomaticLink(){
  if(embedded||!pendingAutoLink||autoLinkBusy||!isGM())return;
  autoLinkBusy=true;
  const offer=pendingAutoLink;
  try{
    await publish(offer.session);
    if(linkInfoView?.isConnected)linkInfoView.textContent='SoundShow est relié. Lance la vidéo dans SoundShow : elle s’affichera chez les joueurs.';
    offer.source?.postMessage({protocol:autoLinkProtocol,type:'accepted',requestId:offer.requestId},offer.origin);
    pendingAutoLink=null;clearInterval(autoLinkTimer);autoLinkTimer=null;
    const url=new URL(location.href);url.searchParams.delete('soundshow_link');
    history.replaceState(history.state,'',url.href);
    notice('SoundShow relié automatiquement. Lance simplement ta vidéo.');
  }catch(error){
    if(linkInfoView?.isConnected)linkInfoView.textContent='Liaison SoundShow indisponible : '+error.message;
  }finally{autoLinkBusy=false;}
}
window.addEventListener('message',event=>{
  if(embedded||event.data?.protocol!==autoLinkProtocol||event.data.type!=='offer'||!validLocalBridgeOrigin(event.origin))return;
  const expected=new URLSearchParams(location.search).get('soundshow_link');
  if(!expected||event.data.requestId!==expected||!validSession(event.data.session))return;
  pendingAutoLink={session:event.data.session,source:event.source,origin:event.origin,requestId:expected};
  if(linkInfoView?.isConnected)linkInfoView.textContent='Connexion automatique reçue. Ouverture de la campagne MJ nécessaire.';
  if(!autoLinkTimer)autoLinkTimer=setInterval(()=>void applyAutomaticLink(),1100);
  void applyAutomaticLink();
});
window.addEventListener('pagehide',()=>clearInterval(autoLinkTimer),{once:true});
async function request(type,value) {
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('La salle ne répond pas. Recharge Owlbear puis réessaie.'));},12000);
    pending.set(id,{resolve,reject,timer});window.parent.postMessage(packet(type,{id,session:value}),location.origin);
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
    requireGM();const view=sheet('archives-soundshow','SoundShow · vidéos des joueurs');
    view.content.append(element('p','Une seule fois au démarrage, dans le connecteur SoundShow sur ton PC, clique sur « Ouvrir Les Archives et relier les joueurs ». Ensuite, lance les vidéos directement dans SoundShow.','studio-hint'));
    const simpleStatus=element('p',session?'SoundShow relié. Les prochaines vidéos s’ouvriront dans une fenêtre des Archives ou d’Owlbear.':'En attente du connecteur SoundShow. Aucun code à recopier.','studio-status');simpleStatus.setAttribute('role','status');linkInfoView=simpleStatus;view.content.append(simpleStatus);
    const download=element('a','Télécharger le connecteur Windows');download.href='https://github.com/toniogervais/archives-owlbear/releases/download/soundshow-bridge-v0.1.3/Archives-SoundShow-Connecteur.exe';download.target='_blank';download.rel='noopener';view.content.append(download);
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
    if(embedded)void request('owl-soundshow-query').then(result=>{if(view.dialog.isConnected){connectionInfo(result);if(!edited){session=result.session;input.value=session?encodeSession(session):'';}}}).catch(error=>{if(view.dialog.isConnected)view.status.textContent=error.message;});
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
  if(event.data.type==='owl-soundshow-status'){if(infoView?.isConnected&&Number.isInteger(event.data.players)){const data=event.data;infoView.textContent=data.players+' joueur(s) dans cette salle Owlbear · '+(data.ready||0)+' lecteur(s) relié(s) au connecteur.'+(data.players===0?' La tablette doit rejoindre la salle avec le rôle Joueur.':data.ready===data.players?' Connexion confirmée ; vérifie la lecture de la vidéo.':data.error?' '+data.error+' lecteur(s) signale(nt) une erreur. Vérifie la tablette.':' Si le nombre ne progresse pas, vérifie le message sur la tablette.');}return;}
  if(event.data.type!=='owl-soundshow-result')return;
  const entry=pending.get(event.data.id);if(!entry)return;pending.delete(event.data.id);clearTimeout(entry.timer);
  if(event.data.safe&&(event.data.session===null||validSession(event.data.session)))entry.resolve(event.data);else entry.reject(Error(event.data.message||'La connexion SoundShow a échoué.'));
});
window.addEventListener('archives:soundshow-session',event=>{
  if(isGM()||embedded)return;
  const value=event.detail?.session;if(value!==null&&!validSession(value))return;liveSession=value;
  void(async()=>{if(!player){const {mountPlayer}=await import('./player.mjs?v=014');player=mountPlayer();}await player.use(document.hidden?null:value);})().catch(error=>notice(error.message));
});
document.addEventListener('visibilitychange',()=>{if(!isGM()&&!embedded&&player)void player.use(document.hidden?null:liveSession).catch(error=>notice(error.message));});
const control=document.querySelector('.canvas-integration-icon[aria-label^="Sound Show"]');
if(control){
  control.disabled=false;control.id='archives-soundshow-open';control.setAttribute('aria-label','SoundShow : diffuser les vidéos');control.parentElement.title='SoundShow : connexion et vidéos des joueurs';control.onclick=open;
  const refresh=()=>{control.parentElement.hidden=!isGM();};refresh();
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
}
window.ArchivesSoundShow={open,session:()=>session};
window.addEventListener('pagehide',()=>player?.destroy(),{once:true});
