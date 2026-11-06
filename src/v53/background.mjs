import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { watchTransfers } from "../v46/transfer-receiver.mjs";
const channel="fr.archives-imaginaire.bridge/screen-v53";
const viewer="fr.archives-imaginaire.bridge/archives-viewer";
const invite="fr.archives-imaginaire.bridge/screen-invite-v53";
await new Promise(resolve=>OBR.onReady(resolve));
await OBR.tool.create({
  id:"fr.archives-imaginaire.bridge/archives",
  icons:[{icon:new URL("../../icon-archives-v43.svg",import.meta.url).href,label:"Afficher les Archives"}],
  onClick(){
    void OBR.modal.open({id:viewer,url:new URL("../../archives-host-v53.html",import.meta.url).href,fullScreen:true,hideBackdrop:true,hidePaper:true})
      .then(async()=>{
        if(await OBR.player.getRole()==="GM")
          await OBR.broadcast.sendMessage(channel,{target:"ARCHIVES",id:crypto.randomUUID()});
      }).catch(console.error);
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
  await OBR.modal.open({id:invite,url:new URL("../../invite-v53.html#"+data.target,import.meta.url).href,fullScreen:true,hideBackdrop:true,hidePaper:true});
});
watchTransfers();
