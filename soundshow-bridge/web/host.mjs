import {encodeSession} from './protocol.mjs';
const $ = id => document.getElementById(id);
const key = new URLSearchParams(location.hash.slice(1)).get('key') || sessionStorage.getItem('archives-soundshow-admin') || '';
if(key)sessionStorage.setItem('archives-soundshow-admin',key);
history.replaceState(null,'',location.pathname); // Keep the administrator key out of copied URLs.
const files = new Map(), handles = new Map(), clients = new Map();
let show, ws, wsTimer, peer, secret, stream, objectUrl, current, generation = 0, db, closing = false;
let playback = {type:'playback',active:false}, peerRetry = 0;
let audioContext=null,audioSource=null,audioDestination=null;
function prepareAudio(){
  if(!audioContext){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw Error('Ce navigateur ne permet pas la diffusion audio. Ouvre le connecteur dans Chrome.');
    audioContext=new Context();audioSource=audioContext.createMediaElementSource($('source'));
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
  if(!peer||peer.destroyed)prepare();
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
window.addEventListener('message',event=>{
  const data=event.data;
  if(event.origin!==archivesOrigin||data?.protocol!==linkProtocol||!owlWindow||
     !isInsideOwlbear(event.source,owlWindow))return;
  if(data.type==='request'){
    if(!peer?.open||!secret||!linkTimer||typeof data.challenge!=='string'||
       !/^[0-9a-f-]{36}$/.test(data.challenge))return;
    linkCandidate={source:event.source,challenge:data.challenge};
    event.source.postMessage({protocol:linkProtocol,type:'offer',challenge:data.challenge,
      session:{version:1,peer:peer.id,secret},controlToken},archivesOrigin);
  }else if(data.type==='accepted'&&linkCandidate?.source===event.source &&
      data.challenge===linkCandidate.challenge){
    stopLinkTimer();owlLinked=true;
    text('link-status','Owlbear relié. La télécommande est également active dans Les Archives.');
    sendRemoteState();
  }else if(data.type==='remote-command'&&owlLinked&&linkCandidate?.source===event.source&&
      data.challenge===linkCandidate.challenge&&data.controlToken===controlToken&&
      typeof data.id==='string'&&/^[0-9a-f-]{36}$/.test(data.id)){
    const target=event.source;
    void api('control',data.command).then(result=>{
      target.postMessage({protocol:linkProtocol,type:'remote-result',id:data.id,
        ok:true,message:result.message||'Commande envoyée à SoundShow.'},archivesOrigin);
    }).catch(error=>{
      target.postMessage({protocol:linkProtocol,type:'remote-result',id:data.id,
        ok:false,message:String(error.message||'Commande refusée.').slice(0,200)},archivesOrigin);
    });
  }
});
function sendRemoteState(){
  if(!owlLinked||!linkCandidate?.source)return;
  try{
    linkCandidate.source.postMessage({protocol:linkProtocol,type:'remote-state',
      state:{connected:show?.status==='connected'||show?.status==='simulation',
        simulation:show?.status==='simulation',...(show?.remote||{media:[],active:[]})}},archivesOrigin);
  }catch{}
}
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
      if(!peer||peer.destroyed)prepare();
      void autoRestoreFiles(); // Only previously authorized files can be loaded silently.
    }
    sendRemoteState();void follow();
  };
  ws.onclose = () => {clearSource();show=null;sendRemoteState();text('show-status','Connecteur déconnecté. Garde son programme ouvert.');if (!closing) wsTimer = setTimeout(connectEvents,2000);};
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
function call(entry) {
  if (!stream || !entry.ready || entry.mode !== 'view' || !peer || entry.call) return;
  const media=peer.call(entry.connection.peer,stream,{metadata:{session:entry.nonce,cue:playback.id}});entry.call=media;
  media?.on('close',()=>{if(entry.call===media)entry.call=null;});media?.on('error',()=>{if(entry.call===media)entry.call=null;});
}
function clearSource() {
  generation++;
  $('source').pause();$('source').removeAttribute('src');$('source').load();
  audioSource?.disconnect();
  for(const track of audioDestination?.stream.getTracks()||[])track.stop();
  audioDestination=null;
  for (const entry of clients.values()) { entry.call?.close();entry.call=null; }
  for (const track of stream?.getTracks() || []) track.stop();
  stream=null;current=null;
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
  playback={type:'playback',active:false};broadcast(playback);
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
async function follow() {
  if (!show) return;
  const candidates=show.players.filter(item=>files.has(fileKey(item.source)));
  const known=candidates.find(item=>item.id===current?.id);
  const newer=candidates.find(item=>!current?.seen?.has(item.id));
  const item=newer || known || candidates.at(-1);
  if (!item || !['connected','simulation'].includes(show.status)) { if(current)clearSource();return; }
  const source=$('source'),file=files.get(fileKey(item.source));
  if (current?.id !== item.id || current.file !== file) {
    clearSource();const mine=generation;
    current={id:item.id,file,seen:new Set(candidates.map(x=>x.id)),pending:true};
    const info=show.videos.find(video=>video.id===item.source);
    playback={type:'playback',active:true,id:crypto.randomUUID(),title:info?.name || 'Vidéo du MJ',playing:item.playing,volume:item.volume,muted:item.muted};
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
      source.currentTime=desiredPosition(item,source.duration);
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
    } catch(error) {if(mine===generation){clearSource();if(error.name==='NotAllowedError'){$('enable-audio').hidden=false;text('stream-status','Touche « Autoriser la diffusion du son » pour démarrer la vidéo avec son audio.');}else text('stream-status',error.message);}}
    return;
  }
  if(current.pending)return;
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
  peer.on('open',id=>{if(peer!==mine)return;peerRetry=0;$('pair-code').value=encodeSession({version:1,peer:id,secret});$('copy').disabled=$('stop-session').disabled=false;text('peer-status','Code prêt. Colle-le dans SoundShow, dans les Archives.');});
  peer.on('connection',connection=>{
    attempts++;lastIssue='Une demande de liaison est arrivée au PC.';diagnostic();
    if(clients.size>=32){rejected++;lastIssue='Nombre maximal de connexions atteint.';diagnostic();connection.close();return;}
    const entry={connection,ready:false,mode:'view',nonce:crypto.randomUUID(),call:null};clients.set(connection,entry);
    const timer=setTimeout(()=>{if(!entry.ready)connection.close();},6000);
    connection.on('data',data=>{
      if(!entry.authenticated){if(data?.type!=='hello'||data.version!==1||data.secret!==secret){rejected++;lastIssue='Un lecteur a présenté un ancien code ou un code invalide.';diagnostic();connection.close();return;}
        entry.authenticated=true;entry.mode=data.mode==='watch'?'watch':'view';lastIssue='Code accepté ; lecteur en cours d’activation.';diagnostic();send(entry,{type:'welcome',session:entry.nonce});return;}
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
  owlLinked=false;stopLinkTimer();clearSource();for(const entry of clients.values())entry.connection.close();clients.clear();peer?.destroy();peer=null;
  $('pair-code').value='';$('copy').disabled=$('stop-session').disabled=true;text('peer-status','Diffusion terminée. Prépare une nouvelle connexion pour reprendre.');audience();
}
$('connection').onsubmit=async event=>{event.preventDefault();primeAudio();try{await api('connect',{url:$('address').value.trim(),password:$('password').value});$('password').value='';}catch(error){text('show-status',error.message);}};
$('demo-init').onclick=()=>{primeAudio();void api('demo',{action:'init'}).catch(error=>text('show-status',error.message));};
document.querySelectorAll('[data-demo]').forEach(button=>button.onclick=()=>void api('demo',{action:button.dataset.demo}).catch(error=>text('show-status',error.message)));
$('restore').onclick=()=>{primeAudio();void restore();};$('prepare').onclick=prepare;$('stop-session').onclick=stopSession;
$('enable-audio').onclick=()=>{primeAudio();void follow();};
$('link-archives').onclick=openOwlbearAndLink;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('pair-code').value);text('peer-status','Code copié. Ouvre le bouton SoundShow des Archives pour le coller.');}catch{$('pair-code').select();text('peer-status','Sélectionne le code puis copie-le avec Ctrl+C.');}};
window.addEventListener('pagehide',()=>{closing=true;clearTimeout(wsTimer);stopLinkTimer();ws?.close();stopSession();void audioContext?.close();},{once:true});
if(!key)text('show-status','Rouvre le connecteur depuis son programme pour obtenir ton accès administrateur.');else connectEvents();
