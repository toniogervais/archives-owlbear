import OBR from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { installArtworkTransfers } from "../v58/transfers.mjs";
import { archivesUrl, screenUrl } from "../v57/room.mjs?v=4160";
import { installRoomPlay } from "../v57/room-background.mjs?v=4160";
import { trustedOwlbearSdk } from "../v56/link.mjs";
const channel="fr.archives-imaginaire.bridge/screen-v55";
const viewer="fr.archives-imaginaire.bridge/archives-viewer";
const invite="fr.archives-imaginaire.bridge/screen-invite-v55";
if (!trustedOwlbearSdk()) throw Error("Ouvre cette extension dans une salle Owlbear.");
await new Promise(resolve=>OBR.onReady(resolve));
await OBR.tool.create({
  id:"fr.archives-imaginaire.bridge/archives",
  icons:[{icon:new URL("../../icon-archives-v43.svg",import.meta.url).href,label:"Afficher les Archives"}],
  onClick(){
    void OBR.modal.open({id:viewer,url:archivesUrl(),fullScreen:true,hideBackdrop:true,hidePaper:true})
      .catch(console.error);
    return false;
  }
});
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
void installArtworkTransfers().catch(console.warn);
void installRoomPlay(OBR).catch(console.warn);
