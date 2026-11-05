import { O as OBR } from '../../assets/index-BfJgTiPE.js';
import { focusArchives } from './focus-archives.mjs';
const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const toolId="fr.archives-imaginaire.bridge/archives";
const modalId="fr.archives-imaginaire.bridge/return-invite";
const root="https://toniogervais.github.io/archives-owlbear/";
let lastInvitation=null;
let gm=false;
function returnArchives(){
  const url=root+"archives-app-v53-v41.html"+(gm?"?resume=1":"");
  // Click callback stays synchronous so the browser can authorize the focus.
  if(!focusArchives(url))void OBR.notification.show(
    "Autorise l'ouverture des Archives dans Edge.","WARNING");
}
async function start(){
  if(!OBR.isAvailable)return;
  await new Promise(resolve=>OBR.onReady(resolve));
  gm=(await OBR.player.getRole())==="GM";
  OBR.player.onChange(player=>{gm=player.role==="GM"});
  await OBR.tool.create({
    id:toolId,
    icons:[{icon:new URL("../../icon.svg",import.meta.url).href,label:"Retour aux Archives"}],
    onClick:()=>{void returnArchives()}
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
