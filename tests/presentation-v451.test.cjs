const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('archives-app-v64-v55.html','utf8');
test('The launcher and every current player entry point use the same release',()=>{
 const launcher=fs.readFileSync('archives.html','utf8'),release=fs.readFileSync('src/v57/room.mjs','utf8').match(/release = "(\d+)"/)[1];
 assert.equal(launcher.match(/searchParams.set\("v","(\d+)"\)/)[1],release);
 for(const file of ['archives.html','archives-host-v55.html','background-v55.html','media-view-v60.html']){
  const versions=[...fs.readFileSync(file,'utf8').matchAll(/\?v=(\d+)/g)].map(m=>m[1]);assert.ok(versions.length);assert.ok(versions.every(v=>v===release),file);
 }
 const manifest=JSON.parse(fs.readFileSync('manifest-v55.json','utf8'));
 for(const url of [manifest.background_url,manifest.action.popover])assert.equal(new URL(url).searchParams.get('v'),release);
});
test('Closing and immediately reopening a GM brief keeps only the new portrait',async()=>{
 const dom=new JSDOM('<html><head></head><body></body></html>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 try{
  const state={nodes:[{id:'a',title:'Premier',clues:[]},{id:'b',title:'Deuxième',clues:[]}]};w.DuneApp={getState:()=>state};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;queueMicrotask(()=>this.dispatchEvent(new w.Event('close')))};
  w.eval(fs.readFileSync('src/v68/cell-brief.mjs','utf8'));w.ArchivesCellBrief.open('a');const dialog=w.document.getElementById('archives-cell-brief');dialog.close();w.ArchivesCellBrief.open('b');await Promise.resolve();
  assert.equal(dialog.open,true);assert.equal(dialog.querySelectorAll('.brief-card').length,1);assert.equal(dialog.querySelector('.brief-card h2').textContent,'Deuxième');
 }finally{w.close()}
});
test('An explicit image publication does not save or reveal a hidden cell',()=>{
 const start=html.indexOf('commitPlayerPresentation: function('),end=html.indexOf('setGmDetails: function',start);
 const method=html.slice(start,end).trim().replace(/,$/,'');
 const node={id:'private',revealed:false,clues:[{revealed:false}],gmDetails:[{text:'SECRET'}]},packets=[],events=[];
 const state={playerMode:false,strictReadOnly:false,nodes:[node]},relayPayload={boards:[{nodes:[node]}]};
 const context={playerViewForPeer:payload=>payload,state,relayPayload,remoteEditor:false,owlEditor:false,playerImageProjection:x=>x,saveState:()=>assert.fail('image publication must not save the campaign'),syncChannel:{postMessage:x=>packets.push(x)},peerConns:[{open:true,send:x=>packets.push(x)}],window:{dispatchEvent:x=>events.push(x)},CustomEvent:class{constructor(type){this.type=type}},setStatus(){}};
 const commit=vm.runInNewContext('({'+method+'}).commitPlayerPresentation',context),value={id:'image',image:'PNG',published:true};
 assert.equal(commit(value),true);assert.equal(state.playerPresentation,value);assert.equal(relayPayload.playerPresentation,value);assert.equal(node.revealed,false);assert.equal(node.clues[0].revealed,false);
 assert.equal(packets.length,2);assert.ok(packets.every(p=>p.type==='archives:player-image:v1'&&!p.boards));assert.equal(events[0].type,'archives:presentation');
 context.owlEditor=context.remoteEditor=true;assert.equal(commit(null),true,'native images also bypass a scenario save');
 state.playerMode=true;assert.equal(commit(value),false);
});
test('Main image requests accept results only from the authorized room, source and session',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://archives.test/archives-app-v64-v55.html',runScripts:'outside-only'}),w=dom.window,sent=[],background={postMessage:data=>sent.push(data)};
 try{
  w.DuneApp={getState:()=>({playerMode:false,strictReadOnly:false})};w.editEvent='edit';w.isPacket=d=>d?.protocol==='test';w.packet=(type,fields)=>({protocol:'test',type,...fields});w.validRoomId=x=>x==='room';w.validSession=x=>x==='session';w.ArchivesOwlbearBridge={authorizeSoundShowFrame:source=>source===background};
  w.eval(fs.readFileSync('src/v73/main-public.mjs','utf8').replace(/^import .*;\n/gm,'').replace('export function ','function '));w.installMainPublic({publicView:()=>({boards:[]})});
  await assert.rejects(w.ArchivesPresentationBridge.request({action:'present-image'}),/relier/);
  w.dispatchEvent(new w.MessageEvent('message',{source:background,origin:w.location.origin,data:{protocol:'test',type:'archives-main-public-ready',roomId:'room',session:'session'}}));
  const result=w.ArchivesPresentationBridge.request({action:'present-image',file:new w.Blob(['PNG'])}),request=sent.at(-1);assert.equal(request.type,'archives-main-image');
  let done=false;result.then(()=>done=true);
  const packet={protocol:'test',type:'archives-main-image-result',id:request.id,roomId:'room',session:'session',safe:true,result:{publication:'chosen-image'}};
  for(const fields of [{source:{},data:packet},{source:background,data:{...packet,session:'wrong'}},{source:background,data:{...packet,roomId:'wrong'}}])w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,...fields}));
  await Promise.resolve();assert.equal(done,false);
  w.dispatchEvent(new w.MessageEvent('message',{source:background,origin:w.location.origin,data:packet}));assert.equal((await result).publication,'chosen-image');
 }finally{w.close()}
});
