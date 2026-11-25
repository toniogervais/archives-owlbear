import {OBR,KEY,UNDO,write} from "./shared.js?v=210";
import {valid,independentCase,imageFrame,image,maps,pickMap,descendsFrom,transform,snapshot,closeTransform,selectedToken,multiMapCandidates,chooseMapIds} from "./math.js?v=210";
import {createPreview} from "./preview.js?v=210";
import {openPanel,PANEL} from "./window.js";
import {GRID,getGrid,install,toggle,snapItems} from "./grid.js";
const query=new URLSearchParams(location.search),floating=query.has("floating");
window.calBoot?.release(OBR);
const $=id=>document.getElementById(id);let sdkConnected=false,started=false,phase="chargement",lastError="";let items=[],s=null,frame=null,token=null,backup=null,ready=false,gm=false,busy=false,epoch=0,showGrid=false,selection=[],selectionSeq=0,loading=false,polling=false,pollTimer=null,queued=false,custom=null,mapIds=null;
const isToken=i=>image(i)&&i.layer!=="MAP";
function msg(t,error=false){if(error)lastError=t;$("status").textContent=t;$("status").classList.toggle("error",error)}
function guard(e){if(e!==epoch||!ready)throw Error("La scène a changé.")}
const editor=createPreview($("editor"),v=>{s={...s,...v,applied:false};paintSize()},v=>{s={...s,...v,applied:false};paintSize();if(showGrid)void run(async()=>{await write({...s,active:true,full:true});msg("Aperçu actualisé.")})});
function paintSize(){$("size").textContent=s?Math.round(s.size*100)/100+" px":"—";$("apply").disabled=!sdkConnected||!OBR.isReady||busy||loading||!ready||!gm||!valid(s)||!mapIds?.length}
function mapList(){const tid=token?.id||"",list=multiMapCandidates(items,tid);mapIds=chooseMapIds(items,tid,mapIds);const el=$("mapList");el.replaceChildren();for(const item of list){const label=document.createElement("label");label.className="mapcheck";const c=document.createElement("input");c.type="checkbox";c.checked=mapIds.includes(item.id);c.disabled=busy||loading||!ready||!gm;c.onchange=()=>{mapIds=c.checked?[...new Set([...mapIds,item.id])]:mapIds.filter(id=>id!==item.id);updateMaps()};label.append(c,document.createTextNode((item.name||"Carte")+(item.layer!=="MAP"?" ("+item.layer+")":"")));el.append(label)}$("mapCount").textContent=mapIds.length+" / "+list.length+" carte(s)";$("maprow").hidden=false;if(!list.length)el.textContent="Aucune carte visible détectée.";if(s)s={...s,mapIds:[...mapIds],mapId:mapIds[0]||""}}
function updateMaps(){mapList();paint();if(showGrid&&s&&mapIds.length)void run(async()=>{await write({...s,active:true,full:true});msg("Aperçu actualisé.")});else if(showGrid&&!mapIds.length&&s)void run(async()=>{showGrid=false;await write({...s,active:false,full:false});msg("Aperçu masqué.")})}
$("allMaps").onclick=()=>{mapIds=multiMapCandidates(items,token?.id||"").map(i=>i.id);updateMaps()};
$("noMaps").onclick=()=>{mapIds=[];updateMaps()};
function paint(){const ok=sdkConnected&&OBR.isReady&&gm&&ready&&!busy;$("read").disabled=!ok||loading;$("float").disabled=!ok;$("allMaps").disabled=!ok||loading;$("noMaps").disabled=!ok||loading;for(const c of $("mapList").querySelectorAll("input"))c.disabled=!ok||loading;$("visual").hidden=!token;$("undo").hidden=!custom;$("undo").disabled=!ok;$("undo").textContent=custom?.enabled?"Revenir à la grille native":"Réactiver la grille calibrée";$("gridState").textContent=custom?.enabled?"Grille calibrée active · "+Math.round(custom.size*100)/100+" px / case · "+(custom.mapIds?.length||1)+" carte(s)":"Grille native active";$("snap").disabled=!ok||!custom?.enabled;$("test").disabled=!ok||loading||!token||!mapIds?.length;$("test").textContent=showGrid?"Masquer l’aperçu":"Voir la grille d’essai";editor.enabled(ok&&!loading);paintSize()}
function lists(){mapList();paint()}
async function run(fn){if(!sdkConnected||!OBR.isReady||busy||loading||!ready||!gm)return;const e=epoch;busy=true;paint();try{await fn(e);guard(e)}catch(err){msg(err?.message||String(err),true)}finally{busy=false;paint();void followSelection()}}
async function refresh(e){const [a,m,sel]=await Promise.all([OBR.scene.items.getItems(),OBR.scene.getMetadata(),OBR.player.getSelection()]);guard(e);items=a;backup=m[UNDO]||null;custom=m[GRID]||null;if(custom){mapIds=custom.mapIds||[custom.mapId].filter(Boolean);$("meters").value=custom.meters;$("color").value=custom.color;$("opacity").value=custom.opacity}selection=sel||[];lists();await followSelection(query.get("token")||undefined)}
async function followSelection(forced){if(!sdkConnected||!OBR.isReady||busy||!ready||!gm)return;if(loading){queued=true;return}
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
 const next={id:crypto.randomUUID(),...independentCase(b,d),size:custom?.size||d,tokenId:picked.id,mapId:mapIds?.[0]||"",mapIds:[...(mapIds||[])],active:false,full:false,applied:false};
 frame=fr;token=picked;s=next;showGrid=false;mapList();$("tokenName").textContent=picked.name||"Token";$("position").textContent="X "+Math.round(fr.x*100)/100+" · Y "+Math.round(fr.y*100)/100;$("visual").hidden=false;editor.set(token,frame,s);editor.fit();msg("Token chargé. Ajuste la case jaune.");
 // Display first. Preview metadata failure must not prevent showing the image.
 try{await write(s)}catch(err){msg("Token chargé ; synchronisation de l’aperçu : "+err.message,true)}
 }catch(err){if(e===epoch)msg("Lecture du token : "+(err?.message||String(err)),true)}finally{if(e===epoch){loading=false;paint();if(queued){queued=false;void followSelection()}}}}
