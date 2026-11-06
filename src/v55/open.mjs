import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { archivesUrl } from "../v57/room.mjs";
await new Promise(resolve=>OBR.onReady(resolve));
document.getElementById("return").addEventListener("click",event=>{
 event.preventDefault();
 void OBR.modal.open({
   id:"fr.archives-imaginaire.bridge/archives-viewer",
   url:archivesUrl(),
   fullScreen:true,hideBackdrop:true,hidePaper:true
 }).catch(console.error);
});
