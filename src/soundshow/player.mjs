import {SoundShowConnection} from './connection.mjs?v=014';
export function mountPlayer({container=document.body,onPlayback=()=>{},onStatus=()=>{},onState=()=>{},close,showWaiting=false}={}) {
  if(!document.querySelector('[data-soundshow-style]')){
    const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./player.css?v=4400',import.meta.url).href;
    style.dataset.soundshowStyle='1';document.head.append(style);
  }
  const root=document.createElement('section');root.className='soundshow-view';root.hidden=!showWaiting;
  root.setAttribute('aria-label','Vidéo SoundShow du maître de jeu');
  const header=document.createElement('header'),title=document.createElement('h2'),back=document.createElement('button');
  title.textContent='Vidéo du MJ';back.textContent='Revenir au jeu';back.type='button';header.append(title,back);
  const video=document.createElement('video');video.playsInline=true;video.autoplay=true;
  const footer=document.createElement('footer'),status=document.createElement('p'),allow=document.createElement('button'),retry=document.createElement('button');
  status.setAttribute('role','status');allow.textContent='Autoriser l’image et le son';allow.type='button';allow.hidden=true;
  retry.textContent='Réessayer la connexion';retry.type='button';retry.hidden=true;
  footer.append(status,allow,retry);root.append(header,video,footer);
  const badge=document.createElement('button');badge.type='button';badge.className='soundshow-receive';badge.hidden=true;
  badge.setAttribute('aria-label','Afficher la vidéo du MJ');container.append(root,badge);
  let playback={active:false},destroyed=false,dismissedId=null,waitingDismissed=false,audioBlocked=false;
  let announcedAt=0,waitingForFrame=false,mediaTimer=null,mediaState='connecting',playAttempt=0;
  const state=value=>{mediaState=value;onState(value);};
  function clearMediaTimer(){clearTimeout(mediaTimer);mediaTimer=null;}
  function refreshBadge(){
    badge.hidden=showWaiting||destroyed||!connection.session||!root.hidden;
    badge.textContent=playback.active?'Revoir la vidéo du MJ':mediaState==='error'?'Vidéos du MJ · connexion à vérifier':mediaState==='connecting'?'Vidéos du MJ · connexion…':'Vidéos du MJ · prêt';
  }
  function audible(){video.muted=playback.muted===true||audioBlocked||document.hidden||root.hidden;}
  function receivedFrame(){
    if(!waitingForFrame||video.videoWidth<=0)return;
    waitingForFrame=false;clearMediaTimer();
    if(!audioBlocked)status.textContent=announcedAt?'Vidéo reçue après '+((performance.now()-announcedAt)/1000).toFixed(1)+' s.':'Vidéo reçue.';
    if(!audioBlocked&&playback.playing&&!root.hidden)state('playing');
  }
  video.addEventListener('loadeddata',receivedFrame);video.addEventListener('playing',receivedFrame);
  async function play(){
    if(destroyed||!video.srcObject||!playback.active||!playback.playing)return;
    audible();if(document.hidden||root.hidden)return;
    const attempt=++playAttempt,stream=video.srcObject;
    try{
      await video.play();if(destroyed||attempt!==playAttempt||stream!==video.srcObject)return;
      allow.hidden=!audioBlocked;
      if(audioBlocked){status.textContent='Touche le bouton pour autoriser la vidéo avec le son.';state('blocked');}
      else if(video.videoWidth>0){state('playing');receivedFrame();}
    }catch(error){
      if(destroyed||attempt!==playAttempt||stream!==video.srcObject||!playback.playing)return;
      if(error?.name==='AbortError')return;
      audioBlocked=true;audible();allow.hidden=false;
      status.textContent='Touche le bouton pour autoriser la vidéo avec le son.';state('blocked');
      try{await video.play();}catch{}
    }
  }
  function reopen(){
    if(destroyed||!connection.session)return;
    dismissedId=null;waitingDismissed=false;root.hidden=false;refreshBadge();audible();void play();
  }
  badge.onclick=reopen;
  back.onclick=()=>{
    dismissedId=playback.id;waitingDismissed=true;root.hidden=true;video.muted=true;
    state('closed');refreshBadge();close?.();
  };
  allow.onclick=async()=>{
    // Keep play() in this gesture so Android/Chrome can unlock audible playback.
    audioBlocked=false;audible();
    try{
      await video.play();if(destroyed)return;
      allow.hidden=true;status.textContent='';state('playing');receivedFrame();
    }catch{
      audioBlocked=true;audible();allow.hidden=false;
      status.textContent='La lecture reste bloquée par le navigateur. Touche à nouveau le bouton.';state('blocked');
    }
  };
  const connection=new SoundShowConnection({onStatus:message=>{
    status.textContent=message;retry.hidden=!/interrompue|impossible|indisponible|introuvable|ne répond pas|ne s’est pas chargé|échoué|échec|bloqué/i.test(message);
    state(message.startsWith('Prêt')?'ready':retry.hidden?'connecting':'error');
    if(mediaState==='error'&&!waitingDismissed)root.hidden=false;
    refreshBadge();onStatus(message);
  },onPlayback:data=>{
    if(destroyed)return;
    if(data.active&&data.id!==playback.id){
      dismissedId=null;waitingDismissed=false;announcedAt=performance.now();waitingForFrame=true;clearMediaTimer();
      mediaTimer=setTimeout(()=>{if(waitingForFrame&&!destroyed&&!audioBlocked)status.textContent='Vidéo annoncée par le PC ; établissement du flux en cours…';},7000);
    }
    playback=data;
    root.hidden=data.active?data.id===dismissedId:!showWaiting||waitingDismissed;
    if(data.active){
      title.textContent=data.title;video.volume=data.volume;audible();
      if(!data.playing){playAttempt++;video.pause();status.textContent='En pause dans SoundShow.';state('ready');}
      else{if(!video.srcObject)status.textContent='Vidéo annoncée — réception de l’image en cours…';void play();}
    }else{
      playAttempt++;clearMediaTimer();waitingForFrame=false;announcedAt=0;video.pause();video.srcObject=null;allow.hidden=true;
      if(connection.nonce){status.textContent='Prêt — en attente d’une vidéo du MJ.';state('ready');}
    }
    refreshBadge();onPlayback(data);
  },onStream:stream=>{
    if(destroyed)return;playAttempt++;video.srcObject=stream;
    if(stream){
      if(playback.active&&!audioBlocked)status.textContent='Flux reçu — décodage des premières images…';
      if(typeof video.requestVideoFrameCallback==='function')video.requestVideoFrameCallback(()=>{if(!destroyed)receivedFrame();});
      void play();
    }
  }});
  retry.onclick=()=>{
    const activeSession=connection.session;if(!activeSession)return;
    retry.hidden=true;connection.stop();void connection.use(activeSession).catch(error=>{status.textContent=error.message;retry.hidden=false;state('error');onStatus(error.message);});
  };
  const visible=()=>{audible();if(!document.hidden)void play();};document.addEventListener('visibilitychange',visible);
  return {root,video,connection,reopen,
    async use(session){await connection.use(session);refreshBadge();},
    destroy(){
      if(destroyed)return;destroyed=true;playAttempt++;clearMediaTimer();
      document.removeEventListener('visibilitychange',visible);connection.stop();video.pause();video.srcObject=null;root.remove();badge.remove();
    }
  };
}
