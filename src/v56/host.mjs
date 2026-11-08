import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import {
  isPacket, liveRoomKey, packet, pairingKey, readLocal, screenChannel, trustedOwlbearSdk,
  validLiveRoom, validPairing, viewerId, writeLocal
} from "./link.mjs";
import { localEditor, localViewer, release } from "../v57/room.mjs?v=4224";
import { makeEditorHost, makePlayerHost } from "../v57/room-host.mjs?v=4210";

const $ = id => document.getElementById(id);
const frame = $("app"), message = $("message"), button = $("return");
const manual = $("manual"), form = $("pairing"), input = $("pair-code");
let gm = false, closing = false, editorStarted = false, roomId, key, closeTimer, announcedRoom = "";
let nativeHost;

function fail(text) {
  message.textContent = text;
  message.hidden = !text;
}
function post(type, fields) {
  frame.contentWindow?.postMessage(packet(type, fields), location.origin);
}
function openApp(code) {
  editorStarted = false;
  const url = new URL("../../archives-app-v64-v55.html", import.meta.url);
  url.searchParams.set("resume", "1");
  url.searchParams.set("v", release);
  if (gm) {
    url.searchParams.set("remote", "1");
    if (nativeHost) url.searchParams.set(localEditor, "1");
  }
  else {
    url.searchParams.set("ro", "1");
    if (nativeHost) url.searchParams.set(localViewer, "1");
    else url.searchParams.set("room", code);
  }
  frame.src = url.href;
  frame.hidden = false;
  manual.hidden = true;
  manual.open = false;
  fail("");
}

async function close() {
  if (gm && nativeHost) nativeHost.goMap();
  else if (gm) {
    // Invite players who still have the Archives open in Owlbear.
    // A broadcast failure must never prevent the GM from returning to the map.
    void OBR.broadcast.sendMessage(screenChannel, {target:"OWLBEAR", id:crypto.randomUUID()}).catch(console.warn);
  }
  try { await OBR.modal.close(viewerId); }
  catch {
    closing = false;
    button.disabled = false;
    fail("Le retour à la carte a échoué. Réessaie.");
  }
}
function finishReturn(safe) {
  clearTimeout(closeTimer);
  if (safe) { void close(); return; }
  closing = false;
  button.disabled = false;
  fail("Enregistrement non confirmé. Garde cette vue ouverte, puis réessaie ou télécharge les modifications si le bouton est proposé.");
}
button.addEventListener("click", () => {
  if (closing) return;
  closing = true;
  button.disabled = true;
  if (gm && editorStarted && !frame.hidden) {
    post("return");
    closeTimer = setTimeout(() => finishReturn(false), 5500);
  } else void close();
});

window.addEventListener("message", event => {
  if (!roomId || event.source !== frame.contentWindow || event.origin !== location.origin || !isPacket(event.data)) return;
  const data = event.data;
  if (gm && ['owl-soundshow-command','owl-soundshow-query'].includes(data.type)) {
    void import('../soundshow/host.mjs?v=012').then(module => module.forwardSoundShow(OBR,data,post))
      .catch(error => post('owl-soundshow-result',{id:data.id,safe:false,message:error.message}));
    return;
  }
  if (data.type === "go-map") { button.click(); return; }
  if (nativeHost) {
    if (gm && data.type === "owl-editor-ready") editorStarted = true;
    if (gm && data.type === "return-result" && closing) finishReturn(data.safe === true);
    else nativeHost.receive(data);
    return;
  }
  if (!gm) return;
  if (data.type === "editor-ready") {
    editorStarted = true;
    post("init", {roomId, pairing:readLocal(key)});
  } else if (data.type === "return-result" && closing) {
    finishReturn(data.safe === true);
  } else if (data.type === "connection") {
    manual.hidden = !(data.state === "failed" && data.manual);
    if (data.state === "ready") {
      manual.open = false;
      fail("");
      if (validPairing(data.pairing)) writeLocal(key, data.pairing);
      const room = validLiveRoom(data.room) ? data.room : "";
      if (room && room !== announcedRoom) {
        announcedRoom = room;
        void OBR.room.setMetadata({[liveRoomKey]:room})
          .then(() => OBR.broadcast.sendMessage(screenChannel, {target:"ARCHIVES", id:crypto.randomUUID()}))
          .catch(error => { announcedRoom = ""; console.warn("Invitation indisponible", error); });
      }
    }
  }
});
window.addEventListener("pagehide", () => {
  if (gm) nativeHost?.goMap();
  nativeHost?.dispose();
});

function openedFromArchives() {
  try {
    const opener = window.top.opener;
    return opener && !opener.closed && opener.location.origin === location.origin &&
      /\/archives-app-v64-v55\.html$/.test(opener.location.pathname);
  } catch { return false; }
}

async function start() {
  if (!trustedOwlbearSdk()) throw Error("Ouvre les Archives depuis l’icône dans une salle Owlbear.");
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Owlbear n’a pas chargé la liaison. Actualise la salle puis réessaie.")), 9000);
    OBR.onReady(() => { clearTimeout(timer); resolve(); });
  });
  gm = await OBR.player.getRole() === "GM";
  roomId = OBR.room.id;
  // Keep the private fallback in this browser, never in shared Owlbear metadata.
  if (gm) key = pairingKey + ":room:" + roomId + ":" + OBR.player.id;
  OBR.player.onChange(player => {
    if ((player.role === "GM") === gm) return;
    gm = false;
    roomId = null;
    nativeHost?.dispose();
    frame.removeAttribute("src");
    frame.hidden = true;
    manual.hidden = true;
    fail("Ton rôle a changé. Ferme cette vue puis rouvre les Archives.");
    button.hidden=false;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const code = input.value.trim();
    if (!(gm ? validPairing(code) : validLiveRoom(code))) {
      fail(gm ? "Ce code ne correspond pas à la liaison de secours des Archives." : "Vérifie le code du Salon Live.");
      return;
    }
    input.value = "";
    fail("");
    if (gm) {
      writeLocal(key, code);
      manual.open = false;
      post("manual", {pairing:code});
    } else openApp(code);
  });
  if (gm) {
    if (!openedFromArchives())
      nativeHost = await makeEditorHost(OBR, post, () => gm && !!roomId);
    if (!gm || !roomId) { nativeHost?.dispose(); return; }
    openApp();
    return;
  }
  const metadata = await OBR.room.getMetadata();
  const code = metadata?.[liveRoomKey];
  if (validLiveRoom(code) && location.hash !== "#" + localViewer) openApp(code);
  else {
    nativeHost = await makePlayerHost(OBR, post, () => !gm && !!roomId);
    if (!roomId) { nativeHost.dispose(); return; }
    openApp();
  }
}
void start().catch(error => fail(error.message || "La liaison Owlbear est indisponible."));

