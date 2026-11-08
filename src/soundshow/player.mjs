import {SoundShowConnection} from './connection.mjs?v=013';
export function mountPlayer({container=document.body,onPlayback=()=>{},onStatus=()=>{},close,showWaiting=false}={}) {
  if(!document.querySelector('[data-soundshow-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./player.css',import.meta.url).href;style.dataset.soundshowStyle='1';document.head.append(style);}
  const root=document.createElement('section');root.className='soundshow-view';root.hidden=!showWaiting;root.setAttribute('aria-label','Vidéo SoundShow du maître de jeu');
  const header=document.createElement('header'),title=document.createElement('h2'),back=document.createElement('button');title.textContent='Vidéo du MJ';back.textContent='Revenir au jeu';back.type='button';back.onclick=()=>{dismissedId=playback.id;root.hidden=true;video.muted=true;close?.();};header.append(title,back);
  const video=document.createElement('video');video.playsInline=true;video.autoplay=true;
  const footer=document.createElement('footer'),status=document.createElement('p'),allow=document.createElement('button'),retry=document.createElement('button');status.setAttribute('role','status');allow.textContent='Autoriser l’image et le son';allow.type='button';allow.hidden=true;retry.textContent='Réessayer la connexion';retry.type='button';retry.hidden=true;footer.append(status,allow,retry);root.append(header,video,footer);container.append(root);
  let playback={active:false},destroyed=false,dismissedId=null;
  let announcedAt=0,waitingForFrame=false,mediaTimer=null;
  function clearMediaTimer(){clearTimeout(mediaTimer);mediaTimer=null;}
  function receivedFrame(){
    if(!waitingForFrame||video.videoWidth<=0)return;
    waitingForFrame=false;clearMediaTimer();
    status.textContent=announcedAt?'Vidéo reçue après '+((performance.now()-announcedAt)/1000).toFixed(1)+' s.':'Vidéo reçue.';
  }
  video.addEventListener('loadeddata',receivedFrame);
  video.addEventListener('playing',receivedFrame);
  async function play() {
    if(!video.srcObject||!playback.active||!playback.playing)return;
    if(document.hidden||root.hidden){video.muted=true;return;}
    try{await video.play();allow.hidden=true;if(!waitingForFrame&&!announcedAt)status.textContent='';}
    catch{allow.hidden=false;status.textContent='Touche le bouton pour autoriser la vidéo avec le son.';video.muted=true;try{await video.play();}catch{}}
  }
  allow.onclick=async()=>{video.muted=playback.muted;try{await video.play();allow.hidden=true;status.textContent='';}catch{status.textContent='La lecture reste bloquée par le navigateur. Réessaie dans Chrome.';}};
  const connection=new SoundShowConnection({onStatus:message=>{status.textContent=message;retry.hidden=!/interrompue|impossible|indisponible|ne répond pas|ne s’est pas chargé|échoué|échec|bloqué/i.test(message);onStatus(message);},onPlayback:data=>{
    if(data.active&&data.id!==playback.id){
      announcedAt=performance.now();waitingForFrame=true;clearMediaTimer();
      mediaTimer=setTimeout(()=>{if(waitingForFrame&&!destroyed)status.textContent='Vidéo annoncée par le PC ; établissement du flux en cours…';},7000);
    }
    playback=data;root.hidden=data.active?data.id===dismissedId:!showWaiting;if(data.active){title.textContent=data.title;video.volume=data.volume;video.muted=data.muted||document.hidden||root.hidden;if(!data.playing){video.pause();status.textContent='En pause dans SoundShow.';}else{if(!video.srcObject)status.textContent='Vidéo annoncée — réception de l’image en cours…';void play();}}
    else{clearMediaTimer();waitingForFrame=false;announcedAt=0;video.pause();video.srcObject=null;if(showWaiting&&connection.nonce)status.textContent='Prêt — en attente d’une vidéo du MJ.';}onPlayback(data);
  },onStream:stream=>{
    if(destroyed)return;video.srcObject=stream;
    if(stream){
      if(playback.active)status.textContent='Flux reçu — décodage des premières images…';
      if(typeof video.requestVideoFrameCallback==='function')
        video.requestVideoFrameCallback(()=>receivedFrame());
      void play();
    }
  }});
  retry.onclick=()=>{const activeSession=connection.session;if(!activeSession)return;retry.hidden=true;connection.stop();void connection.use(activeSession).catch(error=>{status.textContent=error.message;retry.hidden=false;onStatus(error.message);});};
  const visible=()=>{video.muted=playback.muted||document.hidden||root.hidden;if(!document.hidden)void play();};document.addEventListener('visibilitychange',visible);
  return {root,video,connection,use:session=>connection.use(session),destroy(){destroyed=true;clearMediaTimer();document.removeEventListener('visibilitychange',visible);connection.stop();root.remove();}};
}
