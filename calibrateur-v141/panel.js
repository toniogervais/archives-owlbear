import {OBR,KEY,UNDO,write} from "./shared.js?v=141";
import {valid,independentCase,imageFrame,image,maps,pickMap,descendsFrom,transform,snapshot,closeTransform,selectedToken} from "./math.js?v=141";
import {createPreview} from "./preview.js?v=141";
import {openPanel,PANEL} from "./window.js";
const query=new URLSearchParams(location.search),floating=query.has("floating");
const $=id=>document.getElementById(id);let items=[],s=null,frame=null,token=null,backup=null,ready=false,gm=false,busy=false,epoch=0,showGrid=false,selection=[],selectionSeq=0,loading=false,polling=false,pollTimer=null,queued=false;
const isToken=i=>image(i)&&i.layer!=="MAP";
function msg(t,error=false){$("status").textContent=t;$("status").classList.toggle("error",error)}
function guard(e){if(e!==epoch||!ready)throw Error("La scène a changé.")}
const editor=createPreview($("editor"),v=>{s={...s,...v,applied:false};paintSize()},v=>{s={...s,...v,applied:false};paintSize();if(showGrid)void run(async()=>{await write({...s,active:true,full:true});msg("Aperçu actualisé.")})});
function paintSize(){$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("apply").disabled=busy||loading||!ready||!gm||!valid(s)||s.applied===true||!$("map").value}
function options(el,list,preferred,placeholder){const old=preferred??el.value;el.replaceChildren();const blank=document.createElement("option");blank.value="";blank.textContent=placeholder;el.append(blank);for(const i of list){const o=document.createElement("option");o.value=i.id;o.textContent=(i.name||"Image")+(el.id==="map"&&i.layer!=="MAP"?" ("+i.layer+")":"");el.append(o)}el.value=list.some(i=>i.id===old)?old:""}
function mapList(){const tid=token?.id||"",list=maps(items,tid),id=pickMap(items,tid,s?.mapId||$("map").value);options($("map"),list,id,list.length?"Choisir la carte…":"Aucune carte détectée");$("maprow").hidden=!!id&&list.length===1&&list[0].layer==="MAP";if(s)s={...s,mapId:id}}
function paint(){const ok=gm&&ready&&!busy;$("read").disabled=!ok||loading;$("float").disabled=!ok;$("map").disabled=!ok;$("visual").hidden=!token;$("undo").hidden=!backup;$("undo").disabled=!ok;$("test").disabled=!ok||loading||!token||!$("map").value;$("test").textContent=showGrid?"Masquer l’aperçu":"Voir la grille d’essai";editor.enabled(ok&&!loading);paintSize()}
function lists(){mapList();paint()}
async function run(fn){if(busy||loading||!ready||!gm)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(err){msg(err?.message||String(err),true)}finally{busy=false;paint();void followSelection()}}
async function refresh(e){const [a,m,sel]=await Promise.all([OBR.scene.items.getItems(),OBR.scene.getMetadata(),OBR.player.getSelection()]);guard(e);items=a;backup=m[UNDO]||null;selection=sel||[];lists();await followSelection(query.get("token")||undefined)}
async function followSelection(forced){if(busy||!ready||!gm)return;if(loading){queued=true;return}
 const e=epoch;loading=true;paint();try{
 const current=await OBR.player.getSelection();guard(e);selection=current||[];
 const ids=forced?[forced]:selection;
 if(ids.length!==1){if(!token||forced)msg(ids.length?"Sélectionne un seul token.":"Sélectionne un token avec la flèche Owlbear.");return}
 if(ids[0]===token?.id&&!forced)return;
 msg("Lecture du token sélectionné…");
 const fresh=await OBR.scene.items.getItems(ids);guard(e);const picked=fresh.find(i=>i.id===ids[0]&&isToken(i));
 if(!picked){msg("L’objet sélectionné n’est pas une image de token.");return}
 const [b,d]=await Promise.all([OBR.scene.items.getItemBounds([picked.id]),OBR.scene.grid.getDpi()]);guard(e);
 const fr=imageFrame(picked,b);if(!picked.image.url)throw Error("Adresse de l’image du token indisponible.");
 if(!forced){const check=await OBR.player.getSelection();guard(e);if(check?.length!==1||check[0]!==picked.id){queued=true;return}}
 const next={id:crypto.randomUUID(),...independentCase(b,d),tokenId:picked.id,mapId:pickMap(items,picked.id,$("map").value),active:false,full:false,applied:false};
 frame=fr;token=picked;s=next;showGrid=false;mapList();$("tokenName").textContent=picked.name||"Token";$("position").textContent="X "+Math.round(fr.x*100)/100+" · Y "+Math.round(fr.y*100)/100;$("visual").hidden=false;editor.set(token,frame,s);editor.fit();msg("Token chargé. Ajuste la case jaune.");
 // Display first. Preview metadata failure must not prevent showing the image.
 try{await write(next)}catch(err){msg("Token chargé ; synchronisation de l’aperçu : "+err.message,true)}
 }catch(err){if(e===epoch)msg("Lecture du token : "+(err?.message||String(err)),true)}finally{if(e===epoch){loading=false;paint();if(queued){queued=false;void followSelection()}}}}
