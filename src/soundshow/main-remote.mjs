// Only the loopback dashboard that opened this MJ window can grant control.
import {autoLinkProtocol as protocol, validLocalBridgeOrigin, validSession, sameSession, isLocalVideoCommand} from './protocol.mjs?v=4730';

export function mainRemote({isGM, onState, onSession}) {
  const opener=window.opener, challenge=crypto.randomUUID(), pending=new Map();
  const offline=()=>({connected:false,media:[],active:[]});
  let origin='', token='', session=null, state=offline();
  function reset() {
    origin=token=''; state=offline();
    for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(Error('Liaison avec le connecteur fermée.'));}
    pending.clear();onState(state);
    if(session){session=null;if(isGM())onSession(null);}
  }
  function check() {
    if(!opener||opener.closed||!isGM()) {if(token)reset();return;}
    if(!token)opener.postMessage({protocol,type:'request',challenge},'*');
  }
  function receive(event) {
    const d=event.data;
    if(!isGM()||!opener||event.source!==opener||!validLocalBridgeOrigin(event.origin)||d?.protocol!==protocol||d.challenge!==challenge)return;
    if(d.type==='offer'&&(d.session===null||validSession(d.session))&&typeof d.controlToken==='string'&&/^[0-9a-f-]{36}$/i.test(d.controlToken)){
      origin=event.origin;token=d.controlToken;
      opener.postMessage({protocol,type:'accepted',challenge},origin);
      if(!sameSession(session,d.session)){session=d.session;onSession(session);}
      return;
    }
    if(!token||origin!==event.origin)return;
    if(d.type==='remote-state'&&Array.isArray(d.state?.media)&&Array.isArray(d.state.active)){
      state=d.state;onState(state);
    }else if(d.type==='remote-result'){
      const call=pending.get(d.id);if(!call)return;
      pending.delete(d.id);clearTimeout(call.timer);
      if(d.ok)call.resolve({safe:true,state,message:d.message});
      else call.reject(Error(d.message||'Commande refusée.'));
    }else if(d.type==='disconnected')reset();
  }
  function command(command) {
    const available=isLocalVideoCommand(command)?state.instantVideo:state.connected;
    if(!isGM()||!token||opener?.closed||!available)return Promise.reject(Error('Ouvre les Archives du MJ depuis le connecteur Windows et connecte SoundShow.'));
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Le connecteur ne répond pas à la commande.'));},command.type==='show_local_video'?20000:9000);
      pending.set(id,{resolve,reject,timer});
      try{opener.postMessage({protocol,type:'remote-command',id,challenge,controlToken:token,command},origin);}
      catch(error){pending.delete(id);clearTimeout(timer);reject(error);}
    });
  }
  window.addEventListener('message',receive);
  const timer=opener?setInterval(check,1200):null;check();
  return {command,get:()=>({safe:true,state}),dispose(){
    clearInterval(timer);window.removeEventListener('message',receive);reset();
  }};
}
