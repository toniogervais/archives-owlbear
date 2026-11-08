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
export class SoundShowConnection {
  constructor({mode='view',onStatus=()=>{},onPlayback=()=>{},onStream=()=>{}}={}) {
    Object.assign(this,{mode,onStatus,onPlayback,onStream});this.epoch=0;this.retries=0;
  }
  async use(session) {
    if(session!==null&&!validSession(session))throw Error('Connexion SoundShow invalide.');
    if(sameSession(session,this.session))return;
    this.stop();this.session=session;if(session)await this.connect();
  }
  async connect() {
    const epoch=++this.epoch,session=this.session;
    if(!session)return;
    this.onStatus('Connexion vidéo au PC du MJ…');
    try {
      await loadPeer();if(this.epoch!==epoch)return;
      const peer=new Peer(undefined,{config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]},...window.ArchivesSoundShowPeerOptions});this.peer=peer;
      const fail=()=>{if(this.epoch!==epoch)return;this.drop();this.onStream(null);this.onStatus('Liaison vidéo interrompue. Reconnexion…');if(this.retries++<6)this.timer=setTimeout(()=>void this.connect(),Math.min(1000*2**this.retries,15000));};
      this.timeout=setTimeout(fail,20000);
      peer.on('open',()=>{
        if(this.epoch!==epoch)return;
        const connection=peer.connect(session.peer,{reliable:true});this.connection=connection;
        connection.on('open',()=>connection.send({type:'hello',version:1,secret:session.secret,mode:this.mode}));
        connection.on('data',data=>{
          if(this.epoch!==epoch)return;
          if(data?.type==='welcome'&&typeof data.session==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(data.session)){
            this.nonce=data.session;clearTimeout(this.timeout);this.retries=0;
            connection.send({type:'ready',session:this.nonce});this.onStatus('Prêt — en attente d’une vidéo du MJ.');return;
          }
          const playback=this.nonce&&publicPlayback(data);if(playback)this.onPlayback(playback);
        });
        connection.on('close',fail);connection.on('error',fail);
      });
      peer.on('call',call=>{
        if(this.epoch!==epoch||this.mode!=='view'||call.peer!==session.peer||!this.nonce||call.metadata?.session!==this.nonce){call.close();return;}
        this.call?.close();this.call=call;call.answer();
        call.on('stream',stream=>{if(this.epoch===epoch&&this.call===call)this.onStream(stream);});
        call.on('close',()=>{if(this.call===call){this.call=null;this.onStream(null);}});call.on('error',()=>{if(this.call===call)this.onStatus('La vidéo ne peut pas traverser ce réseau. Vérifie le Wi-Fi des appareils.');});
      });
      peer.on('connection',connection=>connection.close());peer.on('disconnected',fail);peer.on('error',fail);
    } catch(error){if(this.epoch===epoch)this.onStatus(error.message);}
  }
  drop() {
    this.epoch++;clearTimeout(this.timeout);clearTimeout(this.timer);this.nonce=null;
    const peer=this.peer;this.peer=null;this.connection=null;this.call=null;peer?.destroy();
  }
  stop() {this.drop();this.retries=0;this.session=null;this.onStream(null);this.onPlayback({type:'playback',active:false});}
}
