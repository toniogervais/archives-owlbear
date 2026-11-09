import OBR from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { archivesUrl, screenUrl } from "../v57/room.mjs?v=4250";
import { trustedOwlbearSdk } from "../v56/link.mjs";
const channel="fr.archives-imaginaire.bridge/screen-v55";
const viewer="fr.archives-imaginaire.bridge/archives-viewer";
const invite="fr.archives-imaginaire.bridge/screen-invite-v55";
if (!trustedOwlbearSdk()) throw Error("Ouvre cette extension dans une salle Owlbear.");
await new Promise(resolve=>OBR.onReady(resolve));
// Navigation must not depend on a successful download of every media module.
// In particular, a failed transfer import used to prevent even creating the tool.
let registered = false, registering = false, retryTimer, stopped = false, attempts = 0;
async function registerTool() {
 if (registered || registering || stopped) return;
 registering = true;attempts++;
 try {
  await OBR.tool.create({
  id:"fr.archives-imaginaire.bridge/archives",
  icons:[{icon:new URL("../../icon-archives-v43.svg",import.meta.url).href,label:"Afficher les Archives"}],
  onClick(){
    void OBR.modal.open({id:viewer,url:archivesUrl(),fullScreen:true,hideBackdrop:true,hidePaper:true})
      .catch(console.error);
    return false;
  }
  });
  registered = true;
  clearTimeout(retryTimer);
 } catch (error) {
  console.warn("Archives : commande de navigation indisponible", error);
  clearTimeout(retryTimer);
  if (!stopped && attempts < 3) retryTimer = setTimeout(() => void registerTool(), 1500);
 } finally { registering = false; }
}
OBR.scene.onReadyChange(ready => { if (ready && !registered) { attempts = 0; void registerTool(); } });
window.addEventListener("pagehide", () => { stopped = true; clearTimeout(retryTimer); }, {once:true});
void registerTool();
let last="";
OBR.broadcast.onMessage(channel,async event=>{
  if(await OBR.player.getRole()==="GM")return;
  const data=event.data;
  if(!data||!["ARCHIVES","OWLBEAR"].includes(data.target)||typeof data.id!=="string"||data.id===last)return;
  const party=await OBR.party.getPlayers();
  if(!party.some(p=>p.role==="GM"&&p.connectionId===event.connectionId))return;
  last=data.id;
  try{await OBR.modal.close(invite);}catch{}
  await OBR.modal.open({id:invite,url:screenUrl(data.target,false),fullScreen:true,hideBackdrop:true,hidePaper:true});
});
let reported = false;
function unavailable(error) {
 console.warn("Archives : un module n’a pas pu démarrer", error);
 if (reported || stopped) return;
 reported = true;
 void OBR.notification.show("Archives : un module n’a pas chargé. Le diagnostic de chargement permet de vérifier les fichiers.", "WARNING").catch(console.warn);
}
void import("../v58/transfers.mjs?v=4210").then(module => module.installArtworkTransfers()).catch(unavailable);
void import("../v57/room-background.mjs?v=4210").then(module => module.installRoomPlay(OBR)).catch(unavailable);
void import("../v60/background.mjs?v=4210").then(module => module.installFileLibrary(OBR)).catch(unavailable);
void import("../soundshow/owlbear.mjs?v=017").then(module => module.installSoundShow(OBR)).catch(unavailable);

