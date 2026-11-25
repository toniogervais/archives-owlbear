import {OBR,KEY,TOOL,MODE,state,write,render} from "./shared.js?v=202";
import {valid,drag,handleAt} from "./math.js?v=202";
import {openPanel} from "./window.js";
window.calBoot?.release(OBR);
let current=null,bounds=null,gesture=null,pending=null,running=false,epoch=0;
function queue(s){pending={s,b:bounds,e:epoch};if(!running)void flush()}
async function flush(){running=true;try{while(pending){const p=pending;pending=null;if(p.e===epoch&&await OBR.scene.isReady())await render(p.s,p.b)}}catch(e){console.error("Calibrateur aperçu",e)}finally{running=false;if(pending)void flush()}}
async function sync(s){const e=epoch;current=s;gesture=null;bounds=null;if(s?.mapId&&s.active){try{bounds=await OBR.scene.items.getItemBounds([s.mapId])}catch{}}if(e===epoch&&current===s)queue(s)}
function start(e){gesture=null;if(valid(current)&&current.active){const h=handleAt(current,e.pointerPosition);if(h)gesture={base:current,start:{...e.pointerPosition},next:current,handle:h}}}
function move(e){if(gesture){gesture.next=drag(gesture.base,gesture.start,e.pointerPosition,gesture.handle);queue(gesture.next)}}
function cancel(){gesture=null;queue(current)}
async function end(e){if(!gesture)return;move(e);const g=gesture;gesture=null;try{const s=await state();if(s?.id===g.base.id&&s.active)await write(g.next)}catch(err){console.error(err);queue(current)}}
OBR.onReady(async()=>{try{if(await OBR.player.getRole()!=="GM")return;const icon=new URL("icon.svg",location.href).href;await OBR.tool.create({id:TOOL,icons:[{icon,label:"Calibrer la case",filter:{roles:["GM"]}}],defaultMode:MODE,onClick:()=>true});await OBR.tool.createMode({id:MODE,icons:[{icon,label:"Déplacer la case / tirer une des 8 poignées",filter:{activeTools:[TOOL]}}],onToolClick:()=>false,onToolDoubleClick:()=>false,onToolDragStart:(_,e)=>start(e),onToolDragMove:(_,e)=>move(e),onToolDragEnd:(_,e)=>void end(e),onToolDragCancel:cancel,onDeactivate:cancel});OBR.scene.onReadyChange(async ready=>{epoch++;current=null;gesture=null;bounds=null;pending=null;if(ready)await sync(await state())});OBR.scene.onMetadataChange(m=>{void sync(m[KEY]||null)});if(await OBR.scene.isReady())await sync(await state())}catch(e){console.error("Calibrateur",e)}});

OBR.onReady(async()=>{try{if(await OBR.player.getRole()!=="GM")return;await OBR.contextMenu.create({id:"fr.toniogervais.calibrateur/context202",icons:[{icon:new URL("icon.svg",location.href).href,label:"Calibrer ce token",filter:{roles:["GM"],min:1,max:1,every:[{key:"type",value:"IMAGE"}]}}],onClick:async(ctx)=>{try{const i=ctx.items[0];if(i?.layer==="MAP")return;await openPanel(OBR,location.href,i.id)}catch(e){await OBR.notification.show("Calibrateur : "+e.message,"ERROR")}}})}catch(e){console.error("Menu calibrateur",e)}});

import {buildPath,buildLabel,Command} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {GRID,getGrid,snapItems} from "./grid.js";
import {distance} from "./math.js?v=202";
const RID=GRID+"/ruler", RMODE=RID+"/mode", LM=RID+"/local";
let measureGrid=null,measuring=null,measurement=null,drawBusy=false,drawPending=false,measureEpoch=0;
async function drawMeasure(){if(drawBusy)return;drawBusy=true;try{while(drawPending){drawPending=false;const e=measureEpoch,m=measurement,g=measureGrid;const old=await OBR.scene.local.getItems(i=>i.metadata?.[LM]);if(e!==measureEpoch)continue;if(old.length)await OBR.scene.local.deleteItems(old.map(i=>i.id));if(e!==measureEpoch||!m||!g?.enabled)continue;const d=distance(m.a,m.b,g),line=buildPath().name("Règle calibrée").layer("RULER").position(m.a).commands([[Command.MOVE,0,0],[Command.LINE,m.b.x-m.a.x,m.b.y-m.a.y]]).strokeColor("#ffd24a").strokeWidth(3).fillOpacity(0).disableHit(true).metadata({[LM]:true}).build();const label=buildLabel().plainText(d.value.toFixed(2)+" m · "+d.cells.toFixed(2)+" cases").position({x:(m.a.x+m.b.x)/2,y:(m.a.y+m.b.y)/2}).disableHit(true).metadata({[LM]:true}).build();await OBR.scene.local.addItems([line,label])}}catch(e){console.error("Règle calibrée",e)}finally{drawBusy=false;if(drawPending)void drawMeasure()}}
function schedule(){drawPending=true;void drawMeasure()}
function clearMeasure(){measuring=null;measurement=null;schedule()}
OBR.onReady(async()=>{try{
 const icon=new URL("ruler.svg",location.href).href;
 await OBR.tool.create({id:RID,icons:[{icon,label:"Règle calibrée"}],defaultMode:RMODE});
 await OBR.tool.createMode({id:RMODE,icons:[{icon,label:"Mesurer en mètres",filter:{activeTools:[RID]}}],onToolDragStart:(_,e)=>{if(!measureGrid?.enabled){void OBR.notification.show("Active la grille calibrée.","WARNING");return}measuring={a:{...e.pointerPosition},b:{...e.pointerPosition}};measurement=measuring;schedule()},onToolDragMove:(_,e)=>{if(measuring){measurement=measuring={...measuring,b:{...e.pointerPosition}};schedule()}},onToolDragEnd:(_,e)=>{if(measuring){measurement={...measuring,b:{...e.pointerPosition}};measuring=null;schedule()}},onToolDragCancel:clearMeasure,onDeactivate:clearMeasure});
 OBR.scene.onReadyChange(async r=>{measureEpoch++;measuring=null;measurement=null;measureGrid=null;if(r){measureGrid=await getGrid();schedule()}});
 OBR.scene.onMetadataChange(m=>{measureGrid=m[GRID]||null;if(!measureGrid?.enabled)clearMeasure()});if(await OBR.scene.isReady())measureGrid=await getGrid();
 if(await OBR.player.getRole()==="GM")await OBR.contextMenu.create({id:GRID+"/snap",icons:[{icon:new URL("snap.svg",location.href).href,label:"Aligner sur la grille calibrée",filter:{roles:["GM"],min:1,every:[{key:"type",value:"IMAGE"}]}}],onClick:async ctx=>{try{await snapItems(ctx.items.map(i=>i.id),await getGrid())}catch(e){await OBR.notification.show(e.message,"ERROR")}}});
 }catch(e){console.error("Outils grille calibrée",e)}});
