const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('src/v70/player-image.mjs','utf8').replace(/^import .*;\n/gm,'');
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
function viewer(manual=false){
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://archives.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,state={strictReadOnly:true,playerMode:true,playerPresentation:null},fades=[],images=[];
 w.DuneApp={getState:()=>state};w.isGM=()=>false;w.notice=()=>{};w.fadeDuration=300;
 w.fade=(element,from,to,duration=300)=>{let finish;const entry={element,from,to,duration,finished:new Promise(resolve=>{finish=resolve}),cancel(){finish()},finish(){finish()}};fades.push(entry);return entry};
 w.Image=class{set src(value){this.value=value;images.push(this);if(!manual)queueMicrotask(()=>this.onload?.())}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;queueMicrotask(()=>this.dispatchEvent(new w.Event('close')))};
 w.eval(source);
 const show=id=>{state.playerPresentation={id,image:'data:image/png;base64,'+id,published:true};w.dispatchEvent(new w.Event('archives:player-image'))};
 return {dom,w,state,fades,images,show,dialog:()=>w.document.getElementById('archives-player-image')};
}
test('Different images, re-presentation, close/replacement races and both fades keep a single working player viewer',async()=>{
 const v=viewer();try{
  v.show('A');await flush();const dialog=v.dialog();assert.ok(dialog.open);assert.equal(dialog.dataset.phase,'opening');assert.deepEqual([v.fades.at(-1).from,v.fades.at(-1).to],[0,1]);v.fades.at(-1).finish();await flush();assert.equal(dialog.dataset.phase,'open');
  const count=v.fades.length;v.show('A');await flush();assert.equal(v.fades.length,count,'unchanged snapshots do not replay the presentation');
  dialog.querySelector('button').click();await flush();assert.ok(dialog.open,'exit fade must finish before closing');assert.equal(dialog.dataset.phase,'closing');assert.equal(v.fades.at(-1).to,0);
  v.show('B');await flush();v.fades.at(-1).finish();await flush();assert.ok(dialog.open,'old closing animation cannot close the next image');assert.equal(dialog.querySelector('img').src,'data:image/png;base64,B');
  dialog.querySelector('button').click();await flush();v.fades.at(-1).finish();await flush();assert.equal(dialog.open,false);
  v.show('B');await flush();assert.equal(dialog.open,false,'a dismissed publication stays dismissed');
  v.show('C');await flush();v.fades.at(-1).finish();await flush();assert.ok(dialog.open);assert.equal(v.w.document.querySelectorAll('#archives-player-image').length,1);
 }finally{v.dom.window.close()}
});
test('A slow previous image cannot replace a newer presentation or appear after cancellation',async()=>{
 const v=viewer(true);try{
  v.show('A');v.show('B');await flush();v.images[1].onload();await flush();v.fades.at(-1).finish();await flush();v.images[0].onload();await flush();assert.equal(v.dialog().querySelector('img').src,'data:image/png;base64,B');
  v.state.playerPresentation=null;v.w.dispatchEvent(new v.w.Event('archives:player-image'));await flush();v.fades.at(-1).finish();await flush();assert.equal(v.dialog().open,false);
 }finally{v.dom.window.close()}
});
test('Player waiting messages are dismissible and cannot trap keyboard events; GM notices retain their protection',()=>{
 const dom=new JSDOM('<html><body><input id="canvas-control"></body></html>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(fs.readFileSync('src/v56/link.mjs','utf8').replace(/export /g,''));
  const passive=w.createNotice({passive:true});passive.show('En attente','Réessayer',()=>{});const panel=w.document.querySelector('[data-passive="true"]');
  const key=new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});w.document.getElementById('canvas-control').dispatchEvent(key);assert.equal(key.defaultPrevented,false);
  panel.querySelector('.archives-connection-dismiss').click();assert.equal(panel.hidden,true);
  const blocking=w.createNotice();blocking.show('Modification privée non enregistrée');const protectedKey=new w.KeyboardEvent('keydown',{key:'a',bubbles:true,cancelable:true});w.document.getElementById('canvas-control').dispatchEvent(protectedKey);assert.equal(protectedKey.defaultPrevented,true);
 }finally{w.close()}
});
test('The main Archives send only an explicit public projection to the authorized Owlbear background',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://archives.test/archives-app-v64-v55.html',runScripts:'outside-only'}),w=dom.window,sent=[],background={postMessage:data=>sent.push(data)},publicView={boards:[{id:'public',nodes:[],links:[]}]};
 try{
  w.DuneApp={getState:()=>({playerMode:false,strictReadOnly:false})};w.editEvent='edit';w.isPacket=d=>d?.protocol==='test';w.packet=(type,fields)=>({protocol:'test',type,...fields});w.validRoomId=r=>r==='room';w.validSession=s=>s==='session';w.ArchivesOwlbearBridge={authorizeSoundShowFrame:source=>source===background};
  w.eval(fs.readFileSync('src/v73/main-public.mjs','utf8').replace(/^import .*;\n/gm,'').replace('export function ','function '));
  w.installMainPublic({publicView:()=>publicView,snapshot:()=>assert.fail('never publish private campaign')});
  const event=(source,origin)=>new w.MessageEvent('message',{source,origin,data:{protocol:'test',type:'archives-main-public-ready',roomId:'room',session:'session'}});
  w.dispatchEvent(event(background,'https://untrusted.test'));w.dispatchEvent(event({postMessage:()=>assert.fail('wrong source')},w.location.origin));assert.equal(sent.length,0);
  w.dispatchEvent(event(background,w.location.origin));assert.equal(sent.length,2);assert.deepEqual(sent[1].payload,publicView);
  w.dispatchEvent(event(background,w.location.origin));assert.equal(sent.length,3,'unchanged handshakes do not re-send the scenario');
 }finally{w.close()}
});
test('The Owlbear background retains a public main view received before the room transport is ready',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://archives.test/background-v55.html',runScripts:'outside-only'}),w=dom.window,posted=[],announced=[];
 const primary={closed:false,location:{origin:w.location.origin,pathname:'/archives-app-v64-v55.html'},postMessage:data=>announced.push(data)},channel={postMessage:data=>posted.push(data),close(){}};
 try{
  w.opener=primary;w.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';w.localRoom=async()=>({channel});w.isPacket=d=>d?.protocol==='test';w.packet=(type,fields)=>({protocol:'test',type,...fields});w.validSnapshot=p=>Array.isArray(p?.boards);
  w.eval(fs.readFileSync('src/v73/main-public-host.mjs','utf8').replace(/^import .*;\n/gm,'').replace('export async function ','async function '));
  await w.installMainPublicHost({room:{id:'room'},player:{getRole:async()=> 'GM',onChange:()=>()=>{}}});
  assert.equal(announced[0].type,'archives-main-public-ready');
  const payload={boards:[{id:'public',nodes:[],links:[]}]};
  w.dispatchEvent(new w.MessageEvent('message',{source:primary,origin:w.location.origin,data:{protocol:'test',type:'archives-main-public',roomId:'room',session:announced[0].session,payload}}));await flush();assert.equal(posted.length,1);
  channel.onmessage({data:{type:'room-ready'}});await flush();assert.equal(posted.length,2);assert.deepEqual(posted[1].payload,payload);
 }finally{w.close()}
});
