import {OBR,KEY,UNDO,write} from "./shared.js?v=131";
import {valid,independentCase,imageFrame,image,maps,pickMap,descendsFrom,transform,snapshot,closeTransform} from "./math.js?v=131";
import {createPreview} from "./preview.js?v=131";
const $=id=>document.getElementById(id);let items=[],s=null,frame=null,token=null,backup=null,ready=false,gm=false,busy=false,epoch=0,showGrid=false;
const isToken=i=>image(i)&&i.layer!=="MAP";
function msg(t,error=false){$("status").textContent=t;$("status").classList.toggle("error",error)}
function guard(e){if(e!==epoch||!ready)throw Error("La scène a changé.")}
const editor=createPreview($("editor"),v=>{s={...s,...v,applied:false};paintSize()},v=>{s={...s,...v,applied:false};paintSize();if(showGrid)void run(async()=>{await write({...s,active:true,full:true});msg("Aperçu actualisé.")})});
function paintSize(){$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("apply").disabled=busy||!ready||!gm||!valid(s)||s.applied===true||!$("map").value}
function options(el,list,preferred,placeholder){const old=preferred??el.value;el.replaceChildren();const blank=document.createElement("option");blank.value="";blank.textContent=placeholder;el.append(blank);for(const i of list){const o=document.createElement("option");o.value=i.id;o.textContent=(i.name||"Image")+(el.id==="map"&&i.layer!=="MAP"?" ("+i.layer+")":"");el.append(o)}el.value=list.some(i=>i.id===old)?old:""}
function mapList(){const tid=token?.id||$("tokens").value,list=maps(items,tid),id=pickMap(items,tid,s?.mapId||$("map").value);options($("map"),list,id,list.length?"Choisir la carte…":"Aucune carte détectée");$("maprow").hidden=!!id&&list.length===1&&list[0].layer==="MAP";if(s)s={...s,mapId:id}}
function paint(){const ok=gm&&ready&&!busy;$("pick").disabled=!ok||!$("tokens").value;$("tokens").disabled=!ok;$("map").disabled=!ok;$("visual").hidden=!token;$("undo").hidden=!backup;$("undo").disabled=!ok;$("test").disabled=!ok||!token||!$("map").value;$("test").textContent=showGrid?"Masquer l’aperçu":"Voir la grille d’essai";editor.enabled(ok);paintSize()}
function lists(preferred){options($("tokens"),items.filter(isToken),preferred,"Choisir un token…");mapList();paint()}
async function run(fn){if(busy||!ready||!gm)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(err){msg(err?.message||String(err),true)}finally{busy=false;paint()}}
async function refresh(e){const [a,m,sel]=await Promise.all([OBR.scene.items.getItems(),OBR.scene.getMetadata(),OBR.player.getSelection()]);guard(e);items=a;backup=m[UNDO]||null;const selected=a.filter(i=>isToken(i)&&sel?.includes(i.id));lists(selected.length===1?selected[0].id:undefined)}
$("tokens").onchange=()=>{if(!token)mapList();paint()};
$("map").onchange=()=>{if(s)s={...s,mapId:$("map").value,applied:false};paint()};
$("pick").onclick=()=>run(async e=>{const id=$("tokens").value;const fresh=await OBR.scene.items.getItems([id]);guard(e);const picked=fresh.find(i=>i.id===id&&isToken(i));if(!picked)throw Error("Le token choisi n’est plus présent sur la scène.");const [b,d]=await Promise.all([OBR.scene.items.getItemBounds([id]),OBR.scene.grid.getDpi()]);guard(e);frame=imageFrame(picked,b);token=picked;s={id:crypto.randomUUID(),...independentCase(b,d),tokenId:id,mapId:pickMap(items,id,$("map").value),active:false,full:false,applied:false};showGrid=false;mapList();await write(s);guard(e);$("tokenName").textContent=token.name||"Token";$("visual").hidden=false;editor.set(token,frame,s);editor.fit();msg("Ajuste le carré jaune sur le dessin.");paint()});
$("zoomIn").onclick=()=>editor.zoom(.8);$("zoomOut").onclick=()=>editor.zoom(1.25);$("fit").onclick=()=>editor.fit();
$("test").onclick=()=>run(async e=>{showGrid=!showGrid;s={...s,mapId:$("map").value,active:showGrid,full:showGrid};await write(s);guard(e);msg(showGrid?"Grille d’essai affichée.":"Grille d’essai masquée.")});
async function change(targets){const byId=new Map(targets.map(t=>[t.id,t]));await OBR.scene.items.updateItems(i=>byId.has(i.id),draft=>{for(const i of draft){const t=byId.get(i.id);i.position={...t.position};i.scale={...t.scale}}})}
$("apply").onclick=()=>run(async e=>{
 const p={...s,mapId:$("map").value};if(!valid(p))throw Error("Case invalide.");
 msg("Recherche de la carte…");const all=await OBR.scene.items.getItems();guard(e);
 const id=pickMap(all,p.tokenId,p.mapId),map=all.find(i=>i.id===id);
 if(!map){items=all;mapList();throw Error(maps(all,p.tokenId).length?"Choisis la carte à calibrer dans la liste.":"Aucune image de carte dans cette scène. Ajoute une carte puis réessaie.")}
 if(map.attachedTo||all.some(i=>descendsFrom(i,id,all)))throw Error("Des éléments sont attachés à la carte. Détache-les pour éviter de les déplacer.");
 const [d,type,priorOpacity,oldMeta]=await Promise.all([OBR.scene.grid.getDpi(),OBR.scene.grid.getType(),OBR.scene.grid.getOpacity(),OBR.scene.getMetadata()]);guard(e);
 if(type!=="SQUARE")throw Error("Choisis une grille carrée dans les réglages natifs Owlbear.");
 const k=d/p.size;if(!Number.isFinite(k)||k<.01||k>100)throw Error("Taille de case hors limites.");
 const origin={x:p.x-p.size/2,y:p.y-p.size/2},target=await OBR.scene.grid.snapPosition(origin,1,true);guard(e);
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))throw Error("Alignement natif indisponible.");
 const before=[snapshot(map)],after=[transform(map,origin,target,k)],nextOpacity=priorOpacity<.01?.55:priorOpacity;
 const record={before,after,priorOpacity,nextOpacity,mapId:id,calibration:{...p,mapId:id},version:131};let stored=false,attempted=false;
 try{await OBR.scene.setMetadata({[UNDO]:record});stored=true;guard(e);msg("Application à la carte…");attempted=true;await change(after);guard(e);
 if(nextOpacity!==priorOpacity){await OBR.scene.grid.setOpacity(nextOpacity);guard(e)}
 let confirmed=false;for(let j=0;j<5;j++){const now=await OBR.scene.items.getItems([id]);guard(e);if(closeTransform(now.find(i=>i.id===id),after[0])){confirmed=true;break}if(j<4)await new Promise(r=>setTimeout(r,150))}
 if(!confirmed)throw Error("Owlbear n’a pas confirmé la transformation de la carte.");
 const applied={...p,mapId:id,active:false,full:false,applied:true};await OBR.scene.setMetadata({[KEY]:applied,[UNDO]:record});guard(e);backup=record;s=applied;showGrid=false;msg("Calibration appliquée à la carte. Token inchangé.")
 }catch(err){try{guard(e)}catch{throw Error("Scène changée. Vérifie la scène précédente et utilise Annuler si nécessaire.")}try{if(attempted){await change(before);guard(e);if(nextOpacity!==priorOpacity)await OBR.scene.grid.setOpacity(priorOpacity);guard(e)}if(stored)await OBR.scene.setMetadata({[UNDO]:oldMeta[UNDO]??null,[KEY]:oldMeta[KEY]??p})}catch{backup=record;throw Error("Transfert interrompu : sauvegarde conservée, utilise Annuler.")}throw err}
});
$("undo").onclick=()=>run(async e=>{const m=(await OBR.scene.getMetadata())[UNDO];guard(e);if(!m)throw Error("Aucune calibration à annuler.");const all=await OBR.scene.items.getItems();guard(e);const id=m.mapId||m.calibration?.mapId;const targets=m.before.filter(t=>t.id===id&&t.id!==m.calibration?.tokenId&&all.some(i=>i.id===t.id&&image(i)));if(targets.length!==1)throw Error("Carte de sauvegarde introuvable.");if(all.some(i=>descendsFrom(i,id,all)))throw Error("Détache les éléments de la carte avant restauration.");await change(targets);guard(e);if(typeof m.priorOpacity==="number")await OBR.scene.grid.setOpacity(m.priorOpacity);guard(e);await OBR.scene.setMetadata({[UNDO]:null,[KEY]:{...m.calibration,active:false,full:false,applied:false}});guard(e);backup=null;s=null;token=null;frame=null;showGrid=false;editor.set(null,null,null);await refresh(e);msg("Carte restaurée.")});
OBR.onReady(async()=>{try{gm=await OBR.player.getRole()==="GM";if(!gm){msg("Réservé au MJ.");return}ready=await OBR.scene.isReady();if(ready){await refresh(epoch);msg("Choisis le token puis charge-le.")}else msg("Ouvre une scène.");OBR.scene.onReadyChange(async r=>{epoch++;ready=r;s=null;token=null;frame=null;backup=null;showGrid=false;items=[];editor.set(null,null,null);lists();if(r)try{await refresh(epoch);msg("Choisis le token puis charge-le.")}catch(e){msg(e.message,true)}});OBR.scene.items.onChange(a=>{items=a;if(!busy)lists()});OBR.player.onChange(p=>{if(!busy){const sel=items.filter(i=>isToken(i)&&p.selection?.includes(i.id));if(sel.length===1){$("tokens").value=sel[0].id;paint()}}});OBR.scene.onMetadataChange(m=>{if(!busy){backup=m[UNDO]||null;const q=m[KEY];if(token&&showGrid&&q?.id===s?.id&&valid(q)){s={...q};editor.set(token,frame,s)}paint()}})}catch(e){msg(e.message,true)}});
setTimeout(()=>{if(!OBR.isReady)msg("Ouvre cette extension dans Owlbear.",true)},5000);
