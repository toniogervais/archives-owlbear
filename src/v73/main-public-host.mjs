import {isPacket,packet} from '../v56/link.mjs?v=4520';
import {localRoom,validSnapshot} from '../v57/room.mjs?v=4520';
export async function installMainPublicHost(OBR) {
  if(await OBR.player.getRole()!=='GM')return;
  const {channel}=await localRoom(OBR);let primary,closed=false,connected=false,session=crypto.randomUUID(),lastAnnounce=0,latest;
  const pending=new Map();
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
    if(closed||event.source!==primary||event.origin!==location.origin||!isPacket(data)||!['archives-main-public','archives-main-public-ack','archives-main-image'].includes(data.type)||data.roomId!==OBR.room.id||data.session!==session)return;
    if(await OBR.player.getRole()!=='GM'||closed)return;
    connected=true;if(data.type==='archives-main-public'&&validSnapshot(data.payload)){latest=data.payload;channel.postMessage({type:'published',payload:latest})}
    if(data.type==='archives-main-image'&&pending.size<8&&['present-image','stop-image'].includes(data.command?.action)){
      const id=crypto.randomUUID(),target=primary,nonce=session;
      const reply=(safe,result,message)=>{if(!closed&&nonce===session)target.postMessage(packet('archives-main-image-result',{roomId:OBR.room.id,session:nonce,id:data.id,safe,result,message}),location.origin)};
      const timer=setTimeout(()=>{pending.delete(id);reply(false,null,'Le lecteur de présentation ne répond pas. Réessaie.')},18000);
      pending.set(id,{timer,reply});channel.postMessage({type:'library-command',id,command:data.command});
    }
  }
  channel.onmessage=event=>{
    const data=event.data;
    if(!closed&&data?.type==='library-result'&&pending.has(data.id)){
      const entry=pending.get(data.id);pending.delete(data.id);clearTimeout(entry.timer);
      void OBR.player.getRole().then(role=>{if(role==='GM'&&!closed)entry.reply(data.safe===true,data.result,data.message)});
    }
    if(!closed&&data?.type==='room-ready'&&latest)void OBR.player.getRole().then(role=>{if(role==='GM'&&!closed)channel.postMessage({type:'published',payload:latest})});
  };
  window.addEventListener('message',receive);announce();
  const timer=setInterval(announce,1000),off=OBR.player.onChange(player=>{if(player.role==='GM'){session=crypto.randomUUID();connected=false;announce()}});
  window.addEventListener('pagehide',()=>{closed=true;clearInterval(timer);for(const entry of pending.values())clearTimeout(entry.timer);pending.clear();off?.();channel.close();window.removeEventListener('message',receive)},{once:true});
}
