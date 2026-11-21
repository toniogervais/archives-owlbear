import {encodeSession,autoLinkProtocol} from './protocol.mjs';
import {chooseProjection,gateProjection} from './projection.mjs';
const $ = id => document.getElementById(id);
const key = new URLSearchParams(location.hash.slice(1)).get('key') || sessionStorage.getItem('archives-soundshow-admin') || '';
if(key)sessionStorage.setItem('archives-soundshow-admin',key);
history.replaceState(null,'',location.pathname); // Keep the administrator key out of copied URLs.
const files = new Map(), handles = new Map(), clients = new Map();
let show, ws, wsTimer, peer, secret, stream, objectUrl, current, generation = 0, db, closing = false;
let playback = {type:'playback',active:false}, peerRetry = 0;
let audioContext=null,audioSource=null,audioDestination=null,standby=null,silentDestination=null;
function prepareAudio(){
  if(!audioContext){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw Error('Ce navigateur ne permet pas la diffusion audio. Ouvre le connecteur dans Chrome.');
    audioContext=new Context();audioSource=audioContext.createMediaElementSource($('source'));
    // Negotiate audio and video with a black frame and a silent track before a file is chosen.
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    if(canvas.captureStream){
      const pen=canvas.getContext('2d');pen.fillRect(0,0,1280,720);
      standby=canvas.captureStream(1);pen.fillRect(0,0,1,1);
      silentDestination=audioContext.createMediaStreamDestination();
      standby.addTrack(silentDestination.stream.getAudioTracks()[0]);
      for(const entry of clients.values())call(entry);
    }
    audioContext.addEventListener('statechange',()=>{$('enable-audio').hidden=audioContext.state==='running';});
  }
  $('enable-audio').hidden=audioContext.state==='running';
  return audioContext.resume();
}
function primeAudio(){
  try{void prepareAudio().catch(()=>{$('enable-audio').hidden=false;});}
  catch(error){text('stream-status',error.message);}
}
const archivesOrigin='https://toniogervais.github.io';
const owlUrl='https://www.owlbear.rodeo/';
const linkProtocol='archives:soundshow:owlbear-link-v1';
let owlWindow=null,linkTimer=null,linkStarted=0,autoRestoreKey='',owlLinked=false;
let linkCandidate=null;
const controlToken=crypto.randomUUID();
function stopLinkTimer(){clearInterval(linkTimer);linkTimer=null;}
function isInsideOwlbear(candidate,root,depth=0){
  if(!root||!candidate||depth>8)return false;
  try{
    const count=Math.min(root.length,80);
    for(let i=0;i<count;i++){
      const child=root.frames[i];
      if(child===candidate || isInsideOwlbear(candidate,child,depth+1))return true;
    }
  }catch{}
  return false;
}
function openOwlbearAndLink(){
  primeAudio();
  if(linkTimer){owlWindow?.focus();text('link-status','Liaison en cours. Rejoins ta salle Owlbear : l’extension se connectera automatiquement.');return;}
  if(owlLinked&&owlWindow&&!owlWindow.closed){owlWindow.focus();text('link-status','La salle est reliée. Lance les vidéos dans SoundShow.');return;}
  if(!['connected','simulation'].includes(show?.status)){
    text('link-status','Connecte SoundShow une seule fois, puis relie Owlbear.');return;
  }
  sessionStopped=false;if(!peer||peer.destroyed)prepare();
  owlLinked=false;linkCandidate=null;linkStarted=Date.now();stopLinkTimer();
  // Never navigate to a separate Archives tab: only the Owlbear application is opened.
  owlWindow=window.open(owlUrl,'archives-owlbear-soundshow');
  if(!owlWindow){text('link-status','Chrome a bloqué Owlbear. Autorise les fenêtres de ce connecteur, puis réessaie.');return;}
  owlWindow.focus();
  text('link-status','Owlbear ouvert. Rejoins ta salle comme MJ : l’extension Les Archives récupère la connexion sans code.');
  linkTimer=setInterval(()=>{
    if(!owlWindow||owlWindow.closed){stopLinkTimer();text('link-status','Owlbear a été fermé. Rouvre-le avec le bouton ci-dessus.');}
    else if(Date.now()-linkStarted>180000){stopLinkTimer();text('link-status','Aucune salle MJ reliée après trois minutes. Vérifie que l’extension Les Archives est active dans Owlbear.');}
  },2000);
}
let mainWindow=null,mainGrant=null,projection=null,quick=null,projectionPlayer='',projectionSeen=new Set();
let sessionStopped=false;
const stoppedProjectionCues=new Set();
const archiveUrl=archivesOrigin+'/archives-owlbear/archives.html?main=1';
const videoSession=()=>peer?.open&&secret?{version:1,peer:peer.id,secret}:null;
function openMain(){
  primeAudio();sessionStopped=false;prepare();
  if(mainWindow&&!mainWindow.closed){mainWindow.focus();return;}
  mainGrant=null;mainWindow=window.open(archiveUrl,'archives-soundshow-mj');
  text('link-status',mainWindow?'Archives ouvertes. Utilise le panneau Sons ou Vidéos du MJ.':'Autorise l’ouverture des Archives dans ce navigateur.');
}
function offer(grant,protocol){
  grant.source.postMessage({protocol,type:'offer',challenge:grant.challenge,session:videoSession(),controlToken},archivesOrigin);
}
function refreshOffers(){
  if(mainGrant)offer(mainGrant,autoLinkProtocol);
  if(linkCandidate)offer(linkCandidate,linkProtocol);
}
function stateForGM(){
  return {connected:show?.status==='connected'||show?.status==='simulation',simulation:show?.status==='simulation',
    ...(show?.remote||{media:[],active:[]}),instantVideo:true,videoReady:!!videoSession(),quickPlaying:!!quick,
    projection:projection?(projection.getAudioTracks().some(t=>t.readyState==='live')?'audio':'silent'):'off'};
}
function sendRemoteState(){
  const state=stateForGM();
  for(const [grant,protocol] of [[mainGrant,autoLinkProtocol],[linkCandidate,linkProtocol]]){
    if(grant?.accepted)try{grant.source.postMessage({protocol,type:'remote-state',challenge:grant.challenge,state},archivesOrigin);}catch{}
  }
}
async function localCommand(command){
  if(!['connected','simulation'].includes(show?.status))throw Error('SoundShow est déconnecté.');
  if(command?.type==='show_local_video'){
    if(!videoSession())throw Error('La liaison vidéo est en cours de connexion.');
    if(!(command.file instanceof File)||!command.file.size)throw Error('Choisis un fichier vidéo sur ton PC.');
    quick={file:command.file,id:crypto.randomUUID(),time:Date.now()};
    sendRemoteState();await follow();
    if(!quick&&lastFileError)throw Error(lastFileError);
    return {message:'Vidéo du PC en diffusion.'};
  }
  if(command?.type==='stop_local_video'){
    endQuick();return {message:'Vidéo du PC arrêtée.'};
  }
  return api('control',command);
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(event.origin!==archivesOrigin||!data)return;
  const main=data.protocol===autoLinkProtocol&&mainWindow&&event.source===mainWindow;
  const owl=data.protocol===linkProtocol&&owlWindow&&isInsideOwlbear(event.source,owlWindow);
  if(!main&&!owl)return;
  let grant=main?mainGrant:linkCandidate;
  if(data.type==='request'){
    if(typeof data.challenge!=='string'||!/^[0-9a-f-]{36}$/.test(data.challenge))return;
    // Older Owlbear clients require a real session; the new connector may also pair audio alone.
    if(owl&&!linkTimer&&!owlLinked)return;
    if(!grant||grant.source!==event.source||grant.challenge!==data.challenge){
      grant={source:event.source,challenge:data.challenge,accepted:false};
      if(main)mainGrant=grant;else linkCandidate=grant;
    }
    offer(grant,data.protocol);return;
  }
  if(!grant||grant.source!==event.source||grant.challenge!==data.challenge)return;
  if(data.type==='accepted'){
    grant.accepted=true;
    if(owl){stopLinkTimer();owlLinked=true;}
    text('link-status',main?'Télécommande reliée aux Archives du MJ.':'Télécommande reliée à la salle Owlbear.');
    sendRemoteState();
  }else if(data.type==='remote-command'&&grant.accepted&&data.controlToken===controlToken&&
      typeof data.id==='string'&&/^[0-9a-f-]{36}$/.test(data.id)){
    const reply=(ok,message)=>grant.source.postMessage({protocol:data.protocol,type:'remote-result',
      challenge:grant.challenge,id:data.id,ok,message},archivesOrigin);
    void localCommand(data.command).then(result=>reply(true,result.message)).catch(error=>reply(false,String(error.message).slice(0,200)));
  }
});
let attempts=0,rejected=0,lastIssue='Aucune demande reçue.';
function diagnostic(){const el=$('link-diagnostic');if(!el)return;const ready=[...clients.values()].filter(e=>e.ready&&e.mode==='view').length;el.textContent=attempts+' tentative(s) reçue(s) par le PC · '+ready+' lecteur(s) confirmé(s) · '+rejected+' demande(s) refusée(s). '+lastIssue;}
const options = () => ({config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:2},...window.ArchivesSoundShowPeerOptions});
function text(id,value) { $(id).textContent = value; }
async function api(path,data) {
  const response = await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Archives-Key':key},body:JSON.stringify(data || {})});
  const result = await response.json();if (!response.ok) throw Error(result.error || 'Le connecteur a refusé la demande.');return result;
}
function connectEvents() {
  if (closing) return;
  ws = new WebSocket('ws://'+location.host+'/events');
  ws.onopen = () => ws.send(JSON.stringify({key}));
  ws.onmessage = event => {
    const next = JSON.parse(event.data);if (next.type !== 'show') return;
    const signature = JSON.stringify([next.project,next.videos]);
    if (!show || signature !== JSON.stringify([show.project,show.videos])) { show = next;renderVideos(); }
    else show = next;
    text('show-status',show.message);
    if(['connected','simulation'].includes(show.status)){
      if(!sessionStopped&&(!peer||peer.destroyed))prepare();
      void autoRestoreFiles(); // Only previously authorized files can be loaded silently.
    }
    sendRemoteState();void follow();
  };
  ws.onclose = () => {quick=null;if(projection)gateProjection(projection,null);clearSource();show=null;sendRemoteState();text('show-status','Connecteur déconnecté. Garde son programme ouvert.');if (!closing) wsTimer = setTimeout(connectEvents,2000);};
}
function fileKey(id) { return JSON.stringify([show?.project || '',id]); }
async function openDatabase() {
  if (db) return db;
  db = await new Promise((resolve,reject) => {const req = indexedDB.open('archives-soundshow-files-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('handles');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return db;
}
async function remember(id,handle) {
  const database = await openDatabase();return new Promise((resolve,reject)=>{const tx=database.transaction('handles','readwrite');tx.objectStore('handles').put(handle,fileKey(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function choose(id) {
  primeAudio();
  try {
    let file,handle;
    if (window.showOpenFilePicker) {
      [handle] = await showOpenFilePicker({multiple:false,types:[{description:'Vidéos',accept:{'video/mp4':['.mp4','.m4v','.mov'],'video/webm':['.webm']}}]});
      file = await handle.getFile();handles.set(fileKey(id),handle);
      try { await remember(id,handle); } catch { text('file-status','Le fichier est prêt pour cette session. Son autorisation ne peut pas être mémorisée.'); }
    } else {
      file = await new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='video/*';input.onchange=()=>resolve(input.files[0]);input.oncancel=()=>resolve(null);input.click();});
    }
    if (!file) return;
    files.set(fileKey(id),file);renderVideos();text('file-status','Vidéo associée. Le fichier original reste sur ton PC.');void follow();
  } catch (error) { if (error.name !== 'AbortError') text('file-status',error.message); }
}
async function restore() {
  try {
    if (!show?.videos.length) throw Error('Connecte SoundShow ou active la simulation avant de choisir les vidéos.');
    const database = await openDatabase();let count=0;
    for (const video of show.videos) {
      const saved = await new Promise((resolve,reject)=>{const req=database.transaction('handles').objectStore('handles').get(fileKey(video.id));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      if (!saved) continue;
      if (await saved.requestPermission({mode:'read'}) !== 'granted') continue;
      files.set(fileKey(video.id),await saved.getFile());count++;
    }
    renderVideos();text('file-status',count+' vidéo(s) autorisée(s).');void follow();
  } catch (error) { text('file-status',error.message); }
}
async function autoRestoreFiles(){
  if(!show?.videos?.length)return;
  const signature=JSON.stringify([show.project,show.videos.map(video=>video.id)]);
  if(autoRestoreKey===signature)return;
  autoRestoreKey=signature;
  try{
    const database=await openDatabase();let restored=0;
    for(const video of show.videos){
      const saved=await new Promise((resolve,reject)=>{
        const req=database.transaction('handles').objectStore('handles').get(fileKey(video.id));
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      if(!saved||typeof saved.queryPermission!=='function'||await saved.queryPermission({mode:'read'})!=='granted')continue;
      files.set(fileKey(video.id),await saved.getFile());restored++;
    }
    if(restored){renderVideos();text('file-status',restored+' vidéo(s) autorisée(s) automatiquement.');void follow();}
  }catch(error){console.warn('SoundShow : récupération des fichiers non disponible',error);}
}
function renderVideos() {
  $('videos').replaceChildren();
  for (const video of show?.videos || []) {
    const row=document.createElement('article');row.className='video-row';
    const info=document.createElement('div'),title=document.createElement('strong'),name=document.createElement('p');
    title.textContent=video.name;name.textContent=files.get(fileKey(video.id))?.name || 'Aucun fichier associé — cette vidéo ne sera pas diffusée.';
    info.append(title,name);const button=document.createElement('button');button.textContent=files.has(fileKey(video.id))?'Changer le fichier':'Choisir la vidéo';button.onclick=()=>void choose(video.id);
    row.append(info,button);$('videos').append(row);
  }
  if (!show?.videos.length) text('videos','Aucun bouton vidéo disponible pour le moment.');
}
function send(entry,data) { if (entry.connection.open) entry.connection.send(data); }
function broadcast(data) { for (const entry of clients.values()) if (entry.ready) send(entry,data); }
function audience() { text('audience',[...clients.values()].filter(x=>x.ready && x.mode==='view').length+' lecteur(s) connecté(s).');diagnostic(); }
function targetStream(entry){
  if(sessionStopped||closing)return null;
  return entry.warm?(stream||standby):(playback.active?stream:null);
}
function closeCall(entry){
  const media=entry.call;entry.call=null;entry.output=null;entry.senders=null;
  media?.close();
}
function call(entry) {
  if(!entry.ready||entry.mode!=='view'||!peer)return;
  const next=targetStream(entry);
  if(!next){closeCall(entry);return;}
  if(!entry.call){
    const media=peer.call(entry.connection.peer,next,{metadata:{session:entry.nonce,cue:playback.id}});
    if(!media)return;
    entry.call=media;entry.output=next;
    const cleared=()=>{if(entry.call===media){entry.call=null;entry.output=null;entry.senders=null;}};
    media.on('close',cleared);media.on('error',cleared);return;
  }
  if(entry.output===next||entry.switching)return;
  if(!entry.warm){closeCall(entry);call(entry);return;}
  const media=entry.call;
  const senders=entry.senders??=new Map((media.peerConnection?.getSenders()||[]).filter(s=>s.track).map(s=>[s.track.kind,s]));
  if(!next.getTracks().every(track=>senders.has(track.kind))){
    closeCall(entry);call(entry);return;
  }
  entry.switching=true;
  void Promise.all([...senders].map(([kind,sender])=>{
    const track=next.getTracks().find(track=>track.kind===kind)||null;
    return sender.track===track?undefined:sender.replaceTrack(track);
  })).then(()=>{
    if(entry.call===media)entry.output=next;
  }).catch(()=>{
    if(entry.call===media)closeCall(entry);
  }).finally(()=>{
    entry.switching=false;
    if(clients.get(entry.connection)===entry)call(entry);
  });
}
function updateCalls(){for(const entry of clients.values())call(entry);}
function clearSource() {
  generation++;
  $('source').pause();$('source').removeAttribute('src');$('source').load();
  audioSource?.disconnect();
  for(const track of audioDestination?.stream.getTracks()||[])track.stop();
  audioDestination=null;
  if(stream!==projection)for(const track of stream?.getTracks()||[])track.stop();
  if(projection)gateProjection(projection,null);
  projectionPlayer='';projectionSeen.clear();
  stream=null;current=null;
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
  playback={type:'playback',active:false};broadcast(playback);updateCalls();
}
function desiredPosition(item, mediaDuration = Infinity) {
  const start = Math.max(0, item.start || 0);
  const stop = item.stop > start ? item.stop : (Number.isFinite(mediaDuration) && mediaDuration > start ? mediaDuration : Infinity);
  let target = Math.max(start, item.position + (item.playing ? Math.max(0, (Date.now()-item.observedAt)/1000) : 0));
  // A video loop with no explicit stop boundary still wraps at the source duration.
  if(item.loop && Number.isFinite(stop) && stop>start)
    target = start + ((target-start) % (stop-start));
  return Number.isFinite(stop) ? Math.min(target,Math.max(start,stop-.05)) : target;
}
let lastFileError='';
function endQuick(){
  if(!quick)return;
  quick=null;clearSource();sendRemoteState();void follow();
}
$('source').addEventListener('ended',()=>{if(quick&&current?.id===quick.id)endQuick();});
function followProjection(){
  if(stream!==projection){
    clearSource();stream=projection;
    for(const entry of clients.values())call(entry);
  }
  const players=show.players;
  const item=players.findLast(p=>!projectionSeen.has(p.id))||
    players.find(p=>p.id===projectionPlayer)||players.at(-1);
  projectionSeen=new Set(players.map(p=>p.id));
  gateProjection(projection,item);
  if(!item){
    if(playback.active){projectionPlayer='';playback={type:'playback',active:false};broadcast(playback);updateCalls();}
    return;
  }
  const same=item.id===projectionPlayer;
  projectionPlayer=item.id;
  // SoundShow already applies its volume to the captured output.
  playback={type:'playback',active:true,id:same?playback.id:crypto.randomUUID(),title:'Projection SoundShow',
    playing:item.playing,volume:1,muted:item.muted};
  broadcast(playback);
  for(const entry of clients.values())call(entry);
}
function releaseProjection(){
  if(!projection)return;
  const old=projection;
  for(const p of show?.players||[])stoppedProjectionCues.add(p.id);
  if(stream===old)clearSource();
  projection=null;
  for(const track of old.getTracks())track.stop();
  $('stop-projection').hidden=true;
  text('projection-status','Partage de la projection arrêté.');sendRemoteState();void follow();
}
async function startProjection(){
  let selected;
  try{selected=await chooseProjection();}
  catch(error){if(error.name!=='NotAllowedError'&&error.name!=='AbortError')text('projection-status',error.message);
    else if(!projection)text('projection-status','Aucune fenêtre partagée.');return;}
  if(closing){for(const track of selected.getTracks())track.stop();return;}
  // Swap only after the new selection succeeds. A cancelled picker preserves the old share.
  const old=projection;
  if(old&&stream===old)clearSource();
  if(old)for(const track of old.getTracks())track.stop();
  projection=selected;sessionStopped=false;prepare();
  selected.getVideoTracks()[0].addEventListener('ended',()=>{if(projection===selected)releaseProjection();},{once:true});
  const update=()=>{if(projection!==selected)return;
    const audio=selected.getAudioTracks().some(t=>t.readyState==='live');
    text('projection-status',audio?'Fenêtre prête · image et son.':'Fenêtre prête · image seule. Pour transmettre aussi le son, partage l’audio de la fenêtre ou choisis le fichier dans les Archives.');
    sendRemoteState();
  };
  for(const track of selected.getAudioTracks())track.addEventListener('ended',update,{once:true});
  $('stop-projection').hidden=false;update();void follow();
}
async function follow() {
  if (!show||sessionStopped) return;
  if(!['connected','simulation'].includes(show.status)){
    quick=null;if(projection)gateProjection(projection,null);
    if(current||stream)clearSource();return;
  }
  for(const id of stoppedProjectionCues){if(!show.players.some(p=>p.id===id))stoppedProjectionCues.delete(id);}
  if(projection&&!quick){followProjection();return;}
  const candidates=show.players.filter(item=>!stoppedProjectionCues.has(item.id)&&files.has(fileKey(item.source)));
  const known=candidates.find(item=>item.id===current?.id);
  const newer=candidates.find(item=>!current?.seen?.has(item.id));
  const item=quick?{id:quick.id,playing:true,loop:false,position:0,observedAt:quick.time,volume:1,muted:false}:newer || known || candidates.at(-1);
  if (!item || !['connected','simulation'].includes(show.status)) { if(current)clearSource();return; }
  const source=$('source'),file=quick?.file||files.get(fileKey(item.source));
  if (current?.id !== item.id || current.file !== file) {
    clearSource();lastFileError='';const mine=generation;
    current={id:item.id,file,seen:new Set(candidates.map(x=>x.id)),pending:true};
    const info=show.videos.find(video=>video.id===item.source);
    playback={type:'playback',active:true,id:crypto.randomUUID(),title:quick?'Vidéo du MJ':info?.name || 'Vidéo du MJ',playing:item.playing,volume:item.volume,muted:item.muted};
    objectUrl=URL.createObjectURL(file);source.loop=item.loop;source.src=objectUrl;source.muted=true;
    text('stream-status','Ouverture du fichier vidéo sur le PC…');
    try {
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>finish(Error('Le navigateur ne parvient pas à lire cette vidéo. Essaie un MP4 H.264 avec audio AAC.')),15000);
        function finish(error){clearTimeout(timeout);source.removeEventListener('loadedmetadata',ready);source.removeEventListener('error',bad);error?reject(error):resolve();}
        const ready=()=>finish(),bad=()=>finish(Error('Format vidéo non pris en charge par ce navigateur.'));
        source.addEventListener('loadedmetadata',ready,{once:true});source.addEventListener('error',bad,{once:true});
      });
      if(mine!==generation)return;
      if(typeof source.captureStream!=='function')throw Error('Ouvre le connecteur dans Chrome sur ton PC pour diffuser cette vidéo.');
      if(!quick)source.currentTime=desiredPosition(item,source.duration);
      await prepareAudio();if(mine!==generation)return;
      // Media-element muting also silences captureStream() in Chromium.
      // Route decoded audio only to a stream destination, never the PC speakers.
      const destination=audioContext.createMediaStreamDestination();
      audioDestination=destination;
      audioSource.connect(destination);source.muted=false;source.volume=1;
      await source.play();if(mine!==generation)return;
      const captured=source.captureStream();
      for(const track of captured.getAudioTracks())track.stop();
      stream=new MediaStream([...captured.getVideoTracks(),...destination.stream.getAudioTracks()]);
      if(!item.playing)source.pause();current.pending=false;
      if (!stream.getVideoTracks().length) throw Error('La capture de cette vidéo ne fournit aucune image.');
      broadcast(playback);for(const entry of clients.values())call(entry);
      text('stream-status','Diffusion de « '+playback.title+' ». Les commandes restent dans SoundShow.');
    } catch(error) {if(mine===generation){lastFileError=error.message;const wasQuick=!!quick;quick=null;clearSource();sendRemoteState();if(wasQuick&&projection)void follow();if(error.name==='NotAllowedError'){$('enable-audio').hidden=false;text('stream-status','Touche « Autoriser la diffusion du son » pour démarrer la vidéo avec son audio.');}else text('stream-status',error.message);}}
    return;
  }
  if(current.pending||quick)return;
  const target=desiredPosition(item,source.duration);
  if(Math.abs(source.currentTime-target)>.65)source.currentTime=target;
  source.loop=item.loop;
  if(item.playing && source.paused) {try{await source.play();}catch{ text('stream-status','Clique dans cet onglet pour autoriser la lecture.'); }}
  else if(!item.playing && !source.paused)source.pause();
  playback={...playback,playing:item.playing,volume:item.volume,muted:item.muted};broadcast(playback);
  for(const entry of clients.values())call(entry);
}
function prepare() {
  if(peer && !peer.destroyed)return;
  if(typeof window.Peer!=='function'){text('peer-status','Le module de diffusion ne s’est pas chargé. Recharge cet onglet.');return;}
  attempts=0;rejected=0;lastIssue='En attente de la première tentative depuis une tablette.';diagnostic();
  secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  peer=new Peer(undefined,options());const mine=peer;
  text('peer-status','Préparation de la connexion aux joueurs…');
  peer.on('open',id=>{if(peer!==mine)return;peerRetry=0;refreshOffers();sendRemoteState();$('pair-code').value=encodeSession({version:1,peer:id,secret});$('copy').disabled=$('stop-session').disabled=false;text('peer-status','Code prêt. Colle-le dans SoundShow, dans les Archives.');});
  peer.on('connection',connection=>{
    attempts++;lastIssue='Une demande de liaison est arrivée au PC.';diagnostic();
    if(clients.size>=32){rejected++;lastIssue='Nombre maximal de connexions atteint.';diagnostic();connection.close();return;}
    const entry={connection,ready:false,mode:'view',nonce:crypto.randomUUID(),call:null};clients.set(connection,entry);
    const timer=setTimeout(()=>{if(!entry.ready)connection.close();},6000);
    connection.on('data',data=>{
      if(!entry.authenticated){if(data?.type!=='hello'||data.version!==1||data.secret!==secret){rejected++;lastIssue='Un lecteur a présenté un ancien code ou un code invalide.';diagnostic();connection.close();return;}
        entry.authenticated=true;entry.warm=data.warmMedia===true;entry.mode=data.mode==='watch'?'watch':'view';lastIssue='Code accepté ; lecteur en cours d’activation.';diagnostic();send(entry,{type:'welcome',session:entry.nonce});return;}
      if(data?.type==='ready'&&data.session===entry.nonce){clearTimeout(timer);entry.ready=true;lastIssue='Lecteur confirmé par le PC.';send(entry,playback);call(entry);audience();}
      // Receiving tablets cannot control SoundShow or select a local file.
    });
    const closed=()=>{clearTimeout(timer);if(!entry.ready)lastIssue='Une tentative s’est fermée avant la validation du lecteur.';entry.call?.close();clients.delete(connection);audience();};connection.on('close',closed);connection.on('error',closed);
  });
  peer.on('call',call=>call.close());
  peer.on('disconnected',()=>{if(peer!==mine||peer.destroyed)return;lastIssue='Le PC a perdu le serveur de mise en relation.';diagnostic();text('peer-status','Serveur de connexion interrompu. Reconnexion…');if(peerRetry++<5)setTimeout(()=>{if(peer===mine&&!peer.destroyed)peer.reconnect();},Math.min(1000*2**peerRetry,15000));});
  peer.on('error',error=>{lastIssue='Erreur de mise en relation du PC : '+String(error?.type||'inconnue').slice(0,40);diagnostic();text('peer-status','Connexion aux joueurs indisponible ('+String(error?.type||'réseau')+'). Vérifie Internet et le réseau local.');});
}
function stopSession() {
  sessionStopped=true;quick=null;
  if(projection){const old=projection;projection=null;for(const track of old.getTracks())track.stop();$('stop-projection').hidden=true;text('projection-status','Partage de la projection arrêté.');}
  clearSource();for(const entry of clients.values())entry.connection.close();clients.clear();peer?.destroy();peer=null;secret='';refreshOffers();sendRemoteState();
  $('pair-code').value='';$('copy').disabled=$('stop-session').disabled=true;text('peer-status','Diffusion terminée. Prépare une nouvelle connexion pour reprendre.');audience();
}
$('connection').onsubmit=async event=>{event.preventDefault();primeAudio();try{await api('connect',{url:$('address').value.trim(),password:$('password').value});$('password').value='';}catch(error){text('show-status',error.message);}};
$('demo-init').onclick=()=>{primeAudio();void api('demo',{action:'init'}).catch(error=>text('show-status',error.message));};
document.querySelectorAll('[data-demo]').forEach(button=>button.onclick=()=>void api('demo',{action:button.dataset.demo}).catch(error=>text('show-status',error.message)));
$('share-projection').onclick=startProjection;$('stop-projection').onclick=releaseProjection;
$('open-main').onclick=openMain;
$('restore').onclick=()=>{primeAudio();void restore();};$('prepare').onclick=()=>{sessionStopped=false;prepare();};$('stop-session').onclick=stopSession;
$('enable-audio').onclick=()=>{primeAudio();void follow();};
$('link-archives').onclick=openOwlbearAndLink;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('pair-code').value);text('peer-status','Code copié. Ouvre le bouton SoundShow des Archives pour le coller.');}catch{$('pair-code').select();text('peer-status','Sélectionne le code puis copie-le avec Ctrl+C.');}};
window.addEventListener('pagehide',()=>{closing=true;clearTimeout(wsTimer);stopLinkTimer();ws?.close();stopSession();for(const [grant,protocol] of [[mainGrant,autoLinkProtocol],[linkCandidate,linkProtocol]]){
    if(grant?.accepted)grant.source.postMessage({protocol,challenge:grant.challenge,type:'disconnected'},archivesOrigin);
  }for(const track of standby?.getTracks()||[])track.stop();void audioContext?.close();},{once:true});
if(!key)text('show-status','Rouvre le connecteur depuis son programme pour obtenir ton accès administrateur.');else connectEvents();
