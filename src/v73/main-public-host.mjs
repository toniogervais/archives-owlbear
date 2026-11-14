import {isPacket,packet} from '../v56/link.mjs?v=4500';
import {localRoom,validSnapshot} from '../v57/room.mjs?v=4500';
export async function installMainPublicHost(OBR) {
  if(await OBR.player.getRole()!=='GM')return;
  const {channel}=await localRoom(OBR);let primary,closed=false,connected=false,session=crypto.randomUUID(),lastAnnounce=0;
  function announce(){
    if(closed||connected&&Date.now()-lastAnnounce<10000)return;
    try {
      const opener=window.top.opener;
      if(!opener||opener.closed||opener.location.origin!==location.origin||!opener.location.pathname.endsWith('/archives-app-v64-v55.html'))return;
      primary=opener;lastAnnounce=Date.now();opener.postMessage(packet('archives-main-public-ready',{roomId:OBR.room.id,session}),location.origin);
    }catch{}
  }
  async function receive(event){
    const data=event.data;
    if(closed||event.source!==primary||event.origin!==location.origin||!isPacket(data)||!['archives-main-public','archives-main-public-ack'].includes(data.type)||data.roomId!==OBR.room.id||data.session!==session)return;
    if(await OBR.player.getRole()!=='GM'||closed)return;
    connected=true;if(data.type==='archives-main-public'&&validSnapshot(data.payload))channel.postMessage({type:'published',payload:data.payload});
  }
  window.addEventListener('message',receive);announce();
  const timer=setInterval(announce,1000),off=OBR.player.onChange(player=>{if(player.role==='GM'){session=crypto.randomUUID();connected=false;announce()}});
  window.addEventListener('pagehide',()=>{closed=true;clearInterval(timer);off?.();channel.close();window.removeEventListener('message',receive)},{once:true});
}
