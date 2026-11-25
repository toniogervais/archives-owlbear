import OBR,{buildLine,buildPointer,buildText} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {measureCase,numberLabel} from "./measure.js";
import {calibrate,undo} from "./align.js";
import {captureCamera,preserveCamera,restoreCamera} from "./camera.js";
const ID="fr.toniogervais.calibrateur.v36",TOOL=ID+"/tool",MODE=ID+"/mode",TAG=ID+"/preview";
const icon=n=>"https://toniogervais.github.io/archives-owlbear/calibrateur-v360/"+n+".svg";
export function createRuler(api=OBR,builders={line:buildLine,pointer:buildPointer,text:buildText}){
 let active=false,ready=false,busy=false,epoch=0,zoomReading=false,lastZoomRead=0,a=null,b=null,done=false,zoom=1,drawn=[],desired=null,painting=false,viewBefore=null,referenceId=null;
 const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y),copy=p=>({x:p.x,y:p.y});
 const notify=(m,v="INFO")=>{void api.notification.show(m,v).catch(()=>{})};
 const guard=e=>{if(!ready||epoch!==e)throw Error("La scène a changé.")};
 const mark=x=>x.layer("POINTER").locked(true).disableHit(true).metadata({[TAG]:true});
 function models(s){
  const u=1/Math.max(.01,s.zoom),w=1.15*u,A=s.a,B=s.b||s.a,q=measureCase(A,B),color="#64eaff";
  const segment=(p,q,c,width)=>mark(builders.line()).startPosition(p).endPosition(q).strokeColor(c).strokeWidth(width).build();
  const cross=p=>[segment({x:p.x-4*u,y:p.y},{x:p.x+4*u,y:p.y},"#13202b",2.5*u),segment({x:p.x,y:p.y-4*u},{x:p.x,y:p.y+4*u},"#13202b",2.5*u),segment({x:p.x-4*u,y:p.y},{x:p.x+4*u,y:p.y},color,u),segment({x:p.x,y:p.y-4*u},{x:p.x,y:p.y+4*u},color,u)];
  const items=cross(A);
  if(q){
   items.push(mark(builders.line()).startPosition(A).endPosition(B).strokeColor("#15202e").strokeWidth(w*2).build(),mark(builders.line()).startPosition(A).endPosition(B).strokeColor(color).strokeWidth(w).build(),...cross(B));
   items.push(mark(builders.text()).position({x:q.x,y:q.y-25*u}).plainText(q.size.toFixed(3).replace(".",",")+" px • 1 case cible").textType("PLAIN").fontSize(16*u).fontWeight(700).textAlign("CENTER").fillColor(color).strokeColor("#101522").strokeWidth(3*u).build());
   if(s.done){const h=q.size/2,P=[{x:q.x-h,y:q.y-h},{x:q.x+h,y:q.y-h},{x:q.x+h,y:q.y+h},{x:q.x-h,y:q.y+h}];for(let i=0;i<4;i++)items.push(mark(builders.line()).startPosition(P[i]).endPosition(P[(i+1)%4]).strokeColor("#ffda52").strokeWidth(1*u).build())}
  }
  return items;
 }
 function request(){desired={epoch,a:a&&copy(a),b:b&&copy(b),done,zoom};if(!painting)void flush()}
 async function flush(){painting=true;try{while(desired){const s=desired;desired=null;if(!ready||s.epoch!==epoch)continue;const local=api.scene.local;
  if(!s.a){if(drawn.length)await local.deleteItems(drawn.map(x=>x.id));drawn=[];continue}
  const next=models(s);if(drawn.length!==next.length){if(drawn.length)await local.deleteItems(drawn.map(x=>x.id));drawn=[];if(s.epoch!==epoch||!ready)continue;await local.addItems(next);if(s.epoch===epoch)drawn=next;else continue}
  else{const target=next.map((x,i)=>({...x,id:drawn[i].id}));await local.updateItems(drawn,draft=>{for(const d of draft){const t=target.find(v=>v.id===d.id);if(t){for(const k of ["position","startPosition","endPosition","text","style","radius","color"])if(k in t)d[k]=t[k]}}},true);if(s.epoch===epoch)drawn=target}
 }}catch(e){notify("Repères : "+(e.message||String(e)),"ERROR");desired=null}finally{painting=false;if(desired)void flush()}}
 function clear(){a=null;b=null;done=false;request()}
 function start(p){a=copy(p);b=copy(p);done=false;request();notify("Point A placé. Déplace la souris et clique sur B.")}
 function move(p){if(!active||busy||!finite(p))return;if(!zoomReading&&Date.now()-lastZoomRead>200){zoomReading=true;lastZoomRead=Date.now();const e=epoch;void api.viewport.getScale().then(v=>{if(e===epoch&&active&&Number.isFinite(v)&&v>0&&v!==zoom){zoom=v;if(a)request()}}).catch(()=>{}).finally(()=>zoomReading=false)}if(!a||done)return;b=copy(p);request()}
 function click(p){if(!ready||!active||busy||!finite(p))return false;if(!a||done){start(p);return false}const q=measureCase(a,p);if(!q){notify("Distance trop courte.","WARNING");return false}b=copy(p);done=true;request();notify("Distance : "+numberLabel(q.size)+" px. Entrée ou ✓ pour calibrer.","SUCCESS");return false}
 async function apply(){if(!ready||!active||busy)return;if(!done||!measureCase(a,b)){notify("Place d'abord les points A et B.","WARNING");return}busy=true;const e=epoch,s=measureCase(a,b);try{
  const items=await api.scene.items.getItems();guard(e);const selected=await api.player.getSelection();guard(e);
  const tokens=items.filter(i=>i.type==="IMAGE"&&i.layer!=="MAP");
  const token=tokens.find(i=>i.id===referenceId)||tokens.find(i=>selected?.includes(i.id))||tokens[0];
  if(!token)throw Error("Place au moins un token sur la scène.");
  const view=await captureCamera(api.viewport,()=>guard(e));guard(e);
  const r=await calibrate(s,token.id,()=>guard(e),api);guard(e);viewBefore=view;try{await preserveCamera(api.viewport,view,s,r,()=>guard(e))}catch{}guard(e);clear();notify("Calibrage effectué. Vérifie la grille native.","SUCCESS");
 }catch(err){notify(err.message||String(err),"ERROR")}finally{busy=false}}
 async function revert(){if(!ready||busy)return;busy=true;const e=epoch;try{await undo(()=>guard(e),api);guard(e);try{await restoreCamera(api.viewport,viewBefore,()=>guard(e))}catch{}guard(e);viewBefore=null;clear();notify("Calibrage annulé.","SUCCESS")}catch(err){notify(err.message||String(err),"ERROR")}finally{busy=false}}
 function scene(r){epoch++;ready=r;drawn=[];desired=null;a=null;b=null;done=false;referenceId=null;viewBefore=null;if(r){const e=epoch;void api.scene.local.getItems(x=>x.metadata?.[TAG]===true).then(items=>{if(epoch===e&&ready&&items.length)return api.scene.local.deleteItems(items.map(i=>i.id))}).catch(()=>{})}}
 async function activate(){active=true;try{zoom=await api.viewport.getScale();const sel=await api.player.getSelection();referenceId=sel?.[0]||null}catch{}if(active)notify("Calibrateur : clique directement sur la carte pour placer A.")}
 function deactivate(){active=false;clear()}
 function nudge(ev){if(!active||busy||!done||!a||!b)return;const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=dirs[ev.key];if(!d)return;const step=ev.shiftKey?1:.1,origin=ev.altKey?a:b,next={x:origin.x+d[0]*step,y:origin.y+d[1]*step};if(!measureCase(ev.altKey?next:a,ev.altKey?b:next))return;if(ev.altKey)a=next;else b=next;request()}
 async function install(){
  scene(await api.scene.isReady());api.scene.onReadyChange(scene);
  await api.tool.createMode({id:MODE,icons:[{icon:icon("ruler"),label:"Mesurer A–B",filter:{activeTools:[TOOL],roles:["GM"]}}],cursors:[{cursor:"crosshair"}],onActivate:()=>void activate(),onDeactivate:deactivate,onToolClick:(_,ev)=>click(ev.pointerPosition),onToolMove:(_,ev)=>move(ev.pointerPosition),onToolDragMove:(_,ev)=>move(ev.pointerPosition),onToolDoubleClick:()=>false,onKeyDown:(_,ev)=>{if(ev.key==="Escape")clear();if(ev.key==="Enter"&&!ev.repeat)void apply();nudge(ev)}});
  await api.tool.create({id:TOOL,defaultMode:MODE,icons:[{icon:icon("ruler"),label:"Calibrateur V3.6",filter:{roles:["GM"]}}]});
  for(const [suffix,label,fn] of [["apply","Calibrer la grille",apply],["clear","Effacer les repères",clear],["undo","Annuler le calibrage",revert]])await api.tool.createAction({id:ID+"/"+suffix,icons:[{icon:icon(suffix),label,filter:{activeTools:[TOOL],roles:["GM"]}}],onClick:()=>void fn()});
 }
 return {install,scene,activate,deactivate,click,move,clear,apply,revert};
}
let initialized=false;function init(){if(initialized||!OBR.isReady)return;initialized=true;void (async()=>{if(await OBR.player.getRole()==="GM")await createRuler().install()})().catch(e=>OBR.notification.show("Calibrateur V3.6 : "+e.message,"ERROR"))}
window.calBoot?.release(OBR);OBR.onReady(init);if(OBR.isReady)init();
