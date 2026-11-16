import OBR from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { trustedOwlbearSdk } from "../v56/link.mjs?v=4530";
import { localRoom } from "../v57/room.mjs?v=4530";
import { validId,validSharedFile as validPublication,mediaModal } from "./files.mjs?v=4530";
import {fade} from '../v73/fade.mjs?v=4530';
const $ = id => document.getElementById(id);
let channel,media,url,readyTimer,closed = false,received = false;
const session=crypto.randomUUID();let id=location.hash.slice(1),closing=false,epoch=0,motion;
function cleanup() {
  media?.pause();media?.removeAttribute("src");media?.load();
  if (url) URL.revokeObjectURL(url);url = null;clearTimeout(readyTimer);
}
async function close() {
  if(closed||closing)return;closing=true;const version=++epoch;media?.pause();
  motion?.cancel();document.body.dataset.phase='closing';motion=fade(document.body,1,0);
  await motion.finished;if(version!==epoch)return;
  cleanup();
  // Keep listening until the host closes this exact publication. A newer image
  // can arrive between the fade finishing and that acknowledgement being read.
  if(channel)channel.postMessage({type:'media-view-closed',id,session});
  else try{await OBR.modal.close(mediaModal)}catch{}
}
function enter(from=0){
  motion?.cancel();document.body.dataset.phase='opening';const version=epoch;
  motion=fade(document.body,from,1);void motion.finished.then(()=>{if(version===epoch&&!closing){motion?.cancel();motion=null;document.body.dataset.phase='open'}});
}
$("close").onclick = () => { void close(); };
window.addEventListener("keydown",event => { if (event.key === "Escape") void close(); });
window.addEventListener("pagehide",() => {
  if (closed) return;closed = true;cleanup();
  channel?.postMessage({type:"media-view-closed",id,session});channel?.close();
},{once:true});
$("retry").onclick = () => {
  cleanup();received = false;$("retry").hidden = true;$("progress").hidden = false;$("progress").value = 0;
  $("status").textContent = "Nouveau chargement…";channel?.postMessage({type:"media-view-retry",id,session});
};
$("play").onclick = () => {
  if (!media) return;
  void media.play().then(() => { $("play").hidden = true;$("status").textContent = "Lecture en cours. Tu peux régler le son ou mettre en pause."; })
    .catch(() => { $("status").textContent = "La lecture n’a pas démarré. Utilise les commandes du lecteur ou demande un fichier MP3/MP4 compatible."; });
};
async function start() {
  if (!trustedOwlbearSdk() || !validId(id)) throw Error("Ouvre cette présentation depuis ta salle Owlbear.");
  await new Promise(resolve => OBR.onReady(resolve));
  if (await OBR.player.getRole() !== "PLAYER") throw Error("Cette présentation est réservée à la vue joueur.");
  ({channel} = await localRoom(OBR));
  channel.addEventListener("message",async event => {
    const data = event.data;
    if(closed||data?.session!==session)return;
    if(data.type==='media-view-hide'&&data.id===id){void close();return}
    if(data.type!=='media-view-state'||!validId(data.id)||!validPublication(data.publication)||data.publication.id!==data.id)return;
    if(data.id!==id){epoch++;id=data.id;closing=false;received=false;cleanup();media=null;$('media').replaceChildren();$('progress').hidden=false;$('retry').hidden=true;$('play').hidden=true;enter()}
    const version=epoch;

    clearTimeout(readyTimer);$("title").textContent = data.publication.title;
    $("progress").value = Number.isFinite(data.progress) ? Math.max(0,Math.min(100,data.progress)) : 0;
    if (data.error) { $("status").textContent = data.error;$("retry").hidden = false;$("progress").hidden = true;return; }
    if (!(data.blob instanceof Blob) || received) {
      if (!received) $("status").textContent = "Chargement du média : " + $("progress").value + " %.";
      return;
    }
    if (data.blob.size !== data.publication.size || data.blob.type !== data.publication.mime) return;
    received = true;cleanup();$("progress").hidden = true;$("retry").hidden = true;
    const mime=data.publication.mime;
    if(!mime.startsWith('audio/')&&!mime.startsWith('video/')) {
      url=URL.createObjectURL(data.blob);let content;
      if(mime==='text/plain'){content=document.createElement('pre');content.textContent=await data.blob.text();content.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;user-select:text';}
      else if(mime==='application/pdf'){content=document.createElement('object');content.type=mime;content.data=url;content.style.cssText='width:100%;height:70dvh;background:white';const link=document.createElement('a');link.href=url;link.download='document.pdf';link.textContent='Enregistrer le PDF pour le lire';content.append(link);}
      else {content=document.createElement('img');content.src=url;content.alt=data.publication.title;content.style.cssText='width:100%;height:70dvh;object-fit:contain';}
      if(closed||version!==epoch||closing)return;$('media').replaceChildren(content);fade($('media'),0,1);$('play').hidden=true;$('status').textContent='Document présenté par le MJ. Ferme-le avec la croix en haut à droite.';return;
    }
    media = document.createElement(data.publication.mime.startsWith("audio/") ? "audio" : "video");
    media.controls = true;media.preload = "auto";media.volume = 0.65;media.playsInline = true;
    media.setAttribute("aria-label",data.publication.title);media.setAttribute("controlslist","nodownload");
    url = URL.createObjectURL(data.blob);media.src = url;$("media").replaceChildren(media);
    $("play").hidden = false;$("play").disabled = true;$("status").textContent = "Préparation de la lecture…";
    media.addEventListener("canplay",() => {
      $("play").disabled = false;$("status").textContent = "Le média est prêt. Clique sur Lire.";
    },{once:true});
    media.addEventListener("error",() => {
      $("play").hidden = true;$("status").textContent = "Ce navigateur ne peut pas lire ce fichier. Demande au MJ un MP3 ou un MP4 compatible.";
    });
    media.addEventListener("ended",() => { $("play").hidden = false;$("status").textContent = "Lecture terminée."; });
    media.load();fade($('media'),0,1);
  });
  OBR.player.onChange(player => { if (player.role !== "PLAYER") void close(); });
  enter();channel.postMessage({type:"media-view-ready",id,session});
  readyTimer = setTimeout(() => { if (!received) { $("status").textContent = "Le MJ ne présente plus ce média. Ferme cette vue et attends sa prochaine présentation."; } },8000);
}
void start().catch(error => { $("status").textContent = error.message; });
