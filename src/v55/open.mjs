import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { archivesUrl } from "../v57/room.mjs?v=4400";
import { trustedOwlbearSdk } from "../v56/link.mjs";
const hint=document.getElementById("access-hint");
const button=document.getElementById("return"),retry=document.getElementById("retry"),diagnostic=document.getElementById("diagnostic");
const fail=text=>{
 hint.textContent=text;retry.hidden=false;diagnostic.hidden=false;
};
retry.onclick=()=>location.reload();
button.addEventListener("click",async()=>{
 if(!OBR.isReady||button.disabled)return;
 button.disabled=true;
 try { await OBR.modal.open({
   id:"fr.archives-imaginaire.bridge/archives-viewer",
   url:archivesUrl(),
   fullScreen:true,hideBackdrop:true,hidePaper:true
 }); } catch { fail("L’ouverture des Archives a échoué. Réessaie ou ouvre le diagnostic de chargement."); }
 finally {button.disabled=false;}
});
if(!trustedOwlbearSdk())fail("Cette commande doit être ouverte depuis une salle Owlbear. Le diagnostic de chargement reste accessible ci-dessous.");
else {
 const timeout=setTimeout(()=>fail("Owlbear n’a pas encore établi la connexion avec l’extension. Réessaie ou ouvre le diagnostic de chargement."),10000);
 OBR.onReady(()=>{
  clearTimeout(timeout);button.disabled=false;retry.hidden=true;diagnostic.hidden=true;
  hint.textContent="Les Archives et la carte s’ouvrent dans cet onglet.";
  void OBR.player.getRole().then(role=>{
   hint.textContent=role==="GM" ?
    "Ta campagne reste privée. Les joueurs rejoignent cette salle ; aucun code des Archives à saisir." :
    "Tu vois uniquement les éléments révélés par le MJ. Lors d’une bascule, clique sur le bouton au centre de ton écran.";
  }).catch(()=>{});
 });
}
