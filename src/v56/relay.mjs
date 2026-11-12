import {
  createNotice, editEvent, isPacket, localWire, packet, validLiveRoom, validPairing, validRoomId
} from "./link.mjs?v=4210";
import { installCentral } from "./central.mjs?v=4221";
import { dialFallback } from "./peer.mjs";
import { installOwlEditor, installOwlPlayer } from "../v57/editor.mjs?v=4480";
import { localEditor, localViewer } from "../v57/room.mjs";

const api = window.ArchivesRelay;
const params = new URLSearchParams(location.search);
const embedded = window.parent !== window;
const remote = params.get("remote") === "1";
const player = params.get("ro") === "1" || params.get("player") === "1";

if (remote && embedded && params.has(localEditor)) installOwlEditor(api);
else if (player && embedded && params.has(localViewer)) installOwlPlayer(api);
else if (remote && embedded) installViewer();
else if (player && embedded) installPlayer();
else if (!remote && !player && !embedded) installCentral(api);

function installViewer() {
  const notice = createNotice();
  const session = crypto.randomUUID();
  let roomId, pairing, attempt, retryTimer, wire, version, lastMessage;
  let pending, inFlight, returning, closeTimer, paused = false, retryCount = 0, exportConfirmed = false;
  const dirty = () => !!(pending || inFlight);
  const post = (type, fields) => window.parent.postMessage(packet(type, fields), location.origin);
  const retry = () => {
    retryCount = 0;
    start();
  };

  function cancelConnection() {
    clearTimeout(retryTimer);
    const oldAttempt = attempt;
    const oldWire = wire;
    attempt = wire = null;
    if (oldAttempt) {
      clearTimeout(oldAttempt.timer);
      oldAttempt.controller.abort();
      oldAttempt.candidate?.close();
    }
    oldWire?.close();
  }

  function recover() {
    const draft = pending || inFlight?.payload;
    if (!draft) return;
    const file = new Blob([JSON.stringify(draft, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "archives-modifications-owlbear.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notice.show("Vérifie que le fichier a été téléchargé avant de quitter.",
      "Télécharger à nouveau", recover, "J’ai ma copie, retourner à Owlbear", () => {
        exportConfirmed = true;
        post("go-map");
      });
  }

  function disconnected(message, tryAgain = true) {
    if (paused) return;
    cancelConnection();
    notice.show(message, "Réessayer", retry,
      dirty() ? "Télécharger les modifications" : "", recover);
    post("connection", {state:"failed", manual:!dirty()});
    if (tryAgain && version && !document.hidden && retryCount < 3) {
      const delay = 1600 * 2 ** retryCount++;
      retryTimer = setTimeout(start, delay);
    }
  }

  function conflict(message) {
    paused = true;
    cancelConnection();
    notice.show(message, "Télécharger les modifications", recover);
    post("connection", {state:"dirty", manual:false});
    if (returning) finishReturn(false);
  }

  function start() {
    if (!roomId || paused || attempt || wire) return;
    clearTimeout(retryTimer);
    notice.show("Connexion aux Archives…");
    post("connection", {state:"connecting", manual:false});
    const current = {controller:new AbortController(), candidate:null, timer:null};
    attempt = current;
    const resume = dirty() && version ? {...version, id:inFlight?.id} : undefined;
    const attach = {roomId, session, resume};

    function attachWire(next, direct) {
      if (attempt !== current) { next.close(); return; }
      current.candidate = next;
      next.onClose(() => {
        if (wire === next) disconnected("Liaison interrompue. Les Archives peuvent se reconnecter.");
      });
      next.onMessage(data => {
        if ((attempt !== current || current.candidate !== next) && wire !== next) return;
        if (data?.type === "state" && attempt === current) {
          clearTimeout(current.timer);
          attempt = null;
          wire = next;
          lastMessage = Date.now();
          retryCount = 0;
          version = {instance:data.instance, revision:data.revision};
          if (!dirty()) {
            try { api.apply(data.payload); }
            catch { disconnected("Le scénario des Archives n’a pas pu s’ouvrir.", false); return; }
          }
          if (inFlight?.id === data.committed) inFlight = null;
          if (direct && validPairing(data.pairing)) pairing = data.pairing;
          notice.hide();
          post("connection", {state:"ready", pairing:direct ? pairing : undefined, room:data.room});
          flush();
          if (returning) tryReturn();
          return;
        }
        if (data?.type === "conflict" || data?.type === "persist-error") {
          if (dirty()) conflict("Les modifications n’ont pas été enregistrées dans les Archives principales. Télécharge une copie pour les conserver.");
          else disconnected("Les Archives principales ont changé. Réessaie.", false);
          return;
        }
        if (data?.type === "denied") {
          disconnected("Cette liaison correspond à une autre salle. Ouvre la salle depuis les Archives.", false);
          return;
        }
        if (data?.type === "busy") {
          disconnected("Les Archives sont ouvertes dans une autre vue Owlbear. Ferme cette vue puis réessaie.");
          return;
        }
        if (data?.type === "use-main") {
          if (dirty()) conflict("L’édition a repris dans les Archives principales. Télécharge une copie des modifications pour les conserver.");
          else {
            paused = true;
            cancelConnection();
            notice.show("L’édition a repris dans les Archives principales. Tu peux retourner à la carte.");
          }
          return;
        }
        if (data?.type === "unavailable" || data?.type === "restart") {
          disconnected("Les Archives principales ne sont pas encore disponibles.");
          return;
        }
        if (wire !== next) return;
        lastMessage = Date.now();
        if (data?.type === "ack" && data.id === inFlight?.id) {
          version.revision = data.revision;
          inFlight = null;
          flush();
          if (returning) tryReturn();
        } else if (data?.type === "map-ack" && returning) finishReturn(true);
      });
      if (!direct) next.send({type:"attach", ...attach});
    }

    function fallback() {
      if (attempt !== current) return;
      current.candidate?.close();
      current.candidate = null;
      if (!validPairing(pairing)) {
        disconnected("Ouvre Owlbear depuis l’icône dans les Archives, puis clique sur le livre dans Owlbear.", false);
        return;
      }
      current.timer = setTimeout(() => {
        disconnected("Les Archives ne répondent pas. Vérifie que leur onglet est ouvert, puis réessaie.");
      }, 8500);
      void dialFallback(() => api.loadPeer(), pairing, current.controller.signal, next => attachWire(next, false))
        .catch(() => disconnected("La connexion de secours est indisponible. Ouvre Owlbear depuis les Archives."));
    }

    try {
      const opener = window.top.opener;
      if (opener && !opener.closed && typeof MessageChannel === "function") {
        const channel = new MessageChannel();
        attachWire(localWire(channel.port1), true);
        opener.postMessage(packet("direct", attach), location.origin, [channel.port2]);
        current.timer = setTimeout(fallback, 1500);
        return;
      }
    } catch { /* The browser separated the Owlbear tab from its opener. */ }
    fallback();
  }

  function flush() {
    if (!wire) return;
    if (!inFlight && pending) {
      inFlight = {id:crypto.randomUUID(), payload:pending};
      pending = null;
    }
    if (inFlight && inFlight.sent !== wire) {
      inFlight.sent = wire;
      wire.send({type:"edit", instance:version.instance, revision:version.revision,
        id:inFlight.id, payload:inFlight.payload});
    }
  }

  function finishReturn(safe) {
    returning = false;
    clearTimeout(closeTimer);
    if (safe) wire?.send({type:"release"});
    post("return-result", {safe});
  }

  function tryReturn() {
    if (!returning) return;
    clearTimeout(closeTimer);
    if (dirty() && !exportConfirmed) {
      closeTimer = setTimeout(() => finishReturn(false), 4500);
      return;
    }
    if (!wire) { finishReturn(true); return; }
    wire.send({type:"map"});
    closeTimer = setTimeout(() => finishReturn(true), 900);
  }

  window.addEventListener(editEvent, event => {
    if (!version || paused) return;
    exportConfirmed = false;
    pending = structuredClone(event.detail);
    flush();
  });
  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.origin !== location.origin || !isPacket(event.data)) return;
    const data = event.data;
    if (data.type === "init" && validRoomId(data.roomId)) {
      if (roomId && roomId !== data.roomId) return;
      roomId = data.roomId;
      if (validPairing(data.pairing)) pairing = data.pairing;
      start();
    } else if (data.type === "retry") retry();
    else if (data.type === "manual" && !dirty() && validPairing(data.pairing)) {
      cancelConnection();
      pairing = data.pairing;
      retry();
    } else if (data.type === "return") {
      returning = true;
      tryReturn();
    }
  });
  function wake() {
    if (document.hidden || paused) return;
    if (wire && Date.now() - lastMessage > 18000) {
      cancelConnection();
      start();
    } else if (wire) wire.send({type:"ping"});
    else retry();
  }
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  setInterval(() => {
    if (!document.hidden && wire) wake();
  }, 5000);
  window.addEventListener("pagehide", () => {
    wire?.send({type:"release"});
    if (!dirty()) cancelConnection();
  });

  notice.show("Connexion aux Archives…");
  post("editor-ready");
  setTimeout(() => {
    if (!roomId) notice.show("Owlbear n’a pas terminé le chargement de la liaison. Actualise la salle.");
  }, 8000);
}

