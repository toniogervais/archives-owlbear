import {validSession,publicPlayback,sameSession} from './protocol.mjs';
let loading;
export function loadPeer() {
  if (window.Peer) return Promise.resolve();
  loading ||= new Promise((resolve,reject)=>{
    const script=document.createElement('script'),timer=setTimeout(()=>done(Error('Le module vidéo ne répond pas.')),10000);
    function done(error){clearTimeout(timer);if(error){script.remove();reject(error);}else resolve();}
    script.src=new URL('../../assets/peerjs-1.5.2.min.js',import.meta.url).href;
    script.onload=()=>done(window.Peer?null:Error('Le module vidéo est indisponible.'));script.onerror=()=>done(Error('Le module vidéo ne s’est pas chargé.'));document.head.append(script);
  }).catch(error=>{loading=null;throw error;});return loading;
}
export function explainConnectionFailure(type,phase='signal') {
  if(type==='media-timeout')return 'La vidéo est annoncée, mais son flux n’arrive plus. Vérifie le Wi-Fi et garde le connecteur du PC ouvert.';
  if(type==='peer-unavailable')return 'PC du MJ introuvable : le code SoundShow peut être périmé. Prépare une nouvelle diffusion sur le PC, puis relie les joueurs.';
  if(['network','socket-error','socket-closed','server-error','ssl-unavailable'].includes(type))
    return 'Serveur de mise en relation inaccessible. Vérifie Internet et le message « Code prêt » sur le connecteur du PC.';
  if(type==='browser-incompatible')
    return 'Navigateur incompatible avec la vidéo en direct. Ouvre Owlbear dans Chrome sur la tablette.';
  if(type==='webrtc'||type==='ice-failed'||type==='negotiation-failed')
    return 'Échec WebRTC entre le PC et la tablette. Vérifie le même Wi-Fi, l’absence de réseau invités et le pare-feu Windows.';
  if(type==='connection-closed')
    return phase==='ready'?'La liaison au PC s’est refermée. Vérifie que le connecteur Windows reste ouvert.':
      'La liaison s’est fermée avant confirmation du PC. Vérifie le connecteur et le réseau local.';
  if(phase==='signal')return 'Le serveur de mise en relation ne répond pas. Vérifie Internet sur la tablette.';
  if(phase==='peer')return 'Le PC du MJ ne répond pas à la demande vidéo. Vérifie son onglet de diffusion et le pare-feu.';
  if(phase==='handshake')return 'Connexion ouverte, mais le PC n’a pas confirmé la session. Prépare un nouveau code de diffusion.';
  return 'Liaison vidéo interrompue. Vérifie que le connecteur Windows reste ouvert.';
}
export class SoundShowConnection {
  constructor({mode='view',onStatus=()=>{},onPlayback=()=>{},onStream=()=>{}}={}) {
    Object.assign(this,{mode,onStatus,onPlayback,onStream});this.epoch=0;this.retries=0;this.stage='idle';
    this.playback={active:false};
  }
  clearMediaTimeout(){clearTimeout(this.mediaTimeout);this.mediaTimeout=null;}
  checkMedia(){
    if(this.mode!=='view'||!this.playback.active||!this.playback.playing){this.clearMediaTimeout();return;}
    if(this.videoTrack?.readyState==='live'&&!this.videoTrack.muted){
      this.retries=0;this.clearMediaTimeout();return;
    }
    if(this.stage!=='ready'||this.mediaTimeout)return;
    const epoch=this.epoch;
    this.mediaTimeout=setTimeout(()=>{
      this.mediaTimeout=null;
      if(this.epoch!==epoch||!this.playback.active||!this.playback.playing||
        typeof document!=='undefined'&&document.hidden)return;
      if(this.videoTrack?.readyState==='live'&&!this.videoTrack.muted)return;
      this.recover?.('media-timeout');
    },12000);
  }
  resume(){
    if(!this.session)return;
    if(this.connection?.open){this.checkMedia();return;}
    if(this.stage!=='idle')return;
    this.drop();this.retries=0;void this.connect();
  }
  async use(session) {
    if(session!==null&&!validSession(session))throw Error('Connexion SoundShow invalide.');
    if(sameSession(session,this.session))return;
    this.stop();this.session=session;if(session)await this.connect();
  }
  async connect() {
    const epoch=++this.epoch,session=this.session;
    if(!session)return;
    this.stage='signal';
    this.onStatus('Connexion au serveur vidéo…');
    const fail=(reason='timeout')=>{
      if(this.epoch!==epoch)return;
      const phase=this.stage,issue=explainConnectionFailure(reason,phase);
      this.drop();this.onStream(null);
      const attempt=++this.retries;
      if(attempt<=6){
        this.onStatus('Liaison vidéo interrompue — '+issue+' Nouvelle tentative ('+attempt+'/6)…');
        this.timer=setTimeout(()=>void this.connect(),Math.min(1000*2**attempt,15000));
      }else this.onStatus('Connexion impossible après plusieurs essais — '+issue+' Appuie sur Réessayer la connexion.');
    };
    this.recover=fail;
    try {
      await loadPeer();if(this.epoch!==epoch)return;
      const peer=new Peer(undefined,{config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}],iceCandidatePoolSize:2},...window.ArchivesSoundShowPeerOptions});this.peer=peer;
      this.timeout=setTimeout(()=>fail('timeout'),20000);
      peer.on('open',()=>{
        if(this.epoch!==epoch)return;
        this.stage='peer';this.onStatus('Recherche du PC du MJ…');
        const connection=peer.connect(session.peer,{reliable:true});this.connection=connection;
        connection.on('open',()=>{
          if(this.epoch!==epoch)return;
          this.stage='handshake';this.onStatus('Connexion établie — validation du code SoundShow…');
          connection.send({type:'hello',version:1,secret:session.secret,mode:this.mode});
        });
        connection.on('data',data=>{
          if(this.epoch!==epoch)return;
          if(data?.type==='welcome'&&typeof data.session==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(data.session)){
            this.nonce=data.session;clearTimeout(this.timeout);this.stage='ready';
            if(this.mode==='watch'||!this.playback.active)this.retries=0;
            connection.send({type:'ready',session:this.nonce});this.onStatus('Prêt — en attente d’une vidéo du MJ.');return;
          }
          const playback=this.nonce&&publicPlayback(data);
          if(playback){this.playback=playback;if(!playback.active)this.retries=0;this.checkMedia();this.onPlayback(playback);}
        });
        connection.on('close',()=>fail('connection-closed'));
        connection.on('error',error=>fail(error?.type||'connection-closed'));
      });
      peer.on('call',call=>{
        if(this.epoch!==epoch||this.mode!=='view'||call.peer!==session.peer||!this.nonce||call.metadata?.session!==this.nonce){call.close();return;}
        const previous=this.call;this.call=call;this.videoTrack=null;
        previous?.close();if(previous)this.onStream(null);
        this.checkMedia();
        call.on('stream',stream=>{
          if(this.epoch!==epoch||this.call!==call)return;
          this.videoTrack=stream?.getVideoTracks()[0]||null;
          const changed=()=>{if(this.epoch===epoch&&this.call===call)this.checkMedia();};
          for(const event of ['mute','unmute','ended'])this.videoTrack?.addEventListener(event,changed);
          this.checkMedia();this.onStream(stream);
        });
        call.on('close',()=>{
          if(this.epoch!==epoch||this.call!==call)return;
          this.call=null;this.videoTrack=null;this.onStream(null);this.checkMedia();
        });
        call.on('error',()=>{if(this.epoch===epoch&&this.call===call)fail('webrtc');});
        try{call.answer();}catch{fail('webrtc');}
      });
      peer.on('connection',connection=>connection.close());
      peer.on('disconnected',()=>{
        if(this.epoch!==epoch)return;
        // The data/media connection may survive loss of the signalling socket.
        if(this.connection?.open){this.onStatus('Serveur de mise en relation déconnecté ; liaison locale conservée.');try{peer.reconnect();}catch{}}
        else fail('network');
      });
      peer.on('error',error=>fail(error?.type||'network'));
    } catch(error){if(this.epoch===epoch)fail(error?.type||'network');}
  }
  drop() {
    this.epoch++;clearTimeout(this.timeout);clearTimeout(this.timer);this.clearMediaTimeout();this.nonce=null;this.stage='idle';
    this.videoTrack=null;this.recover=null;
    const peer=this.peer;this.peer=null;this.connection=null;this.call=null;peer?.destroy();
  }
  stop() {this.drop();this.retries=0;this.session=null;this.playback={type:'playback',active:false};this.onStream(null);this.onPlayback(this.playback);}
}
