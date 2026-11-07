import { liveRoomKey, validSession, viewerId } from "../v56/link.mjs";
import { inviteId, localRoom, roomChannel, roomMembers, screenUrl, snapshotChunks, validSnapshot } from "./room.mjs?v=4161";

export async function installRoomPlay(OBR) {
  const {channel, connectionId:initialConnection} = await localRoom(OBR);
  let connectionId = initialConnection;
  const isMember = roomMembers(OBR);
  let role = await OBR.player.getRole();
  let screen, latest, serial = 0, timer, sending = false, sendAgain = false;
  let playerView = "", lastInvite = "";
  const readers = new Set();
  const send = data => OBR.broadcast.sendMessage(roomChannel, data);
  const newId = () => crypto.randomUUID();
  const requestScreen = () => {
    if (role === "PLAYER") void send({type:"screen-request", id:newId()}).catch(console.warn);
  };

  async function closeInvite() {
    try { await OBR.modal.close(inviteId); } catch {}
  }
  async function applyScreen(data) {
    if (data.id === lastInvite || (data.to && data.to !== connectionId)) return;
    lastInvite = data.id;
    await closeInvite();
    if (lastInvite !== data.id) return;
    if ((data.target === "ARCHIVES") === Boolean(playerView)) return;
    await OBR.modal.open({id:inviteId, url:screenUrl(data.target),
      fullScreen:true, hideBackdrop:true, hidePaper:true});
  }

  function queueSnapshot() {
    clearTimeout(timer);
    if (role === "GM" && latest && readers.size) timer = setTimeout(() => void publish(), 180);
  }
  async function publish() {
    if (sending) { sendAgain = true; return; }
    if (role !== "GM" || !latest || !readers.size) return;
    sending = true;
    const current = latest;
    const id = newId();
    const started = serial;
    try {
      const parts = await (current.parts ||= snapshotChunks(current.payload));
      for (const part of parts) {
        if (role !== "GM" || started !== serial) return;
        await send({...part, id, revision:current.revision});
      }
    } catch (error) {
      current.parts = null;
      if (role === "GM") void send({type:"snapshot-error", id, revision:current.revision}).catch(console.warn);
      console.warn("Archives : publication joueur indisponible", error);
    } finally {
      sending = false;
      if (sendAgain) { sendAgain = false; queueSnapshot(); }
    }
  }

  function changeScreen(target) {
    if (screen?.target === target) return;
    screen = {type:"screen", target, id:newId()};
    const message = screen;
    // Any old Salon Live code in this Owlbear room belonged to the separate-window path.
    if (target === "ARCHIVES") void OBR.room.setMetadata({[liveRoomKey]:""}).catch(console.warn);
    void send(message).catch(console.warn);
  }

  channel.onmessage = event => {
    const data = event.data;
    if (role === "GM") {
      if (data?.type === "published" && validSnapshot(data.payload)) {
        latest = {payload:data.payload, revision:newId()};
        queueSnapshot();
      } else if (data?.type === "gm-screen" && ["ARCHIVES","OWLBEAR"].includes(data.target)) {
        changeScreen(data.target);
      }
    } else if (data?.type === "viewer-open" && validSession(data.id)) {
      playerView = data.id;
      void closeInvite();
    } else if (data?.type === "viewer-closed" && data.id === playerView) playerView = "";
  };

  async function receive(event) {
    const data = event.data;
    if (!data || !validSession(data.id)) return;
    if (role === "GM") {
      if (!["screen-request","snapshot-request","snapshot-stop"].includes(data.type) ||
          !await isMember(event.connectionId, "PLAYER") || role !== "GM") return;
      if (data.type === "screen-request") {
        if (screen?.target === "ARCHIVES") await send({...screen, to:event.connectionId});
      } else if (data.type === "snapshot-stop") readers.delete(event.connectionId);
      else {
        readers.add(event.connectionId);
        if (!latest) await send({type:"waiting", id:newId(), to:event.connectionId});
        else if (data.have !== latest.revision) queueSnapshot();
      }
    } else if (data.type === "screen" && ["ARCHIVES","OWLBEAR"].includes(data.target) &&
        await isMember(event.connectionId, "GM") && role === "PLAYER") await applyScreen(data);
  }

  OBR.broadcast.onMessage(roomChannel, event => { void receive(event).catch(console.warn); });
  OBR.party.onChange(players => {
    const present = new Set(players.filter(player => player.role === "PLAYER").map(player => player.connectionId));
    for (const id of readers) if (!present.has(id)) readers.delete(id);
  });
  OBR.player.onChange(player => {
    if (player.connectionId) connectionId = player.connectionId;
    if (role === player.role) return;
    role = player.role;
    serial++;
    latest = screen = null;
    readers.clear();
    playerView = lastInvite = "";
    clearTimeout(timer);
    requestScreen();
  });
  channel.postMessage({type:"room-ready"});
  requestScreen();
  if (role === "PLAYER") setTimeout(requestScreen, 2500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestScreen(); });
}
