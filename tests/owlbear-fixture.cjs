const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const archives="https://archives.test",owl="https://www.owlbear.rodeo";
const viewerId="fr.archives-imaginaire.bridge/archives-viewer",inviteId="fr.archives-imaginaire.bridge/screen-invite-v55";

function fixture({sceneReady=false,inviteReadyDelay=0}={}) {
 return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Salle Owlbear</title>
 <button id="archives-tool" disabled>Afficher les Archives</button><script>
 const archives=${JSON.stringify(archives)},viewerId=${JSON.stringify(viewerId)},inviteId=${JSON.stringify(inviteId)};
 const params=new URLSearchParams(location.search);
 let role=params.has("joueur")?"PLAYER":"GM";
 const name=params.get("joueur")||"MJ",connectionId="fixture-"+name;
 const player={role,name,connectionId};
 const ref=btoa(location.origin+" fixture-single-room"),listeners=new Map();
 let localItems=[];const uploads=[],pickers={upload:0,download:0};let cancelPick=false;
 function post(frame,id,data){frame?.contentWindow?.postMessage({id,data},archives)}
 function allPost(id,data){for(const frame of document.querySelectorAll("iframe"))post(frame,id,data)}
 function modalFrame(id){return document.getElementById(id===viewerId?"viewer":id===inviteId?"invite":id)}
 function addFrame(url,id){
  modalFrame(id)?.remove();const frame=document.createElement("iframe"),target=new URL(url);target.searchParams.set("obrref",ref);
  frame.id=id===viewerId?"viewer":id===inviteId?"invite":id;
  frame.sandbox="allow-same-origin allow-scripts allow-downloads allow-forms";
  frame.style.cssText=id==="background"?"display:none":"position:fixed;inset:0;width:100%;height:100%;border:0";
  frame.addEventListener("load",()=>{
   const ready=()=>post(frame,"OBR_READY",{ref:frame.id,userId:connectionId});
   if(id===inviteId&&${inviteReadyDelay}>0)setTimeout(ready,${inviteReadyDelay});else ready();
  });
  frame.src=target.href;document.body.append(frame);return frame;
 }
 window.fixture={
  publish:(channel,data)=>fixtureHub("broadcast",{channel,data}),
  deliver(channel,event){for(const frame of document.querySelectorAll("iframe"))if(listeners.get(frame.contentWindow)?.has(channel))post(frame,"OBR_BROADCAST_MESSAGE_"+channel,event)},
  party:players=>allPost("OBR_PARTY_EVENT_CHANGE",{players}),
  sceneMetadata:metadata=>allPost("OBR_SCENE_METADATA_EVENT_CHANGE",{metadata}),
  sceneItems:items=>allPost("OBR_SCENE_ITEMS_EVENT_CHANGE",{items}),
  changeRole(value){role=value;player.role=value;allPost("OBR_PLAYER_EVENT_CHANGE",{player});fixtureHub("role",value)},
  moveLocal(id,position){localItems=localItems.map(item=>item.id===id?{...item,position}:item);allPost("OBR_SCENE_LOCAL_EVENT_CHANGE",{items:localItems})},
  injectLocal(item){localItems.push(item);allPost("OBR_SCENE_LOCAL_EVENT_CHANGE",{items:localItems})},
  local:()=>localItems,uploads:()=>uploads,pickers:()=>pickers,cancelPick:()=>{cancelPick=true},
  scene:()=>fixtureHub("scene"),wire:()=>fixtureHub("wire"),setScene:()=>fixtureHub("newScene"),
  moveShared:(id,position)=>fixtureHub("updateItems",{updates:[{id,position}]})
 };
 window.addEventListener("message",event=>{
  if(event.origin!==archives)return;const {id,data,nonce}=event.data;
  void(async()=>{let reply={};switch(id){
   case "OBR_TOOL_CREATE":{const tool=document.getElementById("archives-tool");tool.disabled=false;tool.onclick=()=>post(modalFrame("background"),"OBR_TOOL_EVENT_CLICK",{id:data.id,context:{}});break}
   case "OBR_PLAYER_GET_ROLE":reply={role};break;
   case "OBR_PLAYER_GET_CONNECTION_ID":reply={connectionId};break;
   case "OBR_SCENE_IS_READY":reply={ready:${sceneReady}};break;
   case "OBR_SCENE_GET_METADATA":reply={metadata:await fixtureHub("sceneMetadata")};break;
   case "OBR_SCENE_SET_METADATA":await fixtureHub("setSceneMetadata",data.update);break;
   case "OBR_SCENE_ITEMS_GET_ALL_ITEMS":reply={items:(await fixtureHub("scene")).items};break;
   case "OBR_SCENE_ITEMS_GET_ITEMS":reply={items:(await fixtureHub("scene")).items.filter(x=>data.ids.includes(x.id))};break;
   case "OBR_SCENE_ITEMS_ADD_ITEMS":await fixtureHub("addItems",data);break;
   case "OBR_SCENE_ITEMS_UPDATE_ITEMS":await fixtureHub("updateItems",data);break;
   case "OBR_SCENE_ITEMS_DELETE_ITEMS":await fixtureHub("deleteItems",data);break;
   case "OBR_SCENE_LOCAL_GET_ALL_ITEMS":reply={items:localItems};break;
   case "OBR_SCENE_LOCAL_GET_ITEMS":reply={items:localItems.filter(x=>data.ids.includes(x.id))};break;
   case "OBR_SCENE_LOCAL_ADD_ITEMS":localItems.push(...data.items);allPost("OBR_SCENE_LOCAL_EVENT_CHANGE",{items:localItems});break;
   case "OBR_SCENE_LOCAL_UPDATE_ITEMS":localItems=localItems.map(x=>({...x,...data.updates.find(v=>v.id===x.id)}));allPost("OBR_SCENE_LOCAL_EVENT_CHANGE",{items:localItems});break;
   case "OBR_SCENE_LOCAL_DELETE_ITEMS":localItems=localItems.filter(x=>!data.ids.includes(x.id));allPost("OBR_SCENE_LOCAL_EVENT_CHANGE",{items:localItems});break;
   case "OBR_VIEWPORT_GET_WIDTH":reply={width:1000};break;
   case "OBR_VIEWPORT_GET_HEIGHT":reply={height:800};break;
   case "OBR_VIEWPORT_INVERSE_TRANSFORM_POINT":reply={point:data.point};break;
   case "OBR_ASSETS_UPLOAD_IMAGES":
    pickers.upload++;
    for(const upload of data.images){
     const bitmap=await createImageBitmap(upload.file),canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;
     const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0);
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await upload.file.arrayBuffer())),n=>n.toString(16).padStart(2,"0")).join("");
     uploads.push({name:upload.name,hash,pixels:[...ctx.getImageData(Math.floor(bitmap.width/2),Math.floor(bitmap.height/2),1,1).data],corner:[...ctx.getImageData(0,0,1,1).data],image:{url:"https://images.owlbear.test/"+crypto.randomUUID()+".png",mime:upload.file.type,width:bitmap.width,height:bitmap.height},typeHint:data.typeHint});bitmap.close()
    }
    break;
   case "OBR_ASSETS_DOWNLOAD_IMAGES":pickers.download++;reply={images:cancelPick?[]:uploads.filter(x=>x.name===data.defaultSearch).slice(-1)};cancelPick=false;break;
   case "OBR_PARTY_GET_PLAYERS":reply={players:await fixtureHub("party")};break;
   case "OBR_ROOM_GET_METADATA":reply={metadata:await fixtureHub("metadata")};break;
   case "OBR_ROOM_SET_METADATA":await fixtureHub("setMetadata",data.update);break;
   case "OBR_BROADCAST_SUBSCRIBE":if(!listeners.has(event.source))listeners.set(event.source,new Set());listeners.get(event.source).add(data.channel);break;
   case "OBR_BROADCAST_UNSUBSCRIBE":listeners.get(event.source)?.delete(data.channel);break;
   case "OBR_BROADCAST_SEND_MESSAGE":await fixtureHub("broadcast",data);break;
   case "OBR_MODAL_OPEN":addFrame(data.url,data.id);break;
   case "OBR_MODAL_CLOSE":setTimeout(()=>modalFrame(data.id)?.remove(),0);break;
  }if(nonce)event.source.postMessage({id:id+"_RESPONSE"+nonce,data:reply},archives)})().catch(console.error);
 });
 fixtureHub("join",player).then(()=>addFrame(archives+"/background-v55.html?v=4180","background"));
 </script>`;
}
function hub(){
 const pages=new Map(),metadata={},sceneMetadata={},wire=[];let items=[];
 const alive=()=>Array.from(pages.keys()).filter(page=>!page.isClosed());
 const players=page=>alive().filter(other=>other!==page).map(other=>pages.get(other));
 const notify=()=>Promise.allSettled(alive().map(page=>page.evaluate(participants=>window.fixture.party(participants),players(page))));
 const notifyScene=()=>Promise.allSettled(alive().map(page=>page.evaluate(items=>window.fixture.sceneItems(items),items)));
 const notifyMetadata=()=>Promise.allSettled(alive().map(page=>page.evaluate(metadata=>window.fixture.sceneMetadata(metadata),sceneMetadata)));
 return async({page},op,value)=>{
  if(op==="join"){pages.set(page,value);void notify();return}
  if(op==="party")return players(page);
  if(op==="role"){pages.get(page).role=value;void notify();return}
  if(op==="metadata")return metadata;
  if(op==="setMetadata"){Object.assign(metadata,value);wire.push({op,value});return}
  if(op==="sceneMetadata")return sceneMetadata;
  if(op==="setSceneMetadata"){assert.equal(pages.get(page).role,"GM");Object.assign(sceneMetadata,value);wire.push({op,value});await notifyMetadata();return}
  if(op==="scene")return {items,metadata:sceneMetadata};
  if(op==="wire")return wire;
  if(op==="newScene"){for(const key of Object.keys(sceneMetadata))delete sceneMetadata[key];sceneMetadata['fr.archives-imaginaire.bridge/scene-key']=crypto.randomUUID();items=[];await notifyMetadata();await notifyScene();return}
  if(["addItems","updateItems","deleteItems"].includes(op)){
   assert.equal(pages.get(page).role,"GM");wire.push({op,value});
   if(op==="addItems"){for(const item of value.items){assert.ok(!items.some(x=>x.id===item.id));items.push(item)}}
   if(op==="updateItems")items=items.map(item=>({...item,...value.updates.find(x=>x.id===item.id)}));
   if(op==="deleteItems")items=items.filter(item=>!value.ids.includes(item.id));
   await notifyScene();return;
  }
  if(op==="broadcast"){
   const sender=pages.get(page);assert.ok(sender);
   assert.ok(Buffer.byteLength(JSON.stringify(value.data))<16384,"Owlbear message size");wire.push({op,value});
   await Promise.allSettled(alive().filter(other=>other!==page).map(other=>other.evaluate(({channel,event})=>window.fixture.deliver(channel,event),{channel:value.channel,event:{data:value.data,connectionId:sender.connectionId}})));
  }
 };
}
async function configure(context,fixtureHub,options={}){
 await context.exposeBinding("fixtureHub",fixtureHub);
 await context.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.origin===owl)return route.fulfill({contentType:"text/html",body:fixture(options)});
  if(url.origin!==archives)return route.abort();
  const file=path.resolve("."+url.pathname);
  if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
  const ext=path.extname(file);
  return route.fulfill({path:file,contentType:[".mjs",".js"].includes(ext)?"text/javascript":ext===".css"?"text/css":ext===".svg"?"image/svg+xml":"text/html"});
 });
}
module.exports={archives,owl,viewerId,inviteId,fixture,hub,configure};
