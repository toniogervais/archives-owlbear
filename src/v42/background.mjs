import { O as OBR } from '../../assets/index-BfJgTiPE.js';

const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const toolId="fr.archives-imaginaire.bridge/archives";
const modalId="fr.archives-imaginaire.bridge/return-invite";
const quickPopoverId="fr.archives-imaginaire.bridge/quick-return-v42";
const quickPopoverUrl=new URL("../../index-v41.html",import.meta.url).href;
let lastInvitation=null;
// The toolbar callback executes in the extension's background iframe, where
// window.open may be blocked because it is not an explicit DOM link click.
// Open a supported Owlbear popover anchored to the clicked toolbar icon.
// The existing, working return link is then activated by the user in that UI.
function showReturnMenu(elementId){
  const popover={
    id:quickPopoverId,
    url:quickPopoverUrl,
    width:360,
    height:260
  };
  if(typeof elementId==="string" && elementId)popover.anchorElementId=elementId;
  void OBR.popover.open(popover).catch(error=>{
    console.error("Impossible d'ouvrir le retour aux Archives :",error);
    void OBR.notification.show(
      "Ouvre Les Archives depuis le menu en haut à gauche.","WARNING");
  });
}
async function start(){
  if(!OBR.isAvailable)return;
  await new Promise(resolve=>OBR.onReady(resolve));
  await OBR.tool.create({
    id:toolId,
    icons:[{icon:new URL("../../icon.svg",import.meta.url).href,label:"Retour aux Archives"}],
    onClick:(_context,elementId)=>{showReturnMenu(elementId);return false;}
  });
  OBR.broadcast.onMessage(channel,async event=>{
    if(await OBR.player.getRole()==="GM")return;
    const d=event.data;
    if(!d || d.type!=="archives:invite:v40" || d.target!=="ARCHIVES" ||
       typeof d.id!=="string" || d.id===lastInvitation)return;
    // Only the room's GM can solicit a screen change.
    const party=await OBR.party.getPlayers();
    if(!party.some(p=>p.role==="GM"&&p.connectionId===event.connectionId))return;
    lastInvitation=d.id;
    await OBR.modal.open({
      id:modalId,url:new URL("../../invite-v40.html",import.meta.url).href,
      width:430,height:260
    });
  });
}
start().catch(console.error);
