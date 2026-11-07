import OBR from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { trustedOwlbearSdk } from "../v56/link.mjs";
import { localRoom } from "../v57/room.mjs?v=4200";
import { validId,validPublication,mediaModal } from "./files.mjs";
const $ = id => document.getElementById(id);
let channel,media,url,readyTimer,closed = false,received = false;
const session = crypto.randomUUID(),id = location.hash.slice(1);
function cleanup() {
  media?.pause();media?.removeAttribute("src");media?.load();
  if (url) URL.revokeObjectURL(url);url = null;clearTimeout(readyTimer);
}
async function close() {
  if (closed) return;closed = true;cleanup();
  channel?.postMessage({type:"media-view-closed",id,session});channel?.close();
  try { await OBR.modal.close(mediaModal); } catch {}
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
  channel.addEventListener("message",event => {
    const data = event.data;
    if (closed || data?.type !== "media-view-state" || data.id !== id || data.session !== session || !validPublication(data.publication)) return;
    clearTimeout(readyTimer);$("title").textContent = data.publication.title;
    $("progress").value = Number.isFinite(data.progress) ? Math.max(0,Math.min(100,data.progress)) : 0;
    if (data.error) { $("status").textContent = data.error;$("retry").hidden = false;$("progress").hidden = true;return; }
    if (!(data.blob instanceof Blob) || received) {
      if (!received) $("status").textContent = "Chargement du média : " + $("progress").value + " %.";
      return;
    }
    if (data.blob.size !== data.publication.size || data.blob.type !== data.publication.mime) return;
    received = true;cleanup();$("progress").hidden = true;$("retry").hidden = true;
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
    media.load();
  });
  OBR.player.onChange(player => { if (player.role !== "PLAYER") void close(); });
  channel.postMessage({type:"media-view-ready",id,session});
  readyTimer = setTimeout(() => { if (!received) { $("status").textContent = "Le MJ ne présente plus ce média. Ferme cette vue et attends sa prochaine présentation."; } },8000);
}
void start().catch(error => { $("status").textContent = error.message; });
