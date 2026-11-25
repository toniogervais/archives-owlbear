import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {measureInfo} from "./measure.js";
import {createPreview} from "./preview.js?v=231";
import {valid,imageFrame,fromBounds,containsMap} from "./math.js?v=231";
import {calibrate,undo,KEY} from "./align.js";
import {captureCamera,preserveCamera,restoreCamera} from "./camera.js";
window.calBoot?.release(OBR);
const $=id=>document.getElementById(id);let ready=false,gm=false,started=false,epoch=0,seq=0,token=null,s=null,frame=null,busy=false,reading=false,record=null,viewBefore=null,mode="square",pendingMeasure=false,context=null,gridDpi=null,gridScale=null,liveSize=null,lastSize=null;
const status=(t,error=false)=>{$("status").textContent=t;$("status").classList.toggle("error",error)};
const editor=createPreview($("editor"),v=>{s={...s,...v};paint()},v=>{s={...s,...v};paint()},state=>{pendingMeasure=state==="start";status(state==="start"?"Choisis le second point (ou termine le glisser).":state==="done"?"Distance mesurée. Clique sur Calibrer.":state==="invalid"?"Distance trop courte ou invalide. Recommence.":"Trace une distance ou clique sur deux points.",state==="invalid");$("traceStatus").textContent=state==="start"?"A placé — déplace la souris, puis clique B":state==="done"?"Mesure validée — clique Calibrer":state==="invalid"?"Distance trop courte — recommence":"Clique dans l’image pour placer A";paint()},length=>{liveSize=length;paint()});
function paint(){$("traceStatus").hidden=!token||mode!=="distance";const info=measureInfo(liveSize??s?.size,gridDpi,gridScale);$("measurements").hidden=!token;$("length").textContent=info.pixels;$("cells").textContent=info.cells;$("real").textContent=info.real;$("target").textContent=info.target;$("factor").textContent=info.factor;$("last").hidden=lastSize===null;$("last").textContent=lastSize===null?"":"Dernière référence avant calibrage : "+measureInfo(lastSize,gridDpi,gridScale).pixels;$("measurementTitle").textContent=liveSize!==null?"Mesure en cours":"Référence sélectionnée";$("modes").hidden=!token;$("context").hidden=!context;$("context").disabled=busy||reading;for(const m of ["square","distance","pan"]){$(m).disabled=busy||reading;$(m).classList.toggle("active",mode===m);$(m).setAttribute("aria-pressed",String(mode===m))}$("editor").hidden=!token;$("tools").hidden=!token;$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("read").disabled=!ready||!gm||busy||reading;$("apply").disabled=!ready||!gm||busy||reading||!valid(s)||pendingMeasure||!!record?.pending;$("undo").hidden=!record;$("undo").disabled=!ready||!gm||busy;editor.enabled(!busy&&!reading)}
function guard(e){if(e!==epoch||!ready)throw Error("Scène changée.");}
async function read(force=false,ids=null){if(!ready||!gm||busy||(!force&&ids?.[0]===token?.id))return;const e=epoch,n=++seq;reading=true;paint();try{
 const sel=ids||await OBR.player.getSelection();guard(e);if(n!==seq)return;
 if(sel?.length!==1){if(!token||force)status("Sélectionne un token sur la carte.",true);return}
 const [i]=await OBR.scene.items.getItems(sel);guard(e);if(n!==seq)return;
 if(i?.type!=="IMAGE"||i.layer==="MAP"){if(!token||force)status("Sélectionne un token, pas une carte.",true);return}
 if(!force&&token?.id===i.id)return;
 const [b,dpi,scale]=await Promise.all([OBR.scene.items.getItemBounds([i.id]),OBR.scene.grid.getDpi(),OBR.scene.grid.getScale().catch(()=>null)]);guard(e);if(n!==seq)return;
 gridDpi=dpi;gridScale=scale;lastSize=null;liveSize=null;token=i;frame=imageFrame(i,b);s=fromBounds(b);pendingMeasure=false;context=null;editor.context(null,null);mode="square";editor.mode(mode);$("editor").hidden=false;editor.set(i,frame,s);editor.fit();$("tokenName").textContent=i.name||"Token";status("Ajuste le carré ou choisis Distance.");reading=false;paint();
 try{const maps=await OBR.scene.items.getItems(x=>x.type==="IMAGE"&&x.layer==="MAP"&&x.visible!==false);guard(e);if(n!==seq)return;for(const map of maps){if(/video|webm|mp4/i.test((map.image.mime||"")+" "+map.image.url.split("?")[0]))continue;const mf=imageFrame(map,await OBR.scene.items.getItemBounds([map.id]));guard(e);if(n!==seq)return;if(containsMap(s,mf)){context={map,frame:mf};$("context").setAttribute("aria-pressed","true");editor.context(map,mf);break}}}catch{}
 }catch(e){status(e.message,true)}finally{if(n===seq){reading=false;paint()}}}
