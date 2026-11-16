// Owlbear carries the authenticated invitation. Original file bytes use a
// reliable, ordered WebRTC channel, with bounded buffering on slower devices.
const label='archives-original-files-v1';
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value||'');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createDirectFiles({self,role,authorize,signal,onData,makePeer=()=>new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]})}){
 const peers=new Map();let disposed=false;
 function close(entry){
  if(!entry||entry.closed)return;entry.closed=true;clearTimeout(entry.timer);entry.resolve(false);
  try{entry.channel?.close();entry.pc.close()}catch{}
  if(peers.get(entry.remote)===entry)peers.delete(entry.remote);
 }
 function create(remote,session){
  if(disposed||peers.size>=8)return null;
  let pc;try{pc=makePeer()}catch{return null}
  const entry={pc,remote,session,closed:false,channel:null};
  entry.ready=new Promise(resolve=>entry.resolve=resolve);peers.set(remote,entry);
  entry.timer=setTimeout(()=>close(entry),15000);
  pc.addEventListener('connectionstatechange',()=>{if(['failed','closed'].includes(pc.connectionState))close(entry)});
  return entry;
 }
 function attach(entry,channel){
  if(channel.label!==label||entry.channel){channel.close();return}
  entry.channel=channel;channel.bufferedAmountLowThreshold=65536;
  channel.addEventListener('open',()=>{if(entry.closed)return;clearTimeout(entry.timer);entry.resolve(true)});
  channel.addEventListener('close',()=>close(entry));channel.addEventListener('error',()=>close(entry));
  channel.addEventListener('message',event=>{
   if(disposed||entry.closed||typeof event.data!=='string'||event.data.length>16000)return;
   let data;try{data=JSON.parse(event.data)}catch{return}
   if(!['request','data','batch-end'].includes(data?.type))return;
   onData({connectionId:entry.remote,data});
  });
 }
 async function description(entry,type){
  await entry.pc.setLocalDescription(type==='offer'?await entry.pc.createOffer():await entry.pc.createAnswer());
  if(entry.pc.iceGatheringState!=='complete')await new Promise(resolve=>{
   let timer;const done=()=>{clearTimeout(timer);entry.pc.removeEventListener('icegatheringstatechange',changed);resolve()};
   const changed=()=>{if(entry.pc.iceGatheringState==='complete')done()};
   entry.pc.addEventListener('icegatheringstatechange',changed);timer=setTimeout(done,3500);changed();
  });
  const sdp=entry.pc.localDescription?.sdp;
  if(entry.closed||disposed||typeof sdp!=='string'||sdp.length>12000)throw Error('Liaison directe indisponible.');
  await signal({type:'direct-'+type,id:entry.session,to:entry.remote,description:{type,sdp}});
 }
 function connect(remote){
  if(disposed||role()!=='PLAYER'||typeof remote!=='string'||!remote)return Promise.resolve(false);
  if(peers.has(remote))return peers.get(remote).ready;
  const entry=create(remote,crypto.randomUUID());if(!entry)return Promise.resolve(false);
  void(async()=>{
   if(!await authorize(remote,'GM')||entry.closed)throw Error('MJ absent.');
   attach(entry,entry.pc.createDataChannel(label,{ordered:true}));await description(entry,'offer');
  })().catch(()=>close(entry));return entry.ready;
 }
 async function handle(event){
  const {data,connectionId:remote}=event;
  if(disposed||!['direct-offer','direct-answer'].includes(data?.type)||data.to!==self()||!uuid(data.id)||
     typeof data.description?.sdp!=='string'||data.description.sdp.length>12000)return;
  const offer=data.type==='direct-offer',expected=offer?'PLAYER':'GM';
  if(role()!==(offer?'GM':'PLAYER')||data.description.type!==(offer?'offer':'answer')||!await authorize(remote,expected)||disposed)return;
  let entry=peers.get(remote);
  try{
   if(offer){
    if(entry?.session===data.id)return;
    close(entry);entry=create(remote,data.id);if(!entry)return;
    entry.pc.addEventListener('datachannel',event=>attach(entry,event.channel));
    await entry.pc.setRemoteDescription(data.description);await description(entry,'answer');
   }else if(entry?.session===data.id&&!entry.closed)await entry.pc.setRemoteDescription(data.description);
  }catch{close(entry)}
 }
 async function send(remote,data){
  const entry=peers.get(remote),channel=entry?.channel;
  if(disposed||entry?.closed||channel?.readyState!=='open')return false;
  const text=JSON.stringify(data);if(text.length>16000)return false;
  try{
   if(channel.bufferedAmount>262144)await new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);channel.removeEventListener('bufferedamountlow',low);channel.removeEventListener('close',gone);error?reject(error):resolve()};
    const low=()=>finish(),gone=()=>finish(Error('Liaison interrompue.')),timer=setTimeout(gone,8000);
    channel.addEventListener('bufferedamountlow',low,{once:true});channel.addEventListener('close',gone,{once:true});if(channel.bufferedAmount<=65536)low();
   });
   if(entry.closed||channel.readyState!=='open')return false;
   channel.send(text);return true;
  }catch{close(entry);return false}
 }
 return {
  connect,handle,send,
  async wait(remote,milliseconds=1200){const ready=connect(remote);return Promise.race([ready,pause(milliseconds).then(()=>false)])},
  disconnect:remote=>close(peers.get(remote)),
  dispose(){disposed=true;for(const entry of [...peers.values()])close(entry)}
 };
}
