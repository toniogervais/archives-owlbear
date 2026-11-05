import { O as OBR } from '../../assets/index-BfJgTiPE.js';
const channel="fr.archives-imaginaire.bridge/return-invite:v40";
const toolId="fr.archives-imaginaire.bridge/archives";
const modalId="fr.archives-imaginaire.bridge/return-invite";
const root="https://toniogervais.github.io/archives-owlbear/";
let lastInvitation=null;
async function returnArchives(){
  const role=await OBR.player.getRole();
  const url=root+"archives-app-v52-v40.html"+(role==="GM"?"?main=1":"");
  // A real user click can focus a named existing tab in supported browsers.
  const tab=window.open(url,"archives-main");
  if(tab){try{tab.focus()}catch{}}
  else await OBR.notification.show("Autorise l'ouverture des Archives.","WARNING");
}
async function start(){
  if(!OBR.isAvailable)return;
  await new Promise(resolve=>OBR.onReady(resolve));
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
