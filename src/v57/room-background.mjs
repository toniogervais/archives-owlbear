import { liveRoomKey, validSession, viewerId } from "../v56/link.mjs";
import { inviteId, localRoom, roomChannel, roomMembers, screenUrl, snapshotChunks, validSnapshot } from "./room.mjs?v=4450";
import {createPresence} from '../v63/presence.mjs?v=4210';
import {screenCommand} from '../v65/screen-model.mjs';

export async function installRoomPlay(OBR) {
  const {channel, connectionId:initialConnection} = await localRoom(OBR);
  let connectionId = initialConnection;
  const isMember = roomMembers(OBR);
  let role = await OBR.player.getRole();
  let screen, latest, serial = 0, timer, sending = false, sendAgain = false;
  let playerView = "", lastInvite = "";
  let pendingTarget = '',lastPresenceRequest = 0;
  let pendingInvite;
  let screenQueue=Promise.resolve();
  const presence = createPresence();
  const emitPresence = () => { if (role === 'GM') channel.postMessage({type:'player-status',players:presence.list()}); };
  const announcePresence = () => {
    if (role === 'PLAYER') void send({type:'player-screen-state',id:newId(),screen:playerView ? 'ARCHIVES' : 'OWLBEAR',pending:!!pendingTarget}).catch(() => {});
  };
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
    if ((data.target === "ARCHIVES") === Boolean(playerView)) { pendingInvite=null;pendingTarget = '';announcePresence();return; }
    pendingTarget = data.target;pendingInvite = data;
    await OBR.modal.open({id:inviteId, url:screenUrl(data.target,true,data),
      fullScreen:true, hideBackdrop:true, hidePaper:true});
    announcePresence();
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

  async function changeScreen(value) {
    const command=screenCommand(value),party=await OBR.party.getPlayers();
    if (role!=='GM' || await OBR.player.getRole()!=='GM') throw Error('Commande réservée au MJ.');
    const connected=party.filter(player=>player.role==='PLAYER').map(player=>player.connectionId);
    if (command.recipients?.some(id=>!connected.includes(id))) throw Error('Ce joueur est déconnecté. Actualise la liste.');
    if (command.target==='ARCHIVES') await OBR.room.setMetadata({[liveRoomKey]:''});
    if (command.policy==='STAY') {
      screen=null;await send({type:'screen-clear',id:newId()});return {count:0,policy:command.policy,target:command.target};
    }
    const message={type:'screen',target:command.target,id:newId(),required:command.policy==='REQUIRED'};
    if (command.recipients) {
      for (const to of command.recipients) await send({...message,to});
    } else { screen=message;await send(message); }
    return {count:command.recipients?.length ?? connected.length,policy:command.policy,target:command.target};
  }

  channel.onmessage = event => {
    const data = event.data;
    if (role === "GM") {
      if (data?.type === 'roster-request') {
        emitPresence();
        if (Date.now() - lastPresenceRequest > 1000) { lastPresenceRequest = Date.now();void send({type:'player-state-request',id:newId()}).catch(() => {}); }
      } else if (data?.type === "published" && validSnapshot(data.payload)) {
        latest = {payload:data.payload, revision:newId()};
        queueSnapshot();
      } else if (data?.type==='gm-screen-command' && validSession(data.id)) {
        screenQueue=screenQueue.catch(()=>{}).then(()=>changeScreen(data.command));
        void screenQueue.then(result=>channel.postMessage({type:'screen-command-result',id:data.id,safe:true,result}))
          .catch(error=>channel.postMessage({type:'screen-command-result',id:data.id,safe:false,message:error.message}));
      } else if (data?.type==='gm-screen-presence' && ['ARCHIVES','OWLBEAR'].includes(data.target)) {
        if(screen && screen.target!==data.target)screen=null;
      }
    } else if (data?.type === "viewer-open" && validSession(data.id)) {
      playerView = data.id;
      pendingInvite=null;pendingTarget = '';announcePresence();
      void closeInvite();
    } else if (data?.type === "viewer-closed" && data.id === playerView) { playerView = '';announcePresence(); }
    else if (data?.type === 'screen-invite-accepted' && ['ARCHIVES','OWLBEAR'].includes(data.target) && (!pendingInvite || pendingInvite.id===data.id)) {
      pendingInvite=null;pendingTarget = '';if (data.target === 'OWLBEAR') playerView = '';announcePresence();
    } else if (data?.type === 'screen-invite-dismissed' && pendingInvite?.id===data.id && !pendingInvite.required) { pendingInvite=null;pendingTarget = '';announcePresence(); }
    else if (data?.type==='screen-invite-closed' && pendingInvite?.id===data.id && pendingInvite.required) {
      const current=pendingInvite;
      setTimeout(()=>{if(role==='PLAYER' && pendingInvite===current)void OBR.modal.open({id:inviteId,url:screenUrl(current.target,true,current),fullScreen:true,hideBackdrop:true,hidePaper:true}).catch(console.warn);},250);
    }
  };

  async function receive(event) {
    const data = event.data;
    if (!data || !validSession(data.id)) return;
    if (role === "GM") {
      if (!["screen-request","snapshot-request","snapshot-stop","player-screen-state"].includes(data.type) ||
          !await isMember(event.connectionId, "PLAYER") || role !== "GM") return;
      if (data.type === 'player-screen-state') {
        if (presence.report(event.connectionId,data)) emitPresence();
      } else if (data.type === "screen-request") {
        if (screen?.target === "ARCHIVES") await send({...screen, to:event.connectionId});
      } else if (data.type === "snapshot-stop") readers.delete(event.connectionId);
      else {
        readers.add(event.connectionId);
        if (!latest) await send({type:"waiting", id:newId(), to:event.connectionId});
        else if (data.have !== latest.revision) queueSnapshot();
      }
    } else if (await isMember(event.connectionId,'GM') && role === 'PLAYER') {
      if (data.type === 'player-state-request') announcePresence();
      else if (data.type === 'screen' && ['ARCHIVES','OWLBEAR'].includes(data.target)) await applyScreen(data);
      else if (data.type==='screen-clear' && (!data.to || data.to===connectionId)) { pendingInvite=null;pendingTarget='';lastInvite='';await closeInvite();announcePresence(); }
    }
  }

  OBR.broadcast.onMessage(roomChannel, event => { void receive(event).catch(console.warn); });
  OBR.party.onChange(players => {
    presence.party(players);emitPresence();
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
    pendingInvite=null;pendingTarget = '';announcePresence();
    clearTimeout(timer);
    requestScreen();
  });
  channel.postMessage({type:"room-ready"});
  presence.party(await OBR.party.getPlayers());emitPresence();announcePresence();
  const presenceTimer = setInterval(announcePresence,15000);
  window.addEventListener('pagehide',() => clearInterval(presenceTimer),{once:true});
  requestScreen();
  if (role === "PLAYER") setTimeout(requestScreen, 2500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestScreen(); });
}
