import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { focusArchives } from "../v41/focus-archives.mjs";
const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const link=document.getElementById("return");
await new Promise(resolve=>OBR.onReady(resolve));
const gm=(await OBR.player.getRole())==="GM";
if(gm)link.href+="?resume=1";
link.addEventListener("click",event=>{
  if(gm){
    // Le MJ déclenche la demande en changeant lui-même d'écran.
    // L'extension présente un bouton central aux joueurs dans Owlbear.
    void OBR.broadcast.sendMessage(channel,{
      type:"archives:invite:v40",target:"ARCHIVES",
      id:Date.now()+"-"+Math.random().toString(36).slice(2)
    }).catch(error=>console.error("Invitation aux joueurs non envoyée",error));
  }
  // Ce clic est celui du MJ : tentative de réactivation de l'onglet sans reload.
  if(focusArchives(link.href)){
    event.preventDefault();
    void OBR.popover.close("fr.archives-imaginaire.bridge/quick-return-v49").catch(()=>{});
  }
});
