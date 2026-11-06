import { O as OBR } from '../../assets/index-BfJgTiPE.js';
import { watchTransfers } from '../v46/transfer-receiver.mjs';

const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const toolId="fr.archives-imaginaire.bridge/archives";
const modalId="fr.archives-imaginaire.bridge/return-invite";
const quickPopoverId="fr.archives-imaginaire.bridge/quick-return-v49";
const quickPopoverUrl=new URL("../../return-v49.html",import.meta.url).href;
const iconUrl=new URL("../../icon-archives-v43.svg",import.meta.url).href;
let lastInvitation=null;

function showReturnMenu(elementId){
  // This supported Owlbear tool callback may open a popover. It cannot
  // reliably activate a browser tab without a user gesture in that page.
  const options={
    id:quickPopoverId,url:quickPopoverUrl,width:306,height:130
  };
  if(typeof elementId==="string" && elementId)
    options.anchorElementId=elementId;
  void OBR.popover.open(options).catch(error=>{
    console.error("Ouverture du retour aux Archives :",error);
    void OBR.notification.show(
      "Utilise « Retour aux Archives » dans le menu en haut à gauche.","WARNING");
  });
}

async function start(){
  if(!OBR.isAvailable)return;
  await new Promise(resolve=>OBR.onReady(resolve));
  await OBR.tool.create({
    id:toolId,
    icons:[{icon:iconUrl,label:"Les Archives — retour"}],
    onClick:(_context,elementId)=>{showReturnMenu(elementId);return false;}
  });
  OBR.broadcast.onMessage(channel,async event=>{
    if(await OBR.player.getRole()==="GM")return;
    const d=event.data;
    if(!d || d.type!=="archives:invite:v40" || d.target!=="ARCHIVES" ||
       typeof d.id!=="string" || d.id===lastInvitation)return;
    const party=await OBR.party.getPlayers();
    if(!party.some(p=>p.role==="GM"&&p.connectionId===event.connectionId))return;
    lastInvitation=d.id;
    await OBR.modal.open({
      id:modalId,url:new URL("../../invite-v49.html",import.meta.url).href,
      width:430,height:260
    });
  });
}
start().catch(console.error);
watchTransfers();
