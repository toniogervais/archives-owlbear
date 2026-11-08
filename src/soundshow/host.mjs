import {localRoom} from '../v57/room.mjs';
import {validSession} from './protocol.mjs';
const hosts=new WeakMap();
export async function forwardSoundShow(OBR,data,post) {
  if(await OBR.player.getRole()!=='GM')throw Error('Commande réservée au maître de jeu.');
  if(typeof data.id!=='string'||data.id.length>100)throw Error('Demande SoundShow invalide.');
  if(data.type==='owl-soundshow-command'&&data.session!==null&&!validSession(data.session))throw Error('Code SoundShow invalide.');
  if(!hosts.has(OBR))hosts.set(OBR,localRoom(OBR).then(room=>{room.channel.addEventListener('message',event=>{if(event.data?.type==='soundshow-room-status')post('owl-soundshow-status',event.data);});return room;}));
  const {channel}=await hosts.get(OBR);
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(null,Error('Le module SoundShow ne répond pas. Recharge la salle.')),10000);
    function finish(value,error){clearTimeout(timer);channel.removeEventListener('message',receive);error?reject(error):resolve(value);}
    function receive(event){if(event.data?.type==='soundshow-result'&&event.data.id===data.id)finish(event.data);}
    channel.addEventListener('message',receive);
    channel.postMessage({type:data.type==='owl-soundshow-command'?'soundshow-set':'soundshow-get',id:data.id,session:data.session});
  });
  if(await OBR.player.getRole()==='GM')post('owl-soundshow-result',result);
}
