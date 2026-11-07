import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { archivesUrl } from "../v57/room.mjs?v=4160";
await new Promise(resolve=>OBR.onReady(resolve));
const hint=document.getElementById("access-hint");
if(hint)hint.textContent=await OBR.player.getRole()==="GM" ?
 "Ta campagne reste privée. Les joueurs rejoignent cette salle ; aucun code des Archives à saisir." :
 "Tu vois uniquement les éléments révélés par le MJ. Lors d’une bascule, clique sur le bouton au centre de ton écran.";
document.getElementById("return").addEventListener("click",event=>{
 event.preventDefault();
 void OBR.modal.open({
   id:"fr.archives-imaginaire.bridge/archives-viewer",
   url:archivesUrl(),
   fullScreen:true,hideBackdrop:true,hidePaper:true
 }).catch(console.error);
});
