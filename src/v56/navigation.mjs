// Les Archives demeurent l'application principale ; Owlbear est un onglet associé.
import { owlRoomUrl, packet, readLocal, roomUrlKey, writeLocal } from "./link.mjs";
const MAP_TAB="archives-owlbear-room";
if(window.parent===window)window.name="archives-main";
let mapWindow=null;
let mapUrl=null;
const $=id=>document.getElementById(id);
function askRoom(change=false){
  const current=readLocal(roomUrlKey);
  if(current&&!change){try{return owlRoomUrl(current)}catch{}}
  const typed=window.prompt("Colle le lien de ta salle Owlbear. Les Archives le retiendront.",current||"");
  if(typed===null)return null;
  const value=owlRoomUrl(typed);
  if(current!==value)window.ArchivesOwlbearBridge?.changeRoom();
  writeLocal(roomUrlKey,value);
  return value;
}
function openMap(url,change=false){
  if(!change&&window.ArchivesOwlbearBridge?.focusMap())return true;
  if(mapWindow&&!mapWindow.closed&&mapUrl===url){
    try{mapWindow.focus();return true}catch{}
  }
  const tab=window.open("",MAP_TAB);
  if(!tab){
    window.alert("Autorise l’ouverture d’Owlbear dans ton navigateur, puis clique à nouveau.");
    return false;
  }
  window.ArchivesOwlbearBridge?.openMap(tab);
  if(change)tab.location.replace(url);
  else {
    try{if(tab.location.href!==url)tab.location.replace(url);}
    catch{ /* The existing Owlbear tab is already on a different origin. */ }
  }
  mapWindow=tab;
  mapUrl=url;
  try{tab.focus()}catch{}
  return true;
}
function onMapClick(event){
  if(window.parent!==window){
    event.preventDefault();event.stopImmediatePropagation();
    if (window.ArchivesScreenControl) void window.ArchivesScreenControl.leaveToMap();
    else window.parent.postMessage(packet("go-map"),location.origin);
    return;
  }
  if(document.body.classList.contains("player-mode")||document.body.classList.contains("strict-readonly"))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    const url=askRoom();
    if(url && openMap(url)){
      // Changer d'écran en tant que MJ déclenche automatiquement une
      // invitation au centre de l'écran des joueurs connectés au Salon Live.
      // Le joueur reste libre de l'accepter ou de la refuser.
      try{window.ArchivesLiveInvitations?.inviteToOwlbear(url)}
      catch(error){console.info("Invitation non envoyée (aucun joueur Salon Live) :",error.message)}
    }
  }catch(e){window.alert(e.message)}
}
const icon=document.querySelector("#canvas-integrations-dock .canvas-integration-item:first-child button");
if(icon){
  icon.disabled=false;
  icon.setAttribute("aria-label","Owlbear — afficher la carte");
  icon.title="Afficher la carte Owlbear. Clic droit pour changer de salle.";
  icon.style.cursor="pointer";
  icon.style.opacity="1";
  icon.style.color="var(--skin-gold-bright)";
  icon.parentElement.title="Afficher la carte Owlbear";
  icon.addEventListener("click",onMapClick,{capture:true});
  icon.addEventListener("contextmenu",event=>{
    if(window.parent!==window||document.body.classList.contains("player-mode")||
      document.body.classList.contains("strict-readonly"))return;
    event.preventDefault();
    try{const url=askRoom(true);if(url)openMap(url,true);}
    catch(error){window.alert(error.message);}
  });
}
const diagnostic=$("archives-sync-diag-card");
if(diagnostic&&window.parent===window){
  const copy=document.createElement("button");
  copy.type="button";
  copy.textContent="Copier le code de secours";
  copy.addEventListener("click",async()=>{
    try{
      const code=window.ArchivesOwlbearBridge.manualCode();
      if(navigator.clipboard){
        try{await navigator.clipboard.writeText(code);copy.textContent="Code de secours copié";return;}
        catch{}
      }
      window.prompt("Code privé à coller une seule fois dans Owlbear :",code);
    }catch(error){window.alert(error.message);}
  });
  diagnostic.append(copy);
}
function showPlayerInvitation(message){
  if(!message || message.type!=="archives:invite:v40" || message.target!=="OWLBEAR")return;
  if(!document.body.classList.contains("player-mode")&&!document.body.classList.contains("strict-readonly"))return;
  let url;
  try{url=owlRoomUrl(message.url)}catch{return}
  let overlay=$("archives-v40-player-invite");
  if(!overlay){
    overlay=document.createElement("section");
    overlay.id="archives-v40-player-invite";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-label","Invitation du maître de jeu");
    overlay.setAttribute("aria-modal","true");
    overlay.style.cssText="position:fixed;z-index:30000;inset:0;display:grid;place-items:center;background:rgba(7,8,19,.70);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);padding:16px";
    const card=document.createElement("div");
    card.style.cssText="max-width:430px;width:100%;text-align:center;padding:24px;background:#19121f;border:1px solid #d4af37;border-radius:15px;color:#f5e9c9;box-shadow:0 20px 70px #000b";
    const heading=document.createElement("h2");
    heading.textContent="Le maître de jeu souhaite vous montrer la carte";
    heading.style.cssText="font-size:20px;line-height:1.3;margin:0 0 15px";
    const yes=document.createElement("button");
    yes.id="archives-v40-accept-invite";yes.type="button";yes.textContent="Afficher la carte Owlbear";
    yes.style.cssText="width:100%;min-height:70px;padding:16px;touch-action:manipulation;border-radius:8px;background:#5c431c;border:1px solid #e0bc65;color:#fff2c4;font-weight:700";
    card.append(heading,yes);overlay.appendChild(card);document.body.appendChild(overlay);
  }
  $("archives-v40-accept-invite").onclick=()=>{if(window.parent!==window){window.parent.postMessage(packet("go-map"),location.origin);overlay.style.display="none";}else window.location.assign(url)};
  overlay.style.display="grid";
  $("archives-v40-accept-invite").focus();
}
window.addEventListener("archives:invite:v40",event=>showPlayerInvitation(event.detail));
