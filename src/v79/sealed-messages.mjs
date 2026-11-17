// Owlbear authenticates the sender's connection. A per-connection ECDH key
// protects selected presentations when the reliable direct file link is absent.
const encode=bytes=>btoa(String.fromCharCode(...bytes)),decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export function createSealedMessages({self,role,authorize,send,onData}){
 let disposed=false;const remotes=new Map(),waiters=new Map(),queues=new Map(),id=crypto.randomUUID();
 const keys=crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
 const publicKey=keys.then(k=>crypto.subtle.exportKey('raw',k.publicKey)).then(value=>encode(new Uint8Array(value)));
 const peerRole=()=>role()==='GM'?'PLAYER':'GM';
 async function announce(to){if(!disposed)await send({type:'audience-key',id,key:await publicKey,...(to?{to}: {})});}
 async function receive(event){
  const {data,connectionId:remote}=event;
  if(disposed||!data||data.to&&data.to!==self()||!['audience-key','audience-key-request','audience-sealed'].includes(data.type)||!await authorize(remote,peerRole())||disposed)return;
  if(data.type==='audience-key-request'){await announce(remote);return;}
  if(data.type==='audience-key'){
   if(typeof data.key!=='string'||data.key.length!==88||typeof data.id!=='string')return;
   const existing=remotes.get(remote);if(existing?.id===data.id)return;
   const imported=await crypto.subtle.importKey('raw',decode(data.key),{name:'ECDH',namedCurve:'P-256'},false,[]);
   const key=await crypto.subtle.deriveKey({name:'ECDH',public:imported},(await keys).privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
   if(disposed)return;remotes.set(remote,{id:data.id,key});await announce(remote);waiters.get(remote)?.();return;
  }
  const peer=remotes.get(remote);
  if(data.to!==self()||peer?.id!==data.keyId||typeof data.iv!=='string'||data.iv.length!==16||typeof data.body!=='string'||data.body.length>15500)return;
  try{
   const additionalData=new TextEncoder().encode(remote+'|'+self()+'|'+data.keyId);
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(data.iv),additionalData},peer.key,decode(data.body));
   const message=JSON.parse(new TextDecoder().decode(bytes));
   if(!disposed)onData({connectionId:remote,data:message});
  }catch{}
 }
 async function seal(remote,data){
  if(disposed||!await authorize(remote,peerRole()))throw Error('Ce joueur est déconnecté.');
  if(!remotes.has(remote))await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{waiters.delete(remote);reject(Error('La liaison privée avec ce joueur n’est pas prête. Réessaie.'));},8000);
   waiters.set(remote,()=>{clearTimeout(timer);waiters.delete(remote);resolve();});
   void send({type:'audience-key-request',id:crypto.randomUUID(),to:remote}).catch(error=>{clearTimeout(timer);waiters.delete(remote);reject(error);});
  });
  const peer=remotes.get(remote);if(disposed||!peer)throw Error('La liaison privée a été interrompue.');
  const iv=crypto.getRandomValues(new Uint8Array(12)),additionalData=new TextEncoder().encode(self()+'|'+remote+'|'+id);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},peer.key,new TextEncoder().encode(JSON.stringify(data)));
  const message={type:'audience-sealed',id:crypto.randomUUID(),keyId:id,to:remote,iv:encode(iv),body:encode(new Uint8Array(bytes))};
  if(JSON.stringify(message).length>16000)throw Error('Le morceau de fichier est trop grand pour la liaison privée.');
  await send(message);
 }
 function handle(event){const remote=event.connectionId,next=(queues.get(remote)||Promise.resolve()).catch(()=>{}).then(()=>receive(event));queues.set(remote,next);return next.finally(()=>{if(queues.get(remote)===next)queues.delete(remote);});}
 return {announce,handle,send:seal,retain(ids){const keep=new Set(ids);for(const remote of remotes.keys())if(!keep.has(remote))remotes.delete(remote);},dispose(){disposed=true;remotes.clear();for(const ready of waiters.values())ready();waiters.clear();}};
}
