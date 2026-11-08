import {encodeSession} from './protocol.mjs';
const $ = id => document.getElementById(id);
const key = new URLSearchParams(location.hash.slice(1)).get('key') || sessionStorage.getItem('archives-soundshow-admin') || '';
if(key)sessionStorage.setItem('archives-soundshow-admin',key);
history.replaceState(null,'',location.pathname); // Keep the administrator key out of copied URLs.
const files = new Map(), handles = new Map(), clients = new Map();
let show, ws, wsTimer, peer, secret, stream, objectUrl, current, generation = 0, db, closing = false;
let playback = {type:'playback',active:false}, peerRetry = 0;
let attempts=0,rejected=0,lastIssue='Aucune demande reçue.';
function diagnostic(){const el=$('link-diagnostic');if(!el)return;const ready=[...clients.values()].filter(e=>e.ready&&e.mode==='view').length;el.textContent=attempts+' tentative(s) reçue(s) par le PC · '+ready+' lecteur(s) confirmé(s) · '+rejected+' demande(s) refusée(s). '+lastIssue;}
const options = () => ({config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]},...window.ArchivesSoundShowPeerOptions});
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
    text('show-status',show.message);void follow();
  };
  ws.onclose = () => {clearSource();text('show-status','Connecteur déconnecté. Garde son programme ouvert.');if (!closing) wsTimer = setTimeout(connectEvents,2000);};
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
  for (const entry of clients.values()) { entry.call?.close();entry.call=null; }
  for (const track of stream?.getTracks() || []) track.stop();
  stream=null;current=null;
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
  playback={type:'playback',active:false};broadcast(playback);
}
function desiredPosition(item) {
  let target=item.position+(item.playing?Math.max(0,(Date.now()-item.observedAt)/1000):0);
  if(item.loop && item.stop>item.start && target>item.stop) target=item.start+(target-item.start)%(item.stop-item.start);
  return Math.max(item.start || 0,target);
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
    objectUrl=URL.createObjectURL(file);source.src=objectUrl;source.muted=true;
    try {
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>finish(Error('Le navigateur ne parvient pas à lire cette vidéo. Essaie un MP4 H.264 avec audio AAC.')),15000);
        function finish(error){clearTimeout(timeout);source.removeEventListener('loadedmetadata',ready);source.removeEventListener('error',bad);error?reject(error):resolve();}
        const ready=()=>finish(),bad=()=>finish(Error('Format vidéo non pris en charge par ce navigateur.'));
        source.addEventListener('loadedmetadata',ready,{once:true});source.addEventListener('error',bad,{once:true});
      });
      if(mine!==generation)return;
      if(typeof source.captureStream!=='function')throw Error('Ouvre le connecteur dans Chrome sur ton PC pour diffuser cette vidéo.');
      source.currentTime=Math.min(desiredPosition(item),Math.max(0,source.duration-.05));
      await source.play();if(mine!==generation)return;
      stream=source.captureStream();if(!item.playing)source.pause();current.pending=false;
      if (!stream.getVideoTracks().length) throw Error('La capture de cette vidéo ne fournit aucune image.');
      broadcast(playback);for(const entry of clients.values())call(entry);
      text('stream-status','Diffusion de « '+playback.title+' ». Les commandes restent dans SoundShow.');
    } catch(error) {if(mine===generation){clearSource();text('stream-status',error.message);}}
    return;
  }
  if(current.pending)return;
  const target=Math.min(desiredPosition(item),Math.max(0,source.duration-.05));
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
  clearSource();for(const entry of clients.values())entry.connection.close();clients.clear();peer?.destroy();peer=null;
  $('pair-code').value='';$('copy').disabled=$('stop-session').disabled=true;text('peer-status','Diffusion terminée. Prépare une nouvelle connexion pour reprendre.');audience();
}
$('connection').onsubmit=async event=>{event.preventDefault();try{await api('connect',{url:$('address').value.trim(),password:$('password').value});$('password').value='';}catch(error){text('show-status',error.message);}};
$('demo-init').onclick=()=>void api('demo',{action:'init'}).catch(error=>text('show-status',error.message));
document.querySelectorAll('[data-demo]').forEach(button=>button.onclick=()=>void api('demo',{action:button.dataset.demo}).catch(error=>text('show-status',error.message)));
$('restore').onclick=()=>void restore();$('prepare').onclick=prepare;$('stop-session').onclick=stopSession;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('pair-code').value);text('peer-status','Code copié. Ouvre le bouton SoundShow des Archives pour le coller.');}catch{$('pair-code').select();text('peer-status','Sélectionne le code puis copie-le avec Ctrl+C.');}};
window.addEventListener('pagehide',()=>{closing=true;clearTimeout(wsTimer);ws?.close();stopSession();},{once:true});
if(!key)text('show-status','Rouvre le connecteur depuis son programme pour obtenir ton accès administrateur.');else connectEvents();
