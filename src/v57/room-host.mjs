import { localRoom, roomChannel, roomMembers, snapshotReader, validSnapshot } from "./room.mjs?v=4190";
import { openScenario } from "./storage.mjs";
import { validSession } from "../v56/link.mjs";
import {campaignHost} from '../v63/campaign-host.mjs?v=4190';
import {publicItems} from '../v63/public-items.mjs';

export async function makeEditorHost(OBR, post, canEdit) {
  const {channel} = await localRoom(OBR);
  const store = await openScenario(OBR.room.id, OBR.player.id);
  let snapshot = await store.load();
  let queue = Promise.resolve();
  let announced = false, closed = false, publicView;
  function stopPresentation() {
    return new Promise((resolve,reject) => {
      const id = crypto.randomUUID();
      const finish = () => { clearTimeout(timer);channel.removeEventListener('message',receive); };
      const receive = event => {
        if (event.data?.type !== 'library-result' || event.data.id !== id) return;
        finish();
        if (event.data.safe && !closed && canEdit()) resolve();else reject(Error(event.data.message || 'La présentation ne peut pas être arrêtée.'));
      };
      const timer = setTimeout(() => { finish();reject(Error('La bibliothèque ne répond pas. Aucune restauration n’a été faite.')); },8000);
      channel.addEventListener('message',receive);channel.postMessage({type:'library-command',id,command:{action:'stop'}});
    });
  }
  const campaign = campaignHost({OBR,store,canEdit:() => !closed && canEdit(),snapshot:() => snapshot,
    replace:value => { snapshot = value; },post,beforeRestore:stopPresentation});
  const transfers = new Set();
  const fileCommands = new Set();
  function roster(players) {
    if (!closed && canEdit()) post("owl-editor-roster", {
      players:players.filter(player => player.role === "PLAYER").map(player => ({
        id:player.connectionId, name:player.name, connected:true
      }))
    });
  }
  const offParty = OBR.party.onChange(roster);
  function showScreen(target) {
    channel.postMessage({type:"gm-screen", target});
  }
  function publish(payload) {
    if (validSnapshot(payload)) {
      publicView = payload;
      channel.postMessage({type:"published", payload});
    }
    if (!announced) { announced = true; showScreen("ARCHIVES"); }
  }
  channel.onmessage = event => {
    if (!closed && canEdit() && event.data?.type === 'player-status' && Array.isArray(event.data.players)) {
      post('owl-editor-roster',{players:event.data.players});
    }
    if (!closed && canEdit() && event.data?.type === "artwork-progress" && transfers.has(event.data.id)) {
      post("owl-transfer-progress",{id:event.data.id,message:String(event.data.message || "").slice(0,400)});
    }
    if (!closed && canEdit() && event.data?.type === "library-result" && fileCommands.delete(event.data.id)) {
      const {id,safe,result,message} = event.data;
      post("owl-file-result",{id,safe:safe === true,result,message});
    }
    if (!closed && canEdit() && event.data?.type === "artwork-result" && transfers.delete(event.data.id)) {
      const {id, safe, result, message} = event.data;
      post("owl-transfer-result", {id, safe:safe === true, result, message});
    }
    if (!closed && canEdit() && announced && event.data?.type === "room-ready") {
      channel.postMessage({type:"published", payload:publicView});
      showScreen("ARCHIVES");
    }
  };
  return {
    receive(data) {
      if (!canEdit() || closed) return;
      if (data.type === 'owl-roster-request') channel.postMessage({type:'roster-request'});
      else if (data.type === 'owl-campaign-command' && validSession(data.id)) {
        queue = queue.then(() => campaign.receive(data)).catch(console.warn);
      }
      else if (data.type === 'owl-public-items-request' && validSession(data.id)) {
        void publicItems(OBR).then(items => { if (!closed && canEdit()) post('owl-public-items-result',{id:data.id,safe:true,result:{items}}); }).catch(() => {});
      }
      else if (data.type === "owl-file-command" && validSession(data.id) && fileCommands.size < 8) {
        fileCommands.add(data.id);
        channel.postMessage({type:"library-command",id:data.id,command:data.command});
        setTimeout(() => fileCommands.delete(data.id),25000);
      }
      else if (data.type === "owl-transfer-command" && validSession(data.id) && transfers.size < 8) {
        transfers.add(data.id);
        channel.postMessage({type:"artwork-command", id:data.id, command:data.command});
        setTimeout(() => transfers.delete(data.id), 185000);
      }
      else if (data.type === "owl-editor-ready") {
        post("owl-editor-init", {snapshot});
        void OBR.party.getPlayers().then(roster).catch(console.warn);
        channel.postMessage({type:'roster-request'});
      }
      else if (data.type === "owl-editor-published" && snapshot) publish(data.payload);
      else if (data.type === "owl-editor-save" && validSession(data.id) && validSnapshot(data.snapshot)) {
        queue = queue.then(async () => {
          if (!canEdit() || closed) return;
          try {
            await store.save(data.snapshot);
            snapshot = data.snapshot;
            if (!canEdit() || closed) return;
            publish(data.publicView);
            post("owl-editor-saved", {id:data.id, safe:true});
          } catch (error) {
            post("owl-editor-saved", {id:data.id, safe:false, message:error?.message || "Sauvegarde impossible."});
          }
        }).catch(console.warn);
      }
    },
    goMap() { if (canEdit() && announced) showScreen("OWLBEAR"); },
    dispose() {
      if (closed) return;
      closed = true;
      transfers.clear();
      fileCommands.clear();
      campaign.dispose();
      offParty?.();
      void queue.finally(() => { store.close(); channel.close(); });
    }
  };
}

