import { O as OBR } from '../../assets/index-BfJgTiPE.js';

const channel = "fr.archives-imaginaire.bridge/return-invite:v40";
const toolId = "fr.archives-imaginaire.bridge/archives";
const modalId = "fr.archives-imaginaire.bridge/return-invite";
const fallbackPopoverId = "fr.archives-imaginaire.bridge/quick-return-v43";
const fallbackPopoverUrl = new URL("../../return-v43.html",import.meta.url).href;
const iconUrl = new URL("../../icon-archives-v43.svg",import.meta.url).href;
const REQUEST="archives:return:v44";
const ACK="archives:return:ack:v44";
const OWLBEAR_ORIGINS = new Set(["https://www.owlbear.rodeo","https://owlbear.rodeo"]);
let lastInvitation = null;
let sequence = 0;

function fallback(elementId){
  const options={id:fallbackPopoverId,url:fallbackPopoverUrl,width:306,height:130};
  if(typeof elementId==="string" && elementId)options.anchorElementId=elementId;
  void OBR.popover.open(options).catch(error=>{
    console.error("Panneau de retour indisponible",error);
    void OBR.notification.show("Utilise le retour du menu en haut à gauche.","WARNING");
  });
}

function requestDirectReturn(elementId){
  // A regular Owlbear iframe cannot control Edge tabs; the opt-in Edge
  // companion listens on the room's top page and focuses the Archives tab.
  // No campaign data or room credentials are included in this message.
  const id=Date.now().toString(36)+"-"+(++sequence).toString(36);
  let handled=false;
  let timeout;
  function finish(ok){
    if(handled)return;
    handled=true;
    clearTimeout(timeout);
    window.removeEventListener("message",ackListener);
    if(!ok)fallback(elementId);
  }
  function ackListener(event){
    if(!OWLBEAR_ORIGINS.has(event.origin) ||
       event.source !== window.top ||
       event.data?.type !== ACK ||
       event.data?.id !== id)return;
    finish(event.data.ok===true);
  }
  window.addEventListener("message",ackListener);
  // With no Edge companion, retain the previous, functional two-click return.
  timeout=setTimeout(()=>finish(false),1700);
  try {
    window.top.postMessage({type:REQUEST,id},"*");
  } catch(error) {
    console.error("Envoi du retour direct impossible",error);
    finish(false);
  }
}

async function start(){
  if(!OBR.isAvailable)return;
  await new Promise(resolve=>OBR.onReady(resolve));
  await OBR.tool.create({
    id:toolId,
    icons:[{icon:iconUrl,label:"Retour aux Archives (un clic)"}],
    onClick:(_context,elementId)=>{requestDirectReturn(elementId);return false;}
  });
  // The established GM invitation system is unchanged.
  OBR.broadcast.onMessage(channel,async event=>{
    if(await OBR.player.getRole()==="GM")return;
    const d=event.data;
    if(!d || d.type!=="archives:invite:v40" || d.target!=="ARCHIVES" ||
       typeof d.id!=="string" || d.id===lastInvitation)return;
    const party=await OBR.party.getPlayers();
    if(!party.some(p=>p.role==="GM"&&p.connectionId===event.connectionId))return;
    lastInvitation=d.id;
    await OBR.modal.open({
      id:modalId,url:new URL("../../invite-v41.html",import.meta.url).href,
      width:430,height:260
    });
  });
}
start().catch(console.error);
