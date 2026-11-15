const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const until=async(fn,label)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw Error(label)};
async function host(){
 const files=await import('../src/v60/files.mjs'),listeners=new Map(),posted=[],sent=[],channel=new EventTarget();let held,release,paused=false;
 channel.postMessage=data=>posted.push(data);channel.close=()=>{};
 const window=new EventTarget(),member=async()=>true;member.dispose=()=>{};
 const context={...files,validPublication:files.validSharedFile,localRoom:async()=>({channel,connectionId:'gm'}),roomMembers:()=>member,installDossierFiles:()=>({dispose(){}}),dossierEntry:()=>null,
  openFileLibrary:async()=>({close(){}}),roomChannel:'room-channel',release:'4520',Blob,File,crypto:webcrypto,window,console,setTimeout,clearTimeout,Map,Set,Promise};
 const OBR={room:{id:'room'},player:{id:'owner',getRole:async()=> 'GM',onChange:()=>()=>{}},party:{onChange:()=>()=>{}},modal:{close:async()=>{}},broadcast:{onMessage:(name,fn)=>{listeners.set(name,fn);return()=>{}},sendMessage:async(name,data)=>{sent.push(data);if(data.type==='data'&&!paused){paused=true;held=data.id;await new Promise(r=>release=r)}}}};
 const source=fs.readFileSync('src/v60/background.mjs','utf8').replace(/^import .*;\n/gm,'').replace('export async function ','async function ').replaceAll('import.meta.url',JSON.stringify('https://archives.test/src/v60/background.mjs'));
 await vm.runInNewContext(source+'\ninstallFileLibrary;',context)(OBR);
 async function command(command){const id=webcrypto.randomUUID();channel.dispatchEvent(new MessageEvent('message',{data:{type:'library-command',id,command}}));await until(()=>posted.some(p=>p.id===id),'command reply');const reply=posted.find(p=>p.id===id);assert.equal(reply.safe,true,reply.message);return reply.result}
 const present=async seed=>{const bytes=Buffer.alloc(45000,seed);Buffer.from([137,80,78,71]).copy(bytes);return (await command({action:'present-image',file:new Blob([bytes],{type:'image/png'})})).publication};
 const request=p=>listeners.get(files.mediaChannel)({connectionId:'player',data:{type:'request',id:p.id,version:p.version,to:'gm'}});
 return {sent,present,request,blocked:()=>held,release:()=>release(),close:()=>window.dispatchEvent(new Event('pagehide'))};
}
test('A second photograph requested while the previous transfer is blocked is queued and delivered',async()=>{
 const h=await host();try{
  const first=await h.present(1);h.request(first);await until(()=>h.blocked()===first.id,'first transfer paused');
  const next=await h.present(2);h.request(next);await new Promise(r=>setTimeout(r,70));h.release();
  await until(()=>h.sent.some(p=>p.type==='data'&&p.id===next.id&&p.index===4),'new photo request was lost behind the old transfer');
  assert.equal(h.sent.filter(p=>p.type==='data'&&p.id===first.id).length,1,'superseded transfer stops before sending further chunks');
 }finally{h.close()}
});
test('Retrying the current photograph while a previous attempt is busy schedules a complete replacement transfer',async()=>{
 const h=await host();try{
  const image=await h.present(3);h.request(image);await until(()=>h.blocked()===image.id,'transfer paused');h.request(image);await new Promise(r=>setTimeout(r,70));h.release();
  await until(()=>h.sent.filter(p=>p.type==='data'&&p.id===image.id&&p.index===0).length===2,'retry request was dropped');
 }finally{h.close()}
});
