import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {createPreview} from "./preview.js?v=231";
import {valid,imageFrame,independentCase,containsMap} from "./math.js?v=231";
import {calculate} from "./numeric.js";
import {settings,makeUpload} from "./asset.js";
window.calBoot?.release(OBR);
const $=id=>document.getElementById(id);let ready=false,started=false,epoch=0,sequence=0,token=null,frame=null,s=null,maps=[],dpi=0,reading=false,busy=false,gm=false;
const status=(t,error=false)=>{$("status").textContent=t;$("status").classList.toggle("error",error)};
const editor=createPreview($("editor"),v=>{s={...s,...v};paint()},v=>{s={...s,...v};paint()});
const fmt=x=>Number(x.toFixed(6)).toString();
function paint(){
 $("upload").disabled=true;$("source").disabled=busy;editor.enabled(!busy);$("map").disabled=busy;
 $("read").disabled=!ready||reading||busy;$("editor").hidden=!token;$("tools").hidden=!token;$("mapRow").hidden=!token;
 $("result").hidden=true;if(!valid(s))return;
 $("size").textContent=fmt(s.size)+" px scène";
 const m=maps.find(v=>v.item.id===$("map").value);if(!m)return;
 try{const v=calculate(s,m.item,m.frame,dpi);
 $("cols").value=fmt(v.columns);$("rows").value=fmt(v.rows);$("dpiX").value=fmt(v.dpiX);$("dpiY").value=fmt(v.dpiY);$("originX").value=fmt(v.originX);$("originY").value=fmt(v.originY);$("phaseX").value=fmt(v.phaseX);$("phaseY").value=fmt(v.phaseY);$("scaleX").value=fmt(v.scaleX);$("scaleY").value=fmt(v.scaleY);
 $("warning").textContent=!v.inside?"La case n’est pas entièrement sur la carte choisie.":v.rotated?"Carte tournée : les valeurs de taille restent utilisables, mais règle l’origine visuellement.":v.anisotropic?"Carte déformée : règle les deux axes séparément.":"";
 $("result").hidden=false;$("upload").disabled=!gm||!ready||reading||busy||!v.inside||v.rotated||v.anisotropic;
 }catch(e){status(e.message,true)}
}
async function read(force=false,selected=null){
 if(!ready||busy)return;const e=epoch,n=++sequence;reading=true;paint();
 try{
 const ids=selected||await OBR.player.getSelection();if(e!==epoch||n!==sequence)return;
 if(ids?.length!==1){if(force||!token)status("Sélectionne un seul token sur la carte.",true);return}
 const [i]=await OBR.scene.items.getItems(ids);if(e!==epoch||n!==sequence)return;
 if(i?.type!=="IMAGE"||i.layer==="MAP"){if(force||!token)status("Sélectionne un token, pas la carte.",true);return}
 if(!force&&token?.id===i.id)return;
 const [bounds,grid,all]=await Promise.all([OBR.scene.items.getItemBounds([i.id]),OBR.scene.grid.getDpi(),OBR.scene.items.getItems()]);if(e!==epoch||n!==sequence)return;
 const candidates=all.filter(m=>m.type==="IMAGE"&&m.layer==="MAP"&&m.visible!==false&&!m.metadata?.["fr.toniogervais.calibrateur/v24/session/image"]).sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));
 const records=await Promise.all(candidates.map(async item=>{try{return {item,frame:imageFrame(item,await OBR.scene.items.getItemBounds([item.id]))}}catch{return null}}));if(e!==epoch||n!==sequence)return;
 maps=records.filter(Boolean);dpi=grid;token=i;frame=imageFrame(i,bounds);s=independentCase(bounds,dpi);
 $("map").replaceChildren();for(const m of maps){const o=document.createElement("option");o.value=m.item.id;o.textContent=m.item.name||"Carte";$("map").append(o)}
 const match=maps.find(m=>containsMap(s,m.frame));if(match)$("map").value=match.item.id;
 $("tokenName").textContent=i.name||"Token";$("editor").hidden=false;editor.set(i,frame,s);editor.fit();status(maps.length?"Ajuste la case jaune puis crée la carte calibrée.":"Aucune carte MAP visible.",!maps.length);
 }catch(e){status(e.message||String(e),true)}finally{if(n===sequence){reading=false;paint()}}
}
$("read").onclick=()=>void read(true);$("map").onchange=paint;$("fit").onclick=()=>editor.fit();$("plus").onclick=()=>editor.zoom(.8);$("minus").onclick=()=>editor.zoom(1.25);
for(const id of ["cols","rows","dpiX","dpiY","originX","originY","phaseX","phaseY","scaleX","scaleY"]){$(id).onclick=()=>$(id).select();$(id+"Copy").onclick=async()=>{const field=$(id);field.select();try{await navigator.clipboard.writeText(field.value);status("Valeur copiée : "+field.value)}catch{status("Valeur sélectionnée : Ctrl+C pour copier.")}}}
$("upload").onclick=async()=>{
 if(busy||!ready||!gm||!valid(s))return;const e=epoch;const m=maps.find(v=>v.item.id===$("map").value);if(!m)return;
 const g=()=>{if(e!==epoch||!ready)throw Error("Scène changée.");};
 busy=true;paint();
 try{
 const [fresh]=await OBR.scene.items.getItems([m.item.id]);g();
 if(!fresh||JSON.stringify([fresh.position,fresh.scale,fresh.rotation,fresh.grid,fresh.image])!==JSON.stringify([m.item.position,m.item.scale,m.item.rotation,m.item.grid,m.item.image]))throw Error("La carte a changé : relis le token.");
 if(await OBR.scene.grid.getType()!=="SQUARE")throw Error("Choisis une grille carrée dans Owlbear.");g();
 const grid=settings(s,m.item,m.frame,dpi);await makeUpload(m.item,grid,$("source").files[0]||null,g,status);g();
 status("Demande d’import transmise. Place la carte « calibrée » depuis l’Atlas dans une scène de test.");
 }catch(err){status(err.message||String(err),true)}finally{busy=false;paint()}
};
function reset(){epoch++;sequence++;reading=false;token=null;frame=null;s=null;maps=[];dpi=0;editor.set(null,null,null);paint()}
async function init(){if(started||!OBR.isReady)return;started=true;try{gm=await OBR.player.getRole()==="GM";ready=await OBR.scene.isReady();status(ready?"Sélectionne un token.":"Ouvre une scène.");paint();OBR.scene.onReadyChange(r=>{ready=r;reset();if(r)void read();else status("Ouvre une scène.")});OBR.player.onChange(p=>{if(ready&&p.selection?.length===1)void read(false,p.selection)});if(ready)await read()}catch(e){status(e.message,true)}}
paint();if(OBR.isAvailable){OBR.onReady(()=>void init());if(OBR.isReady)void init();setTimeout(()=>{if(!started)status("Connexion SDK non reçue. Rouvre le panneau.",true)},15000)}else status("Installe le manifeste et ouvre le panneau dans Owlbear.",true);