async function run(fn){if(busy||!ready||!gm)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(e){status(e.message||String(e),true)}finally{busy=false;try{guard(e);record=(await OBR.scene.getMetadata())[KEY]||null;guard(e)}catch{}paint()}}
for(const m of ["square","distance","pan"])$(m).onclick=()=>{mode=m;pendingMeasure=false;editor.mode(m);if(m==="square")status("Déplace ou redimensionne librement le carré.");if(m==="pan")status("Glisse pour déplacer l’aperçu. Reviens sur Distance pour mesurer.");paint()};
$("context").onclick=()=>{if(!context)return;const show=$("context").getAttribute("aria-pressed")!=="true";$("context").setAttribute("aria-pressed",String(show));editor.context(show?context.map:null,show?context.frame:null)};
$("read").onclick=()=>void read(true);$("plus").onclick=()=>editor.zoom(.8);$("minus").onclick=()=>editor.zoom(1.25);$("fit").onclick=()=>editor.fit();
$("apply").onclick=()=>run(async e=>{
 if(!token||!valid(s))throw Error("Calibre d’abord le token.");
 status("Calibrage et vérification des limites réelles…");
 const [fresh]=await OBR.scene.items.getItems([token.id]);guard(e);if(!fresh)throw Error("Token introuvable.");
 const b=await OBR.scene.items.getItemBounds([token.id]);guard(e);const current=imageFrame(fresh,b);
 if(Math.hypot(current.x-frame.x,current.y-frame.y)>.1||Math.abs(current.w-frame.w)>.1||Math.abs(current.h-frame.h)>.1||current.rotation!==frame.rotation)throw Error("Le token a changé : relis-le avant de calibrer.");
 const reference={...s};const view=await captureCamera(OBR.viewport,()=>guard(e));guard(e);
 const r=await calibrate(reference,token.id,()=>guard(e));guard(e);
 lastSize=reference.size;gridDpi=r.dpi;viewBefore=view;pendingMeasure=false;mode="square";editor.mode(mode);context=null;editor.context(null,null);let kept=false;try{kept=await preserveCamera(OBR.viewport,view,reference,r,()=>guard(e))}catch{}guard(e);
 try{const [t]=await OBR.scene.items.getItems([token.id]);guard(e);const b=await OBR.scene.items.getItemBounds([token.id]);guard(e);token=t;frame=imageFrame(t,b);s={x:r.corner.x+r.dpi/2,y:r.corner.y+r.dpi/2,size:r.dpi};editor.set(token,frame,s);editor.fit()}catch{token=null;s=null;frame=null;editor.set(null,null,null)}
 status("Contrôle des dimensions réussi : "+r.count+" objet(s). "+(kept?"Vue compensée.":"Si nécessaire, recentre la carte.")+" Vérifie la grille visuellement.")
});
$("undo").onclick=()=>run(async e=>{await undo(()=>guard(e));guard(e);try{await restoreCamera(OBR.viewport,viewBefore,()=>guard(e))}catch{}guard(e);viewBefore=null;context=null;pendingMeasure=false;lastSize=null;liveSize=null;token=null;s=null;frame=null;editor.set(null,null,null);status("Calibrage annulé.")});
function reset(){gridDpi=null;gridScale=null;liveSize=null;lastSize=null;context=null;pendingMeasure=false;viewBefore=null;epoch++;seq++;token=null;s=null;frame=null;record=null;reading=false;editor.set(null,null,null);paint()}
async function load(){const e=epoch;record=(await OBR.scene.getMetadata())[KEY]||null;guard(e);paint();if(record?.pending)status("Opération interrompue : utilise Annuler.",true);else await read()}
async function init(){if(started||!OBR.isReady)return;started=true;try{gm=await OBR.player.getRole()==="GM";if(!gm){status("Réservé au MJ.",true);return}ready=await OBR.scene.isReady();status(ready?"Sélectionne un token.":"Ouvre une scène.");paint();OBR.scene.onReadyChange(r=>{ready=r;reset();if(r)load().catch(e=>status(e.message,true))});OBR.player.onChange(p=>{if(ready&&!busy&&p.selection?.length===1&&p.selection[0]!==token?.id)void read(false,p.selection)});if(ready)await load()}catch(e){status(e.message,true)}}
paint();if(OBR.isAvailable){OBR.onReady(()=>void init());if(OBR.isReady)void init();setTimeout(()=>{if(!started)status("Connexion SDK absente. Rouvre le panneau.",true)},15000)}else status("Ouvre cette extension depuis Owlbear.",true);
