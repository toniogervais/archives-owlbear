import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {createPreview} from "./preview.js?v=231";
import {valid,imageFrame,independentCase} from "./math.js?v=231";
import {calibrate,undo,KEY} from "./align.js";
window.calBoot?.release(OBR);
const $=id=>document.getElementById(id);let ready=false,gm=false,started=false,epoch=0,seq=0,token=null,s=null,frame=null,busy=false,reading=false,record=null;
const status=(t,error=false)=>{$("status").textContent=t;$("status").classList.toggle("error",error)};
const editor=createPreview($("editor"),v=>{s={...s,...v};paint()},v=>{s={...s,...v};paint()});
function paint(){$("editor").hidden=!token;$("tools").hidden=!token;$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("read").disabled=!ready||!gm||busy||reading;$("apply").disabled=!ready||!gm||busy||reading||!valid(s)||!!record?.pending;$("undo").hidden=!record;$("undo").disabled=!ready||!gm||busy;editor.enabled(!busy&&!reading)}
function guard(e){if(e!==epoch||!ready)throw Error("Scène changée.");}
async function read(force=false,ids=null){if(!ready||!gm||busy)return;const e=epoch,n=++seq;reading=true;paint();try{
 const sel=ids||await OBR.player.getSelection();guard(e);if(n!==seq)return;
 if(sel?.length!==1){if(!token||force)status("Sélectionne un token sur la carte.",true);return}
 const [i]=await OBR.scene.items.getItems(sel);guard(e);if(n!==seq)return;
 if(i?.type!=="IMAGE"||i.layer==="MAP"){if(!token||force)status("Sélectionne un token, pas une carte.",true);return}
 if(!force&&token?.id===i.id)return;
 const [b,dpi]=await Promise.all([OBR.scene.items.getItemBounds([i.id]),OBR.scene.grid.getDpi()]);guard(e);if(n!==seq)return;
 token=i;frame=imageFrame(i,b);s=independentCase(b,dpi);$("editor").hidden=false;editor.set(i,frame,s);editor.fit();$("tokenName").textContent=i.name||"Token";status("Ajuste le carré jaune puis clique sur Calibrer.")
 }catch(e){status(e.message,true)}finally{if(n===seq){reading=false;paint()}}}
async function run(fn){if(busy||!ready||!gm)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(e){status(e.message||String(e),true)}finally{busy=false;try{guard(e);record=(await OBR.scene.getMetadata())[KEY]||null;guard(e)}catch{}paint()}}
$("read").onclick=()=>void read(true);$("plus").onclick=()=>editor.zoom(.8);$("minus").onclick=()=>editor.zoom(1.25);$("fit").onclick=()=>editor.fit();
$("apply").onclick=()=>run(async e=>{
 if(!token||!valid(s))throw Error("Calibre d’abord le token.");
 status("Calibrage et vérification des limites réelles…");
 const [fresh]=await OBR.scene.items.getItems([token.id]);guard(e);if(!fresh)throw Error("Token introuvable.");
 const b=await OBR.scene.items.getItemBounds([token.id]);guard(e);const current=imageFrame(fresh,b);
 if(Math.hypot(current.x-frame.x,current.y-frame.y)>.1||Math.abs(current.w-frame.w)>.1||Math.abs(current.h-frame.h)>.1||current.rotation!==frame.rotation)throw Error("Le token a changé : relis-le avant de calibrer.");
 const r=await calibrate(s,token.id,()=>guard(e));guard(e);
 try{const [t]=await OBR.scene.items.getItems([token.id]);guard(e);const b=await OBR.scene.items.getItemBounds([token.id]);guard(e);token=t;frame=imageFrame(t,b);s={x:r.corner.x+r.dpi/2,y:r.corner.y+r.dpi/2,size:r.dpi};editor.set(token,frame,s);editor.fit()}catch{token=null;s=null;frame=null;editor.set(null,null,null)}
 status("Calibrage confirmé par Owlbear : "+r.count+" objet(s), case native "+r.dpi+" px.")
});
$("undo").onclick=()=>run(async e=>{await undo(()=>guard(e));guard(e);token=null;s=null;frame=null;editor.set(null,null,null);status("Calibrage annulé.")});
function reset(){epoch++;seq++;token=null;s=null;frame=null;record=null;reading=false;editor.set(null,null,null);paint()}
async function load(){const e=epoch;record=(await OBR.scene.getMetadata())[KEY]||null;guard(e);paint();if(record?.pending)status("Opération interrompue : utilise Annuler.",true);else await read()}
async function init(){if(started||!OBR.isReady)return;started=true;try{gm=await OBR.player.getRole()==="GM";if(!gm){status("Réservé au MJ.",true);return}ready=await OBR.scene.isReady();status(ready?"Sélectionne un token.":"Ouvre une scène.");paint();OBR.scene.onReadyChange(r=>{ready=r;reset();if(r)load().catch(e=>status(e.message,true))});OBR.player.onChange(p=>{if(ready&&!busy&&p.selection?.length===1)void read(false,p.selection)});if(ready)await load()}catch(e){status(e.message,true)}}
paint();if(OBR.isAvailable){OBR.onReady(()=>void init());if(OBR.isReady)void init();setTimeout(()=>{if(!started)status("Connexion SDK absente. Rouvre le panneau.",true)},15000)}else status("Ouvre cette extension depuis Owlbear.",true);
