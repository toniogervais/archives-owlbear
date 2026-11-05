// Les Archives demeurent l'application principale ; Owlbear est un onglet associé.
const ROOM_KEY="archives_owlbear_room_url_v38";
const MAP_TAB="archives-owlbear-room";
window.name="archives-main";
let mapWindow=null;
let mapUrl=null;
const $=id=>document.getElementById(id);
function validRoom(value){
  let url;
  try{url=new URL(String(value||"").trim())}catch{throw Error("Lien Owlbear incorrect.")}
  if(url.protocol!=="https:" || !["owlbear.rodeo","www.owlbear.rodeo"].includes(url.hostname.toLowerCase()) ||
     url.username || url.password || (url.pathname==="/" && !url.search))
     throw Error("Colle le lien complet de ta salle Owlbear.");
  return url.href;
}
function askRoom(){
  let current=localStorage.getItem(ROOM_KEY);
  if(current){try{return validRoom(current)}catch{}}
  const typed=window.prompt("Colle le lien complet de ta salle Owlbear (une seule fois) :", "");
  if(typed===null)return null;
  const value=validRoom(typed);
  localStorage.setItem(ROOM_KEY,value);
  return value;
}
function openMap(url){
  // Premier clic : ouvre la salle. Clics suivants : réactive l'onglet existant
  // sans recharger son contenu, ses pions ni sa connexion.
  if(mapWindow && !mapWindow.closed && mapUrl===url){
    try{mapWindow.focus();return true}catch{}
  }
  // Un ancien onglet peut déjà exister après un retour/rechargement des Archives.
  // URL vide : on cible cet onglet sans lui imposer une navigation.
  const tab=window.open("",MAP_TAB);
  if(!tab){
    window.alert("Edge bloque l'ouverture d'Owlbear. Autorise les fenêtres depuis Les Archives.");
    return false;
  }
  try{
    const current=tab.location.href;
    if(current==="about:blank" || current!==url)tab.location.replace(url);
  }catch(error){
    // Une page Owlbear déjà ouverte est d'une autre origine : ne pas la recharger.
    // Browser COOP can isolate window handles; this behavior still needs an Edge test.
  }
  mapWindow=tab;
  mapUrl=url;
  try{tab.focus()}catch{}
  return true;
}
function onMapClick(event){
  if(document.body.classList.contains("player-mode")||document.body.classList.contains("strict-readonly"))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{const url=askRoom();if(url)openMap(url)}catch(e){window.alert(e.message)}
}
const icon=document.querySelector("#canvas-integrations-dock .canvas-integration-item:first-child button");
if(icon){
  icon.disabled=false;
  icon.setAttribute("aria-label","Owlbear — afficher la carte");
  icon.title="Afficher la carte Owlbear";
  icon.style.cursor="pointer";
  icon.style.opacity="1";
  icon.style.color="var(--skin-gold-bright)";
  icon.parentElement.title="Afficher la carte Owlbear";
  icon.addEventListener("click",onMapClick,{capture:true});
}
function installInviteButton(){
  const panel=document.querySelector("#live-panel-modal .modal-card");
  if(!panel || $("archives-v40-invite-players"))return;
  const box=document.createElement("div");
  box.style.cssText="padding:12px 0 2px;border-top:1px solid #7b6335;margin-top:12px";
  const button=document.createElement("button");
  button.type="button";button.id="archives-v40-invite-players";
  button.className="btn btn-gold";
  button.textContent="Inviter les joueurs à voir la carte";
  const info=document.createElement("p");
  info.setAttribute("role","status");
  info.style.cssText="font-size:12px;margin:7px 0;color:#dbc79a";
  info.textContent="Invitation envoyée uniquement sur demande du MJ.";
  button.addEventListener("click",()=>{
    try{
      const url=askRoom();if(!url)return;
      if(!window.ArchivesLiveInvitations)throw Error("Le Salon Live n'est pas disponible.");
      const sent=window.ArchivesLiveInvitations.inviteToOwlbear(url);
      info.textContent="Invitation envoyée à "+sent+" joueur(s) connecté(s).";
    }catch(e){info.textContent="Invitation non envoyée : "+e.message}
  });
  box.append(button,info);panel.appendChild(box);
}
installInviteButton();
function showPlayerInvitation(message){
  if(!message || message.type!=="archives:invite:v40" || message.target!=="OWLBEAR")return;
  if(!document.body.classList.contains("player-mode")&&!document.body.classList.contains("strict-readonly"))return;
  let url;
  try{url=validRoom(message.url)}catch{return}
  let overlay=$("archives-v40-player-invite");
  if(!overlay){
    overlay=document.createElement("section");
    overlay.id="archives-v40-player-invite";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-label","Invitation du maître de jeu");
    overlay.style.cssText="position:fixed;z-index:30000;inset:0;display:grid;place-items:center;background:#000a;padding:16px";
    const card=document.createElement("div");
    card.style.cssText="max-width:430px;width:100%;padding:24px;background:#19121f;border:1px solid #d4af37;border-radius:15px;color:#f5e9c9;box-shadow:0 20px 70px #000b";
    const heading=document.createElement("h2");
    heading.textContent="Le maître de jeu vous invite à consulter la carte";
    heading.style.cssText="font-size:20px;line-height:1.3;margin:0 0 15px";
    const yes=document.createElement("button");
    yes.id="archives-v40-accept-invite";yes.type="button";yes.textContent="Afficher Owlbear";
    yes.style.cssText="width:100%;padding:13px;border-radius:8px;background:#5c431c;border:1px solid #e0bc65;color:#fff2c4;font-weight:700";
    const no=document.createElement("button");
    no.type="button";no.textContent="Rester dans les Archives";
    no.style.cssText="width:100%;padding:10px;border:0;background:transparent;color:#dbc79a;margin-top:9px";
    no.addEventListener("click",()=>{overlay.style.display="none";});
    card.append(heading,yes,no);overlay.appendChild(card);document.body.appendChild(overlay);
  }
  $("archives-v40-accept-invite").onclick=()=>{if(openMap(url))overlay.style.display="none"};
  overlay.style.display="grid";
}
window.addEventListener("archives:invite:v40",event=>showPlayerInvitation(event.detail));