export async function makePlayerHost(OBR, post, canRead) {
  const {channel, connectionId:initialConnection} = await localRoom(OBR);
  let connectionId = initialConnection;
  const isMember = roomMembers(OBR);
  const id = crypto.randomUUID();
  const send = (type, fields) => OBR.broadcast.sendMessage(roomChannel, {type, id, ...fields});
  let ready = false, disposed = false, revision, interval, initialTimer;
  let snapshot, gmConnection = "";
  const received = snapshotReader((payload, version) => {
    if (disposed || !canRead()) return;
    snapshot = payload;
    revision = version;
    clearTimeout(initialTimer);
    if (ready) post("owl-player-snapshot", {snapshot});
  }, () => request());
  function request() {
    if (!disposed && ready && canRead()) void send("snapshot-request", {have:revision}).catch(() => {});
  }
  const off = OBR.broadcast.onMessage(roomChannel, event => {
    void (async () => {
      const data = event.data;
      if (disposed || !ready || !canRead() || !data ||
          !["snapshot","snapshot-error","waiting","screen"].includes(data.type) ||
          (data.to && data.to !== connectionId) ||
          !await isMember(event.connectionId, "GM") || disposed || !canRead()) return;
      if (data.type === "screen" && data.target === "ARCHIVES") {
        if (gmConnection !== event.connectionId) { gmConnection = event.connectionId; revision = null; request(); }
      } else if (data.type === "snapshot" && (!gmConnection || gmConnection === event.connectionId)) {
        gmConnection = event.connectionId;
        await received(data, event.connectionId);
      } else if (data.type === "snapshot-error" && (!gmConnection || gmConnection === event.connectionId)) {
        if (!snapshot) post("owl-player-status", {message:"Le maître de jeu n’a pas pu publier la vue. La session réessaiera automatiquement."});
      }
    })().catch(console.warn);
  });
  const offParty = OBR.party.onChange(players => {
    if (gmConnection && !players.some(p => p.connectionId === gmConnection && p.role === "GM")) {
      gmConnection = "";
      revision = null;
      request();
    }
  });
  const offPlayer = OBR.player.onChange(player => {
    if (player.connectionId) connectionId = player.connectionId;
  });
  channel.postMessage({type:"viewer-open", id});
  channel.onmessage = event => {
    if (!disposed && event.data?.type === "room-ready") channel.postMessage({type:"viewer-open", id});
  };
  window.addEventListener("focus", request);
  return {
    receive(data) {
      if (data.type === 'owl-public-items-request' && validSession(data.id) && !disposed && canRead()) {
        void publicItems(OBR).then(items => { if (!disposed && canRead()) post('owl-public-items-result',{id:data.id,safe:true,result:{items}}); }).catch(() => {});
        return;
      }
      if (data.type === "owl-player-ready" && !ready) {
        ready = true;
        interval = setInterval(request, 5000);
        initialTimer = setTimeout(() => {
          if (!snapshot) post("owl-player-status", {message:"En attente du maître de jeu. La vue s’affichera quand il ouvrira les Archives."});
        }, 6000);
        request();
      } else if (data.type === "owl-player-retry") request();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(interval);
      clearTimeout(initialTimer);
      window.removeEventListener("focus", request);
      off?.();
      offParty?.();
      offPlayer?.();
      isMember.dispose();
      channel.postMessage({type:"viewer-closed", id});
      channel.close();
      if (ready) void send("snapshot-stop").catch(() => {});
    }
  };
}
