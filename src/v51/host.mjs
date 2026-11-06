import { O as OBR } from "../../assets/index-BfJgTiPE.js";
const viewer="fr.archives-imaginaire.bridge/archives-viewer";
const frame=document.getElementById("app");
const message=document.getElementById("message");
const button=document.getElementById("return");
const form=document.getElementById("pairing");
let gm=false,closing=false,key="";
function fail(text){message.hidden=false;message.textContent=text;}
function openApp(value){
  const url=new URL("../../archives-app-v60-v51.html",import.meta.url);
  url.searchParams.set("resume","1");
  if(gm){url.searchParams.set("remote","1");url.hash=encodeURIComponent(value);}
  else{url.searchParams.set("ro","1");url.searchParams.set("room",value);}
  frame.src=url.href;frame.hidden=false;form.hidden=true;message.hidden=true;
}
async function close(){
  if(gm)await OBR.broadcast.sendMessage("fr.archives-imaginaire.bridge/screen-v51",{target:"OWLBEAR",id:crypto.randomUUID()});
  await OBR.modal.close(viewer);
}
button.addEventListener("click",()=>{
  if(closing)return;
  if(gm&&!frame.hidden){
    closing=true;button.disabled=true;
    frame.contentWindow.postMessage({type:"archives:flush:v51"},location.origin);
    setTimeout(()=>{if(closing){closing=false;button.disabled=false;fail("Enregistrement non confirmé. Vérifie l’onglet principal avant de fermer.");}},12000);
  }else void close().catch(e=>fail(e.message));
});
window.addEventListener("message",async event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
  if(event.data?.type==="archives:return:v51")button.click();
  if(event.data?.type==="archives:flushed:v51"&&closing)void close().catch(e=>{closing=false;button.disabled=false;fail(e.message);});
  if(event.data?.type==="archives:flush-error:v51"){closing=false;button.disabled=false;fail("Les dernières modifications ne sont pas encore enregistrées dans les Archives principales.");}
  if(event.data?.type==="archives:room:v51"&&gm&&/^(JDR-)?[A-Z0-9-]{8,80}$/.test(event.data.room||"")){
    try{await OBR.room.setMetadata({"fr.archives-imaginaire.bridge/live-room-v51":event.data.room});}catch(e){fail(e.message);}
  }
});
await new Promise(resolve=>OBR.onReady(resolve));
gm=await OBR.player.getRole()==="GM";
key="archives-pair-v51:"+OBR.room.id;
document.getElementById("pair-label").textContent=gm?"Colle le code privé de « Relier à Owlbear » dans tes Archives principales.":"Indique le code du Salon Live fourni par le MJ.";
OBR.player.onChange(p=>{
  if((p.role==="GM")!==gm){frame.removeAttribute("src");frame.hidden=true;form.hidden=true;fail("Ton rôle a changé. Ferme puis rouvre les Archives.");}
});
form.addEventListener("submit",event=>{
  event.preventDefault();
  const value=document.getElementById("pair-code").value.trim();
  if(gm&&!/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)){fail("Code de jumelage incorrect.");return;}
  if(!gm&&!/^[A-Za-z0-9-]{8,80}$/.test(value)){fail("Code de Salon Live incorrect.");return;}
  sessionStorage.setItem(key,value);openApp(value);
});
document.getElementById("relink").addEventListener("click",()=>{
  frame.removeAttribute("src");frame.hidden=true;form.hidden=false;sessionStorage.removeItem(key);
});
if(gm){
  const saved=sessionStorage.getItem(key);
  if(saved)openApp(saved);else form.hidden=false;
}else{
  const metadata=await OBR.room.getMetadata();
  const code=metadata["fr.archives-imaginaire.bridge/live-room-v51"]||sessionStorage.getItem(key);
  if(typeof code==="string"&&/^[A-Za-z0-9-]{8,80}$/.test(code))openApp(code);
  else form.hidden=false;
}
