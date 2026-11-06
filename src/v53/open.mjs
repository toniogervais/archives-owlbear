import { O as OBR } from "../../assets/index-BfJgTiPE.js";
await new Promise(resolve=>OBR.onReady(resolve));
document.getElementById("return").addEventListener("click",event=>{
 event.preventDefault();
 void OBR.modal.open({id:"fr.archives-imaginaire.bridge/archives-viewer",url:new URL("../../archives-host-v53.html",import.meta.url).href,fullScreen:true,hideBackdrop:true,hidePaper:true});
});
