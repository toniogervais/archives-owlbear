import { localRoom,roomMembers,roomChannel,release } from "../v57/room.mjs?v=4420";
import { openFileLibrary,validateFile,validId,validPublication,publicFile,digest,fileChunks,fileReceiver,mediaChannel,mediaModal } from "./files.mjs?v=4420";
import {installDossierFiles,dossierEntry} from '../v69/dossier-files.mjs?v=4420';

export async function installFileLibrary(OBR) {
  const {channel,connectionId:initialConnection} = await localRoom(OBR);
  const isMember = roomMembers(OBR),offs = [];
  let role = await OBR.player.getRole(),connectionId = initialConnection,closed = false,store;
  let commands = Promise.resolve(),receptionQueue = Promise.resolve();
  let publication,receive,epoch = 0,viewerSession = "",sending = false,sendTimer;
  const declined = new Set(),targets = new Set(),inProgress = new Set(),lastSent = new Map();
  const send = data => OBR.broadcast.sendMessage(mediaChannel,data);
  async function requireGM() {
    if (closed || role !== "GM" || await OBR.player.getRole() !== "GM") throw Error("Bibliothèque réservée au maître de jeu de cette salle.");
    store ||= await openFileLibrary(OBR.room.id,OBR.player.id);
    return store;
  }
  const dossier=installDossierFiles(OBR,{channel,isMember,getStore:requireGM,getRole:()=>role,getConnection:()=>connectionId,isClosed:()=>closed});
  const metadata = entry => ({id:entry.id,title:entry.title,name:entry.name,mime:entry.mime,kind:entry.kind,size:entry.size,
    created:entry.created,links:entry.links || [],released:entry.released === true,presented:publication?.fileId === entry.id,dossierShared:!!dossierEntry(entry)});
  function viewState() {
    if (!receive || !viewerSession || role !== "PLAYER" || closed) return;
    channel.postMessage({type:"media-view-state",id:receive.publication.id,session:viewerSession,
      publication:publicFile(receive.publication),progress:receive.progress || 0,error:receive.error || "",blob:receive.blob});
  }
  function clearReception() {
    clearTimeout(receive?.timer);receive = null;viewerSession = "";
  }
  async function closeViewer() {
    clearReception();
    try { await OBR.modal.close(mediaModal); } catch {}
  }
  async function stop() {
    const previous = publication;
    publication = null;epoch++;targets.clear();lastSent.clear();
    if (previous && role === "GM" && !closed && await OBR.player.getRole() === "GM")
      await send({type:"hide",id:previous.id,version:previous.version});
  }
  async function execute(command) {
    await requireGM();
    if (command.action === "list") return {entries:(await store.list()).map(metadata)};
    if (command.action === "import") {
      if (!(command.file instanceof Blob)) throw Error("Choisis un fichier sur ton appareil.");
      const name = String(command.name || command.file.name || "Document").slice(0,240);
      const title = String(command.title || name.replace(/\.[^.]+$/,"" )).trim().slice(0,120) || "Document";
      const file = new File([command.file],name,{type:command.file.type,lastModified:command.file.lastModified || Date.now()});
      const {mime,kind} = await validateFile(file),hash = await digest(file);
      const link = typeof command.cellKey === "string" && command.cellKey.length <= 300 ? command.cellKey : "";
      const entries = await store.list(),previous = entries.find(entry => entry.hash === hash && entry.name === name);
      const links = Array.from(new Set([...(previous?.links || []),...(link ? [link] : [])]));
      if (links.length > 50) throw Error("Ce document est déjà lié à 50 cellules.");
      const entry = {...previous,id:previous?.id || crypto.randomUUID(),title:previous?.title || title,name,mime,kind,size:file.size,
        hash,links,created:previous?.created || Date.now()};
      await requireGM();await store.put(entry,previous ? null : new Blob([file],{type:mime}));
      return {entry:metadata(entry)};
    }
    if (command.action === "stop") {
      if (command.fileId && !validId(command.fileId)) throw Error("Document invalide.");
      if (!command.fileId || publication?.fileId === command.fileId) await stop();
      return {};
    }
    if (!validId(command.fileId)) throw Error("Document invalide.");
    const entry = await store.get(command.fileId);
    if (!entry) throw Error("Ce document n’est pas dans ta bibliothèque de cette salle.");
    if (command.action === 'dossier-share' || command.action === 'dossier-unshare') return dossier.share(entry,command.action === 'dossier-unshare');
    if (command.action === "get") {
      const blob = await store.blob(entry.id);await requireGM();
      if (!blob) throw Error("Le fichier original est introuvable. Importe-le à nouveau.");
      return {entry:metadata(entry),blob};
    }
    if (command.action === "rename") {
      const title = typeof command.title === "string" ? command.title.trim() : "";
      if (!title || title.length > 120) throw Error("Donne un nom de 1 à 120 caractères.");
      await requireGM();await store.put({...entry,title});return {};
    }
    if (command.action === "link") {
      if (typeof command.cellKey !== "string" || !command.cellKey || command.cellKey.length > 300) throw Error("Sélectionne une cellule.");
      const links = new Set(entry.links || []);
      if (command.remove === true) links.delete(command.cellKey);else links.add(command.cellKey);
      if (links.size > 50) throw Error("Ce document est déjà lié à 50 cellules.");
      await requireGM();await store.put({...entry,links:Array.from(links)});return {};
    }
    if (command.action === "remove") {
      if (publication?.fileId === entry.id) await stop();
      await requireGM();await store.remove(entry.id);return {};
    }
    if (command.action === "present") {
      if (!["AUDIO","VIDEO"].includes(entry.kind)) throw Error("Pour ce document, utilise le transfert document ou token.");
      const title = typeof command.title === "string" ? command.title.trim() : entry.title;
      if (!title || title.length > 120) throw Error("Donne un nom de 1 à 120 caractères.");
      // No announcement, filename, bytes or link leaves the GM before this explicit action.
      await stop();await requireGM();
      const next = {id:crypto.randomUUID(),version:crypto.randomUUID(),fileId:entry.id,title,mime:entry.mime,size:entry.size,hash:entry.hash};
      if (!validPublication(next)) throw Error("Ce média ne peut pas être présenté.");
      await requireGM();await store.put({...entry,released:true});
      publication = next;
      try { await send({type:"show",...publicFile(next)}); }
      catch (error) { publication = null;throw error; }
      return {publication:publicFile(next)};
    }
    throw Error("Commande de bibliothèque inconnue.");
  }
  channel.addEventListener("message",event => {
    const data = event.data;
    if (closed || !data) return;
    if (data.type === "library-command" && role === "GM" && validId(data.id)) {
      commands = commands.then(async () => {
        try {
          const result = await execute(data.command || {});
          await requireGM();channel.postMessage({type:"library-result",id:data.id,safe:true,result});
        } catch (error) { if (!closed) channel.postMessage({type:"library-result",id:data.id,safe:false,message:error.message || "Opération impossible."}); }
      }).catch(console.warn);
    }
    if (role !== "PLAYER" || !receive || data.id !== receive.publication.id || !validId(data.session)) return;
    if (data.type === "media-view-ready") {
      viewerSession = data.session;viewState();
      if (!receive.blob && !receive.requested) void requestFile();
    } else if (data.type === "media-view-retry" && data.session === viewerSession) void requestFile(true);
    else if (data.type === "media-view-closed" && data.session === viewerSession) {
      declined.add(data.id);clearReception();
    }
  });
  function requestFile(retry = false) {
    const state = receive;
    if (!state || !viewerSession || closed || role !== "PLAYER") return Promise.resolve();
    if (state.requested && !retry) return Promise.resolve();
    clearTimeout(state.timer);state.requested = true;state.receiver = fileReceiver(state.publication);state.error = "";state.progress = 0;
    function timeout() {
      if (receive !== state || state.blob) return;
      state.error = "Le chargement s’est interrompu. Réessaie lorsque le MJ est connecté.";state.requested = false;viewState();
    }
    state.resetTimer = () => { clearTimeout(state.timer);state.timer = setTimeout(timeout,20000); };
    state.resetTimer();viewState();
    return send({type:"request",id:state.publication.id,version:state.publication.version,to:state.sender})
      .catch(() => { state.error = "Chargement impossible. Réessaie.";state.requested = false;viewState(); });
  }
  async function sendPending() {
    if (sending || closed) return;
    sending = true;
    try {
      while (targets.size && publication && role === "GM" && !closed) {
        const active = publication,start = epoch;
        const selected = Array.from(targets).slice(0,8);selected.forEach(id => targets.delete(id));
        const allowed = [];
        for (const id of selected) if (await isMember(id,"PLAYER")) allowed.push(id);
        if (!allowed.length) continue;
        await requireGM();
        const blob = await store.blob(active.fileId);
        if (!blob || publication !== active || start !== epoch || closed) continue;
        const transfer = crypto.randomUUID();allowed.forEach(id => { inProgress.add(id);lastSent.set(id,Date.now()); });
        try {
          for await (const part of fileChunks(blob)) {
            if (closed || role !== "GM" || publication !== active || start !== epoch) break;
            if (part.index % 32 === 0) await requireGM();
            await send({type:"data",id:active.id,version:active.version,transfer,to:allowed,...part});
            if (part.index % 8 === 7) await new Promise(resolve => setTimeout(resolve,30));
          }
        } finally { allowed.forEach(id => inProgress.delete(id)); }
      }
    } catch (error) { console.warn("Présentation du média",error); }
    finally { sending = false; }
  }
  function scheduleFile(id) {
    if (inProgress.has(id) || Date.now() - (lastSent.get(id) || 0) < 3000) return;
    targets.add(id);clearTimeout(sendTimer);sendTimer = setTimeout(() => { void sendPending(); },40);
  }
  const offMedia = OBR.broadcast.onMessage(mediaChannel,event => {
    const data = event.data;
    if (closed || !data || !validId(data.id)) return;
    void (async () => {
      if (role === "GM") {
        if (!await isMember(event.connectionId,"PLAYER") || closed || role !== "GM" || !publication) return;
        if (data.type === "active") await send({type:"show",...publicFile(publication),to:event.connectionId});
        else if (data.type === "request" && data.id === publication.id && data.version === publication.version &&
            data.to === connectionId) scheduleFile(event.connectionId);
        return;
      }
      if (role !== "PLAYER" || !await isMember(event.connectionId,"GM") || closed || role !== "PLAYER") return;
      if (data.type === "show" && (!data.to || data.to === connectionId) && validPublication(data)) {
        if (receive?.publication.id === data.id || declined.has(data.id)) return;
        if (declined.size > 100) declined.clear();
        clearReception();receive = {publication:publicFile(data),sender:event.connectionId,progress:0};
        const url = new URL("../../media-view-v60.html",import.meta.url);url.searchParams.set("v",release);url.hash = data.id;
        await OBR.modal.open({id:mediaModal,url:url.href,fullScreen:true,hideBackdrop:true,hidePaper:true});
      } else if (data.type === "hide" && receive?.publication.id === data.id &&
          receive.publication.version === data.version && receive.sender === event.connectionId) {
        declined.add(data.id);await closeViewer();
      } else if (data.type === "data" && Array.isArray(data.to) && data.to.includes(connectionId) && receive?.requested &&
          receive.publication.id === data.id && receive.publication.version === data.version && receive.sender === event.connectionId) {
        const state = receive;
        receptionQueue = receptionQueue.then(async () => {
          if (closed || role !== "PLAYER" || receive !== state || !viewerSession || !state.requested || state.blob) return;
          try {
            const result = await state.receiver.push(data);
            if (!result || receive !== state || closed || role !== "PLAYER") return;
            state.resetTimer();
            if (result.blob) { clearTimeout(state.timer);state.blob = result.blob;state.progress = 100;viewState(); }
            else if (result.progress >= (state.progress || 0) + 5) { state.progress = result.progress;viewState(); }
          } catch (error) { clearTimeout(state.timer);state.error = error.message;state.requested = false;viewState(); }
        }).catch(console.warn);
      }
    })().catch(console.warn);
  });
  offs.push(offMedia);
  offs.push(OBR.party.onChange(players => {
    if (receive && !players.some(player => player.connectionId === receive.sender && player.role === "GM")) void closeViewer();
  }));
  offs.push(OBR.broadcast.onMessage(roomChannel,event => {
    if (role !== "PLAYER" || event.data?.type !== "screen" || event.data.to || !receive) return;
    void isMember(event.connectionId,"GM").then(allowed => {
      if (allowed && receive) { declined.add(receive.publication.id);void closeViewer(); }
    });
  }));
  offs.push(OBR.player.onChange(player => {
    if (player.connectionId) connectionId = player.connectionId;
    if (role === player.role) return;
    role = player.role;epoch++;publication = null;targets.clear();void closeViewer();
  }));
  window.addEventListener("pagehide",() => {
    closed = true;epoch++;publication = null;clearTimeout(sendTimer);clearReception();
    dossier.dispose();offs.forEach(off => off?.());isMember.dispose();channel.close();void commands.finally(() => store?.close());
  },{once:true});
  if (role === "PLAYER") await send({type:"active",id:crypto.randomUUID()});
}
