import { localRoom,roomMembers,roomChannel,release } from "../v57/room.mjs?v=4580";
import { openFileLibrary,validateFile,validId,validSharedFile as validPublication,publicFile,digest,fileChunks,fileReceiver,mediaChannel,mediaModal } from "./files.mjs?v=4580";
import {installDossierFiles,dossierEntry} from '../v69/dossier-files.mjs?v=4580';
import {createDirectFiles} from '../v76/direct-files.mjs?v=4580';

export async function installFileLibrary(OBR) {
  const {channel,connectionId:initialConnection} = await localRoom(OBR);
  const isMember = roomMembers(OBR),offs = [];
  let role = await OBR.player.getRole(),connectionId = initialConnection,closed = false,store;
  let commands = Promise.resolve(),receptionQueue = Promise.resolve();
  let publication,publicationBlob,receive,epoch = 0,viewerSession = "",sending = false,sendTimer;
  let viewerOpen=false,modalQueue=Promise.resolve();
  function modalOperation(action){const result=modalQueue.catch(()=>{}).then(action);modalQueue=result.catch(()=>{});return result}
  const declined = new Set(),targets = new Map();
  const send = data => {
    let timer;return Promise.race([OBR.broadcast.sendMessage(mediaChannel,data),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La salle ne confirme plus les envois.')),10000)})]).finally(()=>clearTimeout(timer));
  };
  const direct=createDirectFiles({self:()=>connectionId,role:()=>role,authorize:isMember,signal:send,onData:event=>onMedia(event)});
  const sendFile=async(remote,data)=>{if(await direct.send(remote,data))return true;await send(data);return false};
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
  function clearReception(keepViewer=false) {
    clearTimeout(receive?.timer);receive = null;if(!keepViewer)viewerSession = "";
  }
  async function closeViewer() {
    const previous=receive?.publication.id;
    clearReception();viewerOpen=false;
    try { await modalOperation(()=>OBR.modal.close(mediaModal)); } catch {}
    if(previous)channel.postMessage({type:'media-inactive',id:previous});
  }
  async function stop() {
    const previous = publication;
    publication = null;publicationBlob = null;epoch++;targets.clear();
    if (previous && role === "GM" && !closed && await OBR.player.getRole() === "GM")
      await send({type:"hide",id:previous.id,version:previous.version});
  }
  async function execute(command) {
    await requireGM();
    // A portrait presentation is temporary. It must not depend on saving the
    // scenario, revealing its source cell, or adding another library copy.
    if (command.action === 'present-image') {
      if (!(command.file instanceof Blob)) throw Error('Choisis une image.');
      const file = new File([command.file],'image-partagee',{type:command.file.type});
      const {mime} = await validateFile(file);
      if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) throw Error('Choisis une image PNG, JPEG, WebP ou GIF.');
      const hash = await digest(file);
      await stop();await requireGM();
      const next = {id:crypto.randomUUID(),version:crypto.randomUUID(),fileId:crypto.randomUUID(),title:'Image partagée par le MJ',mime,size:file.size,hash,transferMode:'window-v1',direct:true};
      if (!validPublication(next)) throw Error('Cette image ne peut pas être présentée.');
      publicationBlob = file;publication = {...next,transient:true};
      try { await send({type:'show',...publicFile(next)}); }
      catch (error) { publication = publicationBlob = null;throw error; }
      return {publication:publicFile(next)};
    }
    if (command.action === 'stop-image') {
      if (publication?.transient) await stop();
      return {};
    }
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
      const title = typeof command.title === "string" ? command.title.trim() : entry.title;
      if (!title || title.length > 120) throw Error("Donne un nom de 1 à 120 caractères.");
      // No announcement, filename, bytes or link leaves the GM before this explicit action.
      await stop();await requireGM();
      const next = {id:crypto.randomUUID(),version:crypto.randomUUID(),fileId:entry.id,title,mime:entry.mime,size:entry.size,hash:entry.hash,transferMode:'window-v1',direct:true};
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
    if(role==='PLAYER'&&data.type==='room-ready'&&receive)channel.postMessage({type:'media-active',id:receive.publication.id});
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
      declined.add(data.id);void closeViewer();
    }
  });
  function requestFile(retry = false,automatic = false) {
    const state = receive;
    if (!state || !viewerSession || closed || role !== "PLAYER") return Promise.resolve();
    if (state.requested && !retry) return Promise.resolve();
    if(state.publication.transferMode==='window-v1'){
      if(!state.receiver){state.transfer=crypto.randomUUID();state.receiver=fileReceiver(state.publication,validPublication,{transfer:state.transfer});state.attempts=0}
      const missing=state.receiver.missing(16);if(!missing.length)return Promise.resolve();
      clearTimeout(state.timer);state.requested=true;state.batch=missing;state.error='';state.progress=state.receiver.progress();
      const received=state.receiver.received();
      if(automatic&&received===(state.lastCount||0))state.attempts++;else state.attempts=0;state.lastCount=received;
      if(state.attempts>8){state.requested=false;state.error='Le transfert attend la reconnexion du MJ. Réessaie pour reprendre les morceaux manquants.';viewState();return Promise.resolve()}
      state.resetTimer=()=>{};state.retry=()=>{if(receive===state&&!state.blob){state.requested=false;void requestFile(true,true)}};
      state.round=(state.round||0)+1;state.timer=setTimeout(state.retry,8000);viewState();
      const round=state.round;
      return (async()=>{
        if(state.publication.direct)await direct.wait(state.sender);
        if(receive!==state||state.blob||state.round!==round||closed)return;
        await sendFile(state.sender,{type:'request',id:state.publication.id,version:state.publication.version,to:state.sender,transfer:state.transfer,round,missing});
      })()
        .catch(()=>{if(receive===state){clearTimeout(state.timer);state.timer=setTimeout(state.retry,1500)}});
    }
    if(!automatic)state.attempts=0;state.attempts=(state.attempts||0)+1;
    clearTimeout(state.timer);state.requested = true;state.receiver = fileReceiver(state.publication,validPublication);state.error = "";state.progress = 0;
    function timeout() {
      if (receive !== state || state.blob) return;
      if(state.attempts<3){state.requested=false;void requestFile(true,true);return}
      state.error = "Le chargement s’est interrompu. Réessaie lorsque le MJ est connecté.";state.requested = false;viewState();
    }
    state.retry=timeout;
    state.resetTimer = () => { clearTimeout(state.timer);state.timer = setTimeout(timeout,20000); };
    state.resetTimer();viewState();
    return send({type:"request",id:state.publication.id,version:state.publication.version,to:state.sender})
      .catch(() => { if(receive!==state)return;state.requested=false;if(state.attempts<3){state.timer=setTimeout(timeout,1500)}else{state.error="Chargement impossible. Réessaie.";viewState()} });
  }
  async function sendPending() {
    if (sending || closed) return;
    sending = true;
    try {
      while (targets.size && publication && role === "GM" && !closed) {
        const active = publication,start = epoch;
        const selected = Array.from(targets.keys()).slice(0,1),request=targets.get(selected[0]);selected.forEach(id => targets.delete(id));
        const allowed = [];
        for (const id of selected) if (await isMember(id,"PLAYER")) allowed.push(id);
        if (!allowed.length) continue;
        await requireGM();
        const blob = active.transient ? publicationBlob : await store.blob(active.fileId);
        if (!blob || publication !== active || start !== epoch || closed) continue;
        const transfer = request?.transfer||crypto.randomUUID();
        for await (const part of fileChunks(blob,request?.missing)) {
            if (closed || role !== "GM" || publication !== active || start !== epoch) break;
            if (part.index % 32 === 0) await requireGM();
            const fast=await sendFile(allowed[0],{type:"data",id:active.id,version:active.version,transfer,to:allowed,...part});
            if (!fast&&part.index % 4 === 3) await new Promise(resolve => setTimeout(resolve,25));
        }
        if(request&&publication===active&&start===epoch&&!closed)await sendFile(allowed[0],{type:'batch-end',id:active.id,version:active.version,transfer,round:request.round,to:allowed});
      }
    } catch (error) { console.warn("Présentation du média",error); }
    finally { sending = false;if(targets.size&&publication&&role==='GM'&&!closed){clearTimeout(sendTimer);sendTimer=setTimeout(()=>void sendPending(),40)} }
  }
  function scheduleFile(id,request) {
    // Keep one pending request per player, including a newer photograph or a
    // retry arriving while another transfer is still awaiting Owlbear.
    // The single sender drains this queue after the in-flight chunk completes.
    targets.set(id,request||null);clearTimeout(sendTimer);sendTimer = setTimeout(() => { void sendPending(); },40);
  }
  function onMedia(event) {
    const data = event.data;
    if (closed || !data || !validId(data.id)) return;
    if(data.type==='direct-offer'||data.type==='direct-answer'){void direct.handle(event).catch(console.warn);return}
    void (async () => {
      if (role === "GM") {
        if (!await isMember(event.connectionId,"PLAYER") || closed || role !== "GM" || !publication) return;
        if (data.type === "active") await send({type:"show",...publicFile(publication),to:event.connectionId});
        else if (data.type === "request" && data.id === publication.id && data.version === publication.version &&
            data.to === connectionId) {
          let request;
          if(data.missing!==undefined){
            const count=Math.ceil(publication.size/9000);
            if(!validId(data.transfer)||!Array.isArray(data.missing)||!data.missing.length||data.missing.length>16||!data.missing.every(i=>Number.isInteger(i)&&i>=0&&i<count)||new Set(data.missing).size!==data.missing.length)return;
            if(!Number.isSafeInteger(data.round)||data.round<1)return;
            request={transfer:data.transfer,round:data.round,missing:data.missing};
          }
          scheduleFile(event.connectionId,request);
        }
        return;
      }
      if (role !== "PLAYER" || !await isMember(event.connectionId,"GM") || closed || role !== "PLAYER") return;
      if (data.type === "show" && (!data.to || data.to === connectionId) && validPublication(data)) {
        if (receive?.publication.id === data.id || declined.has(data.id)) return;
        if (declined.size > 100) declined.clear();
        const reuse=viewerOpen&&!!viewerSession;
        clearReception(reuse);receive = {publication:publicFile(data),sender:event.connectionId,progress:0};
        if(data.direct===true)void direct.connect(event.connectionId);
        channel.postMessage({type:'media-active',id:data.id});
        if(reuse){viewState();void requestFile();return}
        viewerOpen=true;
        const url = new URL("../../media-view-v60.html",import.meta.url);url.searchParams.set("v",release);url.hash = data.id;
        await modalOperation(()=>receive?.publication.id===data.id&&role==='PLAYER'&&!closed?OBR.modal.open({id:mediaModal,url:url.href,fullScreen:true,hideBackdrop:true,hidePaper:true}):undefined);
      } else if (data.type === "hide" && receive?.publication.id === data.id &&
          receive.publication.version === data.version && receive.sender === event.connectionId) {
        declined.add(data.id);
        if(viewerSession)channel.postMessage({type:'media-view-hide',id:data.id,session:viewerSession});else await closeViewer();
      } else if(data.type==='batch-end'&&Array.isArray(data.to)&&data.to.includes(connectionId)&&receive?.publication.id===data.id&&receive.publication.version===data.version&&receive.sender===event.connectionId&&receive.transfer===data.transfer&&receive.round===data.round&&!receive.blob){
        // Finish processing the batch before acknowledging its missing chunks.
        const state=receive;receptionQueue=receptionQueue.then(()=>{if(receive===state&&!state.blob&&state.round===data.round){clearTimeout(state.timer);state.requested=false;void requestFile(true,true)}}).catch(console.warn);
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
            else {
              if(result.progress >= (state.progress || 0) + 1){state.progress=result.progress;viewState()}
              if(state.publication.transferMode==='window-v1'&&state.batch.every(i=>state.receiver.has(i))){clearTimeout(state.timer);state.requested=false;void requestFile()}
            }
          } catch (error) {
            clearTimeout(state.timer);state.receiver=null;state.requested=false;state.integrityErrors=(state.integrityErrors||0)+1;
            if(state.integrityErrors<3)state.retry();else{state.error='Le fichier reçu ne correspond pas à l’original. Réessaie lorsque la connexion est rétablie.';viewState()}
          }
        }).catch(console.warn);
      }
    })().catch(console.warn);
  }
  const offMedia = OBR.broadcast.onMessage(mediaChannel,onMedia);
  offs.push(offMedia);
  offs.push(OBR.party.onChange(players => {
    direct.retain(players.filter(player=>player.role===(role==='GM'?'PLAYER':'GM')).map(player=>player.connectionId));
    for(const id of targets.keys())if(!players.some(player=>player.connectionId===id&&player.role==='PLAYER')){targets.delete(id);direct.disconnect(id)}
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
    role = player.role;direct.dispose();epoch++;publication = publicationBlob = null;targets.clear();void closeViewer();
  }));
  window.addEventListener("pagehide",() => {
    closed = true;epoch++;publication = publicationBlob = null;clearTimeout(sendTimer);clearReception();
    direct.dispose();dossier.dispose();offs.forEach(off => off?.());isMember.dispose();channel.close();void commands.finally(() => store?.close());
  },{once:true});
  if (role === "PLAYER") await send({type:"active",id:crypto.randomUUID()});
}
