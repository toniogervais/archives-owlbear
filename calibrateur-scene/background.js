import {OBR,KEY,TOOL,MODE,state,write,render} from "./shared.js";
import {valid,drag} from "./math.js";
let current=null,bounds=null,gesture=null,pending=null,running=false,epoch=0;
function queue(s){pending={s,b:bounds,e:epoch};if(!running)void flush()}
async function flush(){running=true;try{while(pending){const p=pending;pending=null;if(p.e===epoch&&await OBR.scene.isReady())await render(p.s,p.b)}}catch(e){console.error("Calibrateur aperçu",e)}finally{running=false;if(pending)void flush()}}
async function sync(s){const e=epoch;current=s;gesture=null;bounds=null;if(s?.mapId&&s.active){try{bounds=await OBR.scene.items.getItemBounds([s.mapId])}catch{}}if(e===epoch&&current===s)queue(s)}
function start(e){if(valid(current)&&current.active)gesture={base:current,start:{...e.pointerPosition},next:current}}
function move(e){if(gesture){gesture.next=drag(gesture.base,gesture.start,e.pointerPosition);queue(gesture.next)}}
function cancel(){gesture=null;queue(current)}
async function end(e){if(!gesture)return;move(e);const g=gesture;gesture=null;try{const s=await state();if(s?.id===g.base.id&&s.active)await write(g.next)}catch(err){console.error(err);queue(current)}}
OBR.onReady(async()=>{try{if(await OBR.player.getRole()!=="GM")return;const icon=new URL("icon.svg",location.href).href;await OBR.tool.create({id:TOOL,icons:[{icon,label:"Calibrer la case",filter:{roles:["GM"]}}],defaultMode:MODE});await OBR.tool.createMode({id:MODE,icons:[{icon,label:"Déplacer la case / tirer un coin",filter:{activeTools:[TOOL]}}],onToolClick:()=>false,onToolDoubleClick:()=>false,onToolDragStart:(_,e)=>start(e),onToolDragMove:(_,e)=>move(e),onToolDragEnd:(_,e)=>void end(e),onToolDragCancel:cancel,onDeactivate:cancel});OBR.scene.onReadyChange(async ready=>{epoch++;current=null;gesture=null;bounds=null;pending=null;if(ready)await sync(await state())});OBR.scene.onMetadataChange(m=>{void sync(m[KEY]||null)});if(await OBR.scene.isReady())await sync(await state())}catch(e){console.error("Calibrateur",e)}});
