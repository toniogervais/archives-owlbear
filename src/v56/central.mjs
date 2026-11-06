import {
  createNotice, editEvent, isPacket, localWire, packet, pairingKey, randomHex, readLocal,
  roomUrlKey, validPairing, validRoomId, validSession, writeLocal
} from "./link.mjs";
import { listenForFallback } from "./peer.mjs";

const centralTabKey = pairingKey + ":central";
const saveKey = "jdr_architect_save_v12";
const leaseTime = 45000;

function savedPairing() {
  try {
    const value = JSON.parse(readLocal(pairingKey));
    if (value && validPairing(value.code) && (!value.roomId || validRoomId(value.roomId)))
      return {code:value.code, roomId:value.roomId || ""};
  } catch {}
  return {code:"", roomId:""};
}

export function installCentral(api) {
  const notice = createNotice();
  const instance = crypto.randomUUID();
  const commits = new Map();
  let revision = 0, active, mapTab, stopFallback, pausedSession;
  let pairing = savedPairing();
  const canEdit = () => {
    const state = window.DuneApp?.getState?.();
    return state && !state.playerMode && !state.strictReadOnly;
  };

  function enableFallback() {
    if (!pairing.code) {
      pairing.code = "archives-" + randomHex(16) + "." + randomHex(32);
      writeLocal(pairingKey, JSON.stringify(pairing));
    }
    try { sessionStorage.setItem(centralTabKey, "1"); } catch {}
    stopFallback ||= listenForFallback(() => api.loadPeer(), pairing.code, (wire, accepted) => {
      wire.onMessage(data => {
        if (data?.type !== "attach") return;
        if (accept(wire, data, false)) accepted();
        else if (active?.wire !== wire) setTimeout(() => wire.close(), 500);
      });
    });
    return pairing.code;
  }

  function release(current) {
    if (active !== current) return;
    active = null;
    current.wire.close();
    notice.hide();
  }

  function inviteToMap() {
    const url = readLocal(roomUrlKey);
    if (!url) return;
    try { window.ArchivesLiveInvitations?.inviteToOwlbear(url); }
    catch { /* No active live audience to invite. */ }
  }

  function accept(wire, {roomId, session, resume}, direct) {
    if (!canEdit() || !validRoomId(roomId) || !validSession(session) ||
        (pairing.roomId && pairing.roomId !== roomId)) {
      wire.send({type:"denied"});
      return false;
    }
    if (pausedSession === session) {
      wire.send({type:"use-main"});
      return false;
    }
    if (active) {
      if (!direct && active.session !== session && Date.now() - active.seen < leaseTime) {
        wire.send({type:"busy"});
        return false;
      }
      release(active);
    }
    pairing.roomId = roomId;
    const code = direct ? enableFallback() : undefined;
    writeLocal(pairingKey, JSON.stringify(pairing));
    const current = {wire, session, seen:Date.now()};
    active = current;
    wire.onClose(() => release(current));
    wire.onMessage(data => {
      if (active !== current) return;
      if (!canEdit()) { release(current); return; }
      current.seen = Date.now();
      switch (data?.type) {
        case "ping": wire.send({type:"pong"}); break;
        case "release": release(current); break;
        case "map":
          inviteToMap();
          wire.send({type:"map-ack"});
          break;
        case "edit": commit(current, data); break;
      }
    });
    const committed = commits.get(session);
    const known = committed?.id === resume?.id ? committed : null;
    if (resume && (resume.instance !== instance || (resume.revision !== revision && known?.revision !== revision))) {
      wire.send({type:"conflict"});
      releaseSoon(current);
      return true;
    }
    try {
      wire.send({type:"state", instance, revision, committed:known?.id, pairing:code,
        room:api.room(), payload:resume ? undefined : api.snapshot()});
    } catch {
      wire.send({type:"unavailable"});
      releaseSoon(current);
      return true;
    }
    notice.show("Les Archives sont ouvertes dans Owlbear.", "Reprendre ici", () => {
      pausedSession = session;
      wire.send({type:"use-main"});
      releaseSoon(current);
    });
    return true;
  }

  function releaseSoon(current) {
    // Give the response time to leave the WebRTC encryption queue.
    setTimeout(() => release(current), 300);
  }

  function commit(current, data) {
    const {wire, session} = current;
    const previous = commits.get(session);
    if (previous?.id === data.id && previous.revision === revision) {
      wire.send({type:"ack", id:data.id, revision});
      return;
    }
    if (!validSession(data.id) || data.instance !== instance || data.revision !== revision) {
      wire.send({type:"conflict"});
      releaseSoon(current);
      return;
    }
    const before = readLocal(saveKey);
    try {
      api.apply(data.payload);
      const stored = readLocal(saveKey);
      if (!stored || stored !== JSON.stringify(api.current()))
        throw Error("La sauvegarde locale ne correspond pas aux modifications reçues.");
      revision++;
      commits.delete(session);
      commits.set(session, {id:data.id, revision});
      if (commits.size > 16) commits.delete(commits.keys().next().value);
      wire.send({type:"ack", id:data.id, revision});
    } catch (error) {
      // Restore the last saved state if an invalid edit or storage error interrupted the write.
      try { if (before) api.apply(JSON.parse(before)); } catch {}
      console.error("Archives : modification non enregistrée", error);
      wire.send({type:"persist-error"});
      releaseSoon(current);
    }
  }

  function fromMapFrame(source, roomId) {
    try {
      if (!source || source === window || source.top === source) return false;
      const url = new URL(source.location.href);
      const host = new URL(source.parent.location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname ||
          url.searchParams.get("remote") !== "1" || host.origin !== location.origin ||
          host.pathname !== new URL("../../archives-host-v55.html", import.meta.url).pathname)
        return false;
      // The exact tab opened from the Archives is trusted. After a refresh, its opener
      // survives and the stored room ID also has to match.
      return source.top === mapTab ||
        (source.top.opener === window && pairing.roomId === roomId);
    } catch { return false; }
  }

  window.addEventListener("message", event => {
    if (event.origin !== location.origin || !isPacket(event.data) || event.data.type !== "direct" ||
        !validRoomId(event.data.roomId) || !fromMapFrame(event.source, event.data.roomId)) return;
    const port = event.ports[0];
    if (!port) return;
    const wire = localWire(port);
    if (accept(wire, event.data, true)) mapTab = event.source.top;
    else setTimeout(() => wire.close(), 300);
  });
  window.addEventListener(editEvent, () => { if (canEdit()) revision++; });

  function expireLease() {
    if (active && (!canEdit() || Date.now() - active.seen >= leaseTime)) release(active);
  }
  setInterval(expireLease, 5000);
  window.addEventListener("focus", expireLease);
  window.addEventListener("pagehide", event => {
    if (active) {
      active.wire.send({type:"restart"});
      release(active);
    }
    if (!event.persisted) stopFallback?.();
  });
  try {
    if (pairing.code && sessionStorage.getItem(centralTabKey) === "1" && canEdit()) enableFallback();
  } catch {}

  window.ArchivesOwlbearBridge = {
    focusMap() {
      if (!mapTab || mapTab.closed) return false;
      try { mapTab.focus(); return true; } catch { return false; }
    },
    openMap(tab) {
      mapTab = tab;
      if (pairing.code) enableFallback();
    },
    changeRoom() {
      if (active) release(active);
      mapTab = null;
      pausedSession = null;
      stopFallback?.();
      stopFallback = null;
      pairing = {code:"", roomId:""};
      writeLocal(pairingKey, null);
    },
    manualCode() {
      if (!canEdit()) throw Error("La liaison est réservée au maître de jeu.");
      return enableFallback();
    }
  };
}
