import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {createPreview} from "./preview.js?v=231";
import {valid,imageFrame,independentCase,containsMap} from "./math.js?v=231";
import {getSession,prepare,restore,clearLegacy} from "./swap.js";
import {cleanup} from "./cleanup.js";
window.calBoot?.release(OBR);
const $=id=>document.getElementById(id);let ready=false,gm=false,busy=false,epoch=0,rec=null,token=null,s=null,frame=null,maps=[],started=false,seq=0;
const editor=createPreview($("editor"),v=>{s={...s,...v};paint()},v=>{s={...s,...v};paint()});
function status(t,error=false){$("status").textContent=t;$("status").classList.toggle("error",error)}
function guard(e){if(e!==epoch||!ready)throw Error("Scène changée.")}
function paint(){$("calibration").hidden=!!rec;$("active").hidden=!rec;$("editor").hidden=!token;$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("start").disabled=!ready||!gm||busy||!!rec||!valid(s)||!$("map").value;$("read").disabled=!ready||!gm||busy||!!rec;$("finish").disabled=!ready||!gm||busy||!rec;$("cancel").disabled=$("finish").disabled;$("map").disabled=busy;$("source").disabled=busy;editor.enabled(!busy&&!rec)}
async function select(e,ids){if(rec||busy||!gm||!ready)return;const n=++seq;const selected=ids||await OBR.player.getSelection();guard(e);if(selected?.length!==1)return;
 const [i]=await OBR.scene.items.getItems(selected);guard(e);if(n!==seq||i?.type!=="IMAGE"||i.layer==="MAP")return;if(token?.id===i.id)return;
 const [b,dpi]=await Promise.all([OBR.scene.items.getItemBounds([i.id]),OBR.scene.grid.getDpi()]);guard(e);if(n!==seq)return;
 token=i;frame=imageFrame(i,b);s=independentCase(b,dpi);editor.set(i,frame,s);editor.fit();$("tokenName").textContent=i.name||"Token";
 let match="";for(const m of maps){const b=await OBR.scene.items.getItemBounds([m.id]);guard(e);if(containsMap(s,imageFrame(m,b))){match=m.id;break}}if(match)$("map").value=match;paint();status("Ajuste la case jaune, puis prépare la carte.")
}
async function load(e){rec=await getSession();guard(e);if(rec){paint();status("Carte temporairement marquée. Valide ou annule après Align Image.");return}const all=await OBR.scene.items.getItems();guard(e);maps=all.filter(i=>i.type==="IMAGE"&&i.layer==="MAP"&&i.visible!==false&&!i.metadata?.["fr.toniogervais.calibrateur/v24/session/image"]);maps.sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));$("map").replaceChildren();for(const m of maps){const o=document.createElement("option");o.value=m.id;o.textContent=m.name||"Carte";$("map").append(o)}paint();await select(e)}
async function run(fn){if(busy||!gm||!ready)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(err){status(err.message||String(err),true)}finally{busy=false;try{guard(e);rec=await getSession();guard(e)}catch{}paint()}}
$("read").onclick=()=>select(epoch).catch(e=>status(e.message,true));
$("map").onchange=paint;
$("fit").onclick=()=>editor.fit();$("plus").onclick=()=>editor.zoom(.8);$("minus").onclick=()=>editor.zoom(1.25);
$("start").onclick=()=>run(async e=>{if(!valid(s))throw Error("Calibre d’abord le token.");const g=()=>guard(e);status("Nettoyage des anciens supports…");await clearLegacy(g);g();const c=await cleanup({reset:true,guard:g});g();if(c.remaining)throw Error("Des objets de grille protégés restent dans la scène.");status("Incrustation temporaire de la case…");rec=await prepare(s,$("map").value,$("source").files[0]||null,g);g();status("Carte sélectionnée. Ferme ce panneau, utilise Align Image (Z), puis rouvre le panneau pour valider.")});
$("finish").onclick=()=>run(async e=>{await restore(false,()=>guard(e));rec=null;token=null;s=null;editor.set(null,null,null);status("Image originale restaurée. Alignement conservé.");});
$("cancel").onclick=()=>run(async e=>{await restore(true,()=>guard(e));rec=null;token=null;s=null;editor.set(null,null,null);status("Image et réglages d’origine restaurés.")});
async function init(){if(started||!OBR.isReady)return;started=true;try{gm=await OBR.player.getRole()==="GM";if(!gm){status("Réservé au MJ.");return}ready=await OBR.scene.isReady();if(ready)await load(epoch);else status("Ouvre une scène.");
 OBR.scene.onReadyChange(r=>{epoch++;seq++;ready=r;rec=null;token=null;s=null;frame=null;maps=[];editor.set(null,null,null);paint();if(r)load(epoch).catch(e=>status(e.message,true))});OBR.player.onChange(p=>{if(!rec&&!busy&&ready)select(epoch,p.selection).catch(e=>status(e.message,true))})
 }catch(e){status(e.message,true)}}
paint();if(OBR.isAvailable){OBR.onReady(()=>void init());if(OBR.isReady)void init()}else status("Ouvre cette extension dans Owlbear.",true);