async function poll(){if(polling||loading||busy||!ready||!gm)return;polling=true;try{const sel=await OBR.player.getSelection();if(JSON.stringify(sel||[])!==JSON.stringify(selection)||(!token&&sel?.length===1))await followSelection()}catch(e){msg("Sélection : "+e.message,true)}finally{polling=false}}
$("read").onclick=async()=>{try{const ids=await OBR.player.getSelection();if(ids?.length===1)await followSelection(ids[0]);else msg("Sélectionne exactement un token sur la carte.",true)}catch(e){msg(e.message,true)}};
$("float").hidden=floating;$("float").onclick=()=>openPanel(OBR,location.href,token?.id).catch(e=>msg(e.message,true));
$("map").onchange=()=>{if(s)s={...s,mapId:$("map").value,applied:false};paint()};
$("close").hidden=!floating;$("close").onclick=()=>OBR.popover.close(PANEL).catch(e=>msg(e.message,true));
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
 const origin={x:p.x-p.size/2,y:p.y-p.size/2},target=await OBR.scene.grid.snapPosition(origin,1,true,false);guard(e);
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))throw Error("Alignement natif indisponible.");
 const before=[snapshot(map)],after=[transform(map,origin,target,k)],nextOpacity=priorOpacity<.01?.55:priorOpacity;
 const record={before,after,priorOpacity,nextOpacity,mapId:id,calibration:{...p,mapId:id},version:141};let stored=false,attempted=false;
 try{await OBR.scene.setMetadata({[UNDO]:record});stored=true;guard(e);msg("Application à la carte…");attempted=true;await change(after);guard(e);
 if(nextOpacity!==priorOpacity){await OBR.scene.grid.setOpacity(nextOpacity);guard(e)}
 let confirmed=false;for(let j=0;j<5;j++){const now=await OBR.scene.items.getItems([id]);guard(e);if(closeTransform(now.find(i=>i.id===id),after[0])){confirmed=true;break}if(j<4)await new Promise(r=>setTimeout(r,150))}
 if(!confirmed)throw Error("Owlbear n’a pas confirmé la transformation de la carte.");
 const applied={...p,mapId:id,active:false,full:false,applied:true};await OBR.scene.setMetadata({[KEY]:applied,[UNDO]:record});guard(e);backup=record;s=applied;showGrid=false;msg("Calibration appliquée à la carte. Token inchangé.")
 }catch(err){try{guard(e)}catch{throw Error("Scène changée. Vérifie la scène précédente et utilise Annuler si nécessaire.")}try{if(attempted){await change(before);guard(e);if(nextOpacity!==priorOpacity)await OBR.scene.grid.setOpacity(priorOpacity);guard(e)}if(stored)await OBR.scene.setMetadata({[UNDO]:oldMeta[UNDO]??null,[KEY]:oldMeta[KEY]??p})}catch{backup=record;throw Error("Transfert interrompu : sauvegarde conservée, utilise Annuler.")}throw err}
});
$("undo").onclick=()=>run(async e=>{const m=(await OBR.scene.getMetadata())[UNDO];guard(e);if(!m)throw Error("Aucune calibration à annuler.");const all=await OBR.scene.items.getItems();guard(e);const id=m.mapId||m.calibration?.mapId;const targets=m.before.filter(t=>t.id===id&&t.id!==m.calibration?.tokenId&&all.some(i=>i.id===t.id&&image(i)));if(targets.length!==1)throw Error("Carte de sauvegarde introuvable.");if(all.some(i=>descendsFrom(i,id,all)))throw Error("Détache les éléments de la carte avant restauration.");await change(targets);guard(e);if(typeof m.priorOpacity==="number")await OBR.scene.grid.setOpacity(m.priorOpacity);guard(e);await OBR.scene.setMetadata({[UNDO]:null,[KEY]:{...m.calibration,active:false,full:false,applied:false}});guard(e);backup=null;s=null;token=null;frame=null;showGrid=false;editor.set(null,null,null);await refresh(e);msg("Carte restaurée.")});
OBR.onReady(async()=>{try{gm=await OBR.player.getRole()==="GM";if(!gm){msg("Réservé au MJ.");return}ready=await OBR.scene.isReady();if(ready){await refresh(epoch);if(!token&&!$("status").classList.contains("error"))msg("Sélectionne un token avec la flèche Owlbear.")}else msg("Ouvre une scène.");OBR.scene.onReadyChange(async r=>{epoch++;selectionSeq++;loading=false;queued=false;selection=[];ready=r;s=null;token=null;frame=null;backup=null;showGrid=false;items=[];editor.set(null,null,null);lists();if(r)try{await refresh(epoch);if(!token)msg("Clique sur un token directement dans la carte.")}catch(e){msg(e.message,true)}});OBR.scene.items.onChange(a=>{items=a;if(!busy){lists();if(!loading)void followSelection()}});OBR.player.onChange(p=>{const next=p.selection||[];if(JSON.stringify(next)===JSON.stringify(selection)&&token)return;selection=next;if(!busy)void followSelection()});pollTimer=setInterval(()=>void poll(),500);window.addEventListener("pagehide",()=>clearInterval(pollTimer),{once:true});OBR.scene.onMetadataChange(m=>{if(!busy){backup=m[UNDO]||null;const q=m[KEY];if(token&&showGrid&&q?.id===s?.id&&valid(q)){s={...q};editor.set(token,frame,s)}paint()}})}catch(e){msg(e.message,true)}});
setTimeout(()=>{if(!OBR.isReady)msg("Ouvre cette extension dans Owlbear.",true)},5000);