function installPlayer() {
  const notice = createNotice();
  const room = params.get("room");
  let peer, connection, timer, generation = 0;
  function stop() {
    clearTimeout(timer);
    const oldPeer = peer;
    peer = null;
    connection?.close();
    connection = null;
    oldPeer?.destroy();
  }
  function retryMessage(text, current) {
    if (current !== generation) return;
    generation++;
    stop();
    notice.show(text, "Réessayer", start);
  }
  async function start() {
    const current = ++generation;
    stop();
    if (!validLiveRoom(room)) {
      notice.show("Le Salon Live n’est pas encore ouvert. Attends l’invitation du maître de jeu.");
      return;
    }
    notice.show("Connexion au Salon Live…");
    timer = setTimeout(() => retryMessage("Le Salon Live ne répond pas. Vérifie que le maître de jeu l’a lancé.", current), 14000);
    try {
      await api.loadPeer();
      if (current !== generation) return;
      peer = new window.Peer();
      peer.on("open", () => {
        if (current !== generation) return;
        connection = peer.connect(room, {reliable:true, metadata:{playerName:"Joueur · Owlbear"}});
        connection.on("data", data => {
          if (current !== generation) return;
          if (data?.type === "archives:invite:v40") {
            window.dispatchEvent(new CustomEvent("archives:invite:v40", {detail:data}));
            return;
          }
          try { api.apply(data); clearTimeout(timer); notice.hide(); }
          catch { retryMessage("Les données du Salon Live n’ont pas pu s’ouvrir.", current); }
        });
        connection.on("close", () => retryMessage("Le Salon Live est déconnecté.", current));
        connection.on("error", () => retryMessage("Connexion au Salon Live impossible.", current));
      });
      peer.on("error", () => {
        if (!connection?.open) retryMessage("Le Salon Live est inaccessible. Vérifie son ouverture avec le maître de jeu.", current);
      });
    } catch { retryMessage("La connexion au Salon Live est indisponible.", current); }
  }
  window.addEventListener("pagehide", () => { generation++; stop(); });
  window.addEventListener("pageshow", event => { if (event.persisted) void start(); });
  void start();
}

