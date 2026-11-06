import { focusArchives } from "../v41/focus-archives.mjs";
import { O as OBR } from '../../assets/index-BfJgTiPE.js';
import { watchTransfers } from '../v46/transfer-receiver.mjs';

const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const toolId="fr.archives-imaginaire.bridge/archives";
const modalId="fr.archives-imaginaire.bridge/return-invite";
const quickPopoverId="fr.archives-imaginaire.bridge/quick-return-v50";
const quickPopoverUrl=new URL("../../return-v50.html",import.meta.url).href;
const iconUrl=new URL("../../icon-archives-v43.svg",import.meta.url).href;
let lastInvitation=null;

function showReturnMenu(){
  // The browser can reject tab activation from an extension iframe.
  const url=new URL("../../archives-app-v59-v50.html?resume=1",import.meta.url).href;
  if(!focusArchives(url)){
    void OBR.notification.show("Le navigateur bloque la bascule. Utilise l’onglet Archives déjà ouvert.","WARNING");
    return;
  }
  void OBR.player.getRole().then(role=>{
    if(role==="GM")return OBR.broadcast.sendMessage(channel,{
      type:"archives:invite:v40",target:"ARCHIVES",
      id:crypto.randomUUID()
    });
  }).catch(console.error);
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
      id:modalId,url:new URL("../../invite-v50.html",import.meta.url).href,
      width:430,height:260
    });
  });
}
start().catch(console.error);
watchTransfers();