async function poll(){if(!sdkConnected||!OBR.isReady||polling||loading||busy||!ready||!gm)return;polling=true;try{const sel=await OBR.player.getSelection();if(JSON.stringify(sel||[])!==JSON.stringify(selection)||(!token&&sel?.length===1))await followSelection()}catch(e){msg("Sélection : "+e.message,true)}finally{polling=false}}
$("read").onclick=async()=>{if(!sdkConnected||!OBR.isReady)return;try{const ids=await OBR.player.getSelection();if(ids?.length===1)await followSelection(ids[0]);else msg("Sélectionne exactement un token sur la carte.",true)}catch(e){msg(e.message,true)}};
$("float").hidden=floating;$("float").onclick=()=>{if(sdkConnected&&OBR.isReady)void openPanel(OBR,location.href,token?.id).catch(e=>msg(e.message,true))};

$("close").hidden=!floating;$("close").onclick=()=>OBR.popover.close(PANEL).catch(e=>msg(e.message,true));
$("zoomIn").onclick=()=>editor.zoom(.8);$("zoomOut").onclick=()=>editor.zoom(1.25);$("fit").onclick=()=>editor.fit();
$("test").onclick=()=>run(async e=>{showGrid=!showGrid;s={...s,mapId:mapIds?.[0]||"",mapIds:[...(mapIds||[])],active:showGrid,full:showGrid};await write(s);guard(e);msg(showGrid?"Grille d’essai affichée.":"Grille d’essai masquée.")});
$("apply").onclick=()=>run(async e=>{
 const p={...s,mapId:mapIds?.[0]||"",mapIds:[...(mapIds||[])],meters:Number($("meters").value),color:$("color").value,opacity:Number($("opacity").value),width:Math.max(.5,Math.min(3,s.size*.025))};
 if(!valid(p)||!(p.meters>0&&p.meters<=10000)||!(p.opacity>=.05&&p.opacity<=1))throw Error("Réglages de grille invalides.");
 const all=await OBR.scene.items.getItems();guard(e);const ids=chooseMapIds(all,p.tokenId,p.mapIds);if(!ids.length||ids.length!==p.mapIds.length)throw Error("Une carte sélectionnée n’est plus disponible. Vérifie la sélection.");
 const b=await Promise.all(ids.map(id=>OBR.scene.items.getItemBounds([id])));guard(e);msg("Création de la grille calibrée sur "+ids.length+" carte(s)…");
 custom=await install({...p,mapId:ids[0],mapIds:ids},b,()=>guard(e));guard(e);s={...p,active:false,full:false,applied:true};showGrid=false;await write(s);guard(e);msg("Grille appliquée sur "+custom.mapIds.length+" carte(s). Aucun token modifié.");
});
$("undo").onclick=()=>run(async e=>{custom=await getGrid();guard(e);custom=await toggle(custom,!custom.enabled,()=>guard(e));msg(custom.enabled?"Grille calibrée réactivée.":"Grille native restaurée.")});
$("snap").onclick=()=>run(async e=>{const ids=await OBR.player.getSelection();guard(e);const g=await getGrid();guard(e);const count=await snapItems(ids||[],g);msg(count+" token(s) aligné(s) sur la grille calibrée.")});
async function initialize(){if(started||!OBR.isReady)return;started=true;sdkConnected=true;phase="SDK prêt";$("connection").textContent="SDK connecté";paint();try{phase="lecture du rôle";gm=await OBR.player.getRole()==="GM";if(!gm){msg("Réservé au MJ.");return}phase="lecture de la scène";ready=await OBR.scene.isReady();if(ready){phase="lecture de la sélection";await refresh(epoch);phase="opérationnel";if(!token&&!$("status").classList.contains("error"))msg("Sélectionne un token avec la flèche Owlbear.")}else msg("Ouvre une scène.");OBR.scene.onReadyChange(async r=>{epoch++;selectionSeq++;loading=false;queued=false;selection=[];ready=r;s=null;token=null;frame=null;backup=null;custom=null;mapIds=null;showGrid=false;items=[];editor.set(null,null,null);lists();if(r)try{await refresh(epoch);if(!token)msg("Clique sur un token directement dans la carte.")}catch(e){msg(e.message,true)}});OBR.scene.items.onChange(a=>{items=a;if(!busy){lists();if(!loading)void followSelection()}});OBR.player.onChange(p=>{const next=p.selection||[];if(JSON.stringify(next)===JSON.stringify(selection)&&token)return;selection=next;if(!busy)void followSelection()});pollTimer=setInterval(()=>void poll(),500);window.addEventListener("pagehide",()=>clearInterval(pollTimer),{once:true});OBR.scene.onMetadataChange(m=>{if(!busy){backup=m[UNDO]||null;custom=m[GRID]||null;const q=m[KEY];if(token&&showGrid&&q?.id===s?.id&&valid(q)){s={...q};editor.set(token,frame,s)}paint()}})}catch(e){msg("Initialisation : "+e.message,true)}}
$("diagnostic").onclick=async()=>{const d={version:"2.1.0",...window.calBoot?.info(),sdkAvailable:OBR.isAvailable,sdkReady:OBR.isReady,phase,sceneReady:ready,gm,tokenLoaded:!!token,selectedCount:selection.length,lastError};const str=JSON.stringify(d,null,2);$("diagText").value=str;$("diagText").hidden=false;try{await navigator.clipboard.writeText(str)}catch{$("diagText").select()}};
paint();
if(!OBR.isAvailable){phase="référence Owlbear absente";$("connection").textContent="Page ouverte hors Owlbear";msg("Installe le manifeste dans les extensions, puis ouvre le calibrateur depuis une salle Owlbear.",true)}else{$("connection").textContent="Connexion au SDK…";msg("En attente de la connexion Owlbear.");OBR.onReady(()=>void initialize());if(OBR.isReady)void initialize();const wait=setInterval(()=>{if(OBR.isReady){clearInterval(wait);void initialize()}},250);setTimeout(()=>{clearInterval(wait);if(!sdkConnected){phase="signal READY absent";$("connection").textContent="SDK non connecté";msg("Signal de connexion non reçu. Copie le diagnostic ci-dessous.",true)}},15000)}
