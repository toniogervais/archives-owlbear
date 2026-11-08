import {SoundShowConnection} from './connection.mjs';
export function mountPlayer({container=document.body,onPlayback=()=>{},close=()=>{root.hidden=true;video.muted=true;}}={}) {
  if(!document.querySelector('[data-soundshow-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./player.css',import.meta.url).href;style.dataset.soundshowStyle='1';document.head.append(style);}
  const root=document.createElement('section');root.className='soundshow-view';root.hidden=true;root.setAttribute('aria-label','Vidéo SoundShow du maître de jeu');
  const header=document.createElement('header'),title=document.createElement('h2'),back=document.createElement('button');title.textContent='Vidéo du MJ';back.textContent='Revenir au jeu';back.type='button';back.onclick=()=>close();header.append(title,back);
  const video=document.createElement('video');video.playsInline=true;video.autoplay=true;
  const footer=document.createElement('footer'),status=document.createElement('p'),allow=document.createElement('button');status.setAttribute('role','status');allow.textContent='Autoriser l’image et le son';allow.type='button';allow.hidden=true;footer.append(status,allow);root.append(header,video,footer);container.append(root);
  let playback={active:false},destroyed=false;
  async function play() {
    if(!video.srcObject||!playback.active||!playback.playing)return;
    try{await video.play();allow.hidden=true;status.textContent='';}
    catch{allow.hidden=false;status.textContent='Touche le bouton pour autoriser la vidéo avec le son.';video.muted=true;try{await video.play();}catch{}}
  }
  allow.onclick=async()=>{video.muted=playback.muted;try{await video.play();allow.hidden=true;status.textContent='';}catch{status.textContent='La lecture reste bloquée par le navigateur. Réessaie dans Chrome.';}};
  const connection=new SoundShowConnection({onStatus:message=>{status.textContent=message;},onPlayback:data=>{
    playback=data;root.hidden=!data.active;if(data.active){title.textContent=data.title;video.volume=data.volume;video.muted=data.muted;if(!data.playing){video.pause();status.textContent='En pause dans SoundShow.';}else void play();}
    else{video.pause();video.srcObject=null;}onPlayback(data);
  },onStream:stream=>{if(destroyed)return;video.srcObject=stream;if(stream)void play();}});
  return {root,video,connection,use:session=>connection.use(session),destroy(){destroyed=true;connection.stop();root.remove();}};
}
