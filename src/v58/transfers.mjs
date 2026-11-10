import OBR, { buildImage, buildImageUpload } from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { localRoom } from "../v57/room.mjs?v=4210";
import {isPacket,packet,validRoomId,validSession} from "../v56/link.mjs?v=4210";
import { artworkBlob,assetKey,blobDigest,privateArtworkStore,sceneKey,validArtwork } from "./model.mjs?v=4210";
import { normalizeCrop } from "../v61/token-crop.mjs";
import {safeHostedImage} from "./hosted-assets.mjs?v=4310";

// Only the GM talks to this local channel. Unrevealed artwork never enters a
// shared item, broadcast, room metadata, public bucket, or player snapshot.
export async function installArtworkTransfers() {
  const {channel} = await localRoom(OBR);
  let role = await OBR.player.getRole(), scene = "", store, records = [], items = [];
  let closed = false, generation = 0;
  let refreshQueue = Promise.resolve();
  let commands = Promise.resolve(), renders = Promise.resolve();
  const locals = new Map();
  const offs = [];
  const pose = item => ({position:item.position, scale:item.scale, rotation:item.rotation, locked:item.locked});
  const shared = id => items.find(item => item.id === id && item.metadata?.[assetKey]?.id === id);
  const grid = (kind, image) => ({dpi:kind === "TOKEN" ? Math.max(image.width,image.height) : 150,
    offset:{x:image.width / 2,y:image.height / 2}});

  async function requireGM(expectedScene) {
    if (closed || role !== "GM" || await OBR.player.getRole() !== "GM") throw Error("Transfert réservé au maître de jeu.");
    if (!await OBR.scene.isReady()) throw Error("Ouvre une scène Owlbear avant de transférer un élément.");
    let key = (await OBR.scene.getMetadata())?.[sceneKey];
    if (!key) {
      key = crypto.randomUUID();
      await OBR.scene.setMetadata({[sceneKey]:key});
    }
    if (expectedScene && expectedScene !== key) throw Error("La scène a changé. Rouvre le transfert vers la scène voulue.");
    if (key !== scene || !store) await refresh();
    if (closed || role !== "GM" || scene !== key) throw Error("La scène n’est plus disponible.");
    return key;
  }
  async function centre() {
    const [width,height] = await Promise.all([OBR.viewport.getWidth(),OBR.viewport.getHeight()]);
    return OBR.viewport.inverseTransformPoint({x:width / 2,y:height / 2});
  }
  function makeItem(record, hidden) {
    const item = buildImage(record.image,record.grid).id(record.id)
      .name(record.title + (hidden ? " [caché]" : ""))
      .plainText(record.title + (hidden ? " · caché" : "")).textItemType("LABEL")
      .layer(record.kind === "TOKEN" ? "CHARACTER" : "PROP")
      .position(record.position).visible(true)
      .metadata({[assetKey]:{id:record.id,version:record.version}}).build();
    Object.assign(item,pose(record));
    if (hidden) item.opacity = 0.6;
    return item;
  }
  async function removeLocal(id) {
    if (!locals.has(id)) return;
    locals.delete(id);
    await OBR.scene.local.deleteItems([id]);
  }
  async function render() {
    const active = generation;
    const wanted = role === "GM" && !closed ? records.filter(record => !shared(record.id)?.visible) : [];
    for (const id of Array.from(locals.keys())) if (!wanted.some(record => record.id === id)) await removeLocal(id);
    for (const record of wanted) {
      if (active !== generation || closed || role !== "GM") return;
      const existing = locals.get(record.id);
      const item = makeItem(record,true);
      if (!existing) {
        locals.set(record.id,item);
        try { await OBR.scene.local.addItems([item]); }
        catch (error) { if (locals.get(record.id) === item) locals.delete(record.id);throw error; }
      } else if (JSON.stringify(item) !== JSON.stringify(existing)) {
        await OBR.scene.local.updateItems([record.id],draft => { Object.assign(draft[0],item); });
        locals.set(record.id,item);
      }
      if (active !== generation || closed || role !== "GM") {
        await OBR.scene.local.deleteItems([record.id]);locals.delete(record.id);return;
      }
    }
  }
  function queueRender() {
    renders = renders.then(render).catch(error => console.warn("Affichage privé Owlbear",error));
    return renders;
  }
  function queuePurge() {
    // Read the actual local scene after older renders finish. An add operation
    // can have completed while a scene change invalidated its tracking map.
    renders = renders.catch(() => {}).then(async () => {
      if (!await OBR.scene.isReady()) { locals.clear();return; }
      const owned = await OBR.scene.local.getItems(item => item.metadata?.[assetKey]?.id === item.id);
      if (owned.length) await OBR.scene.local.deleteItems(owned.map(item => item.id));
      locals.clear();
    }).catch(error => console.warn("Nettoyage privé Owlbear",error));
    return renders;
  }
  function refresh() {
    const next = refreshQueue.catch(() => {}).then(loadScene);
    refreshQueue = next;
    return next;
  }
  async function loadScene() {
    const key = await OBR.scene.isReady() ? (await OBR.scene.getMetadata())?.[sceneKey] || "" : "";
    const currentItems = key ? await OBR.scene.items.getItems() : [];
    let currentRecords = [];
    if (!closed && role === "GM" && key) {
      store ||= await privateArtworkStore(OBR.room.id,OBR.player.id);
      currentRecords = await store.list(key);
    }
    if (closed) return;
    if (key !== scene) {
      generation++;
      records = [];
      await queuePurge();
    }
    scene = key;
    items = currentItems;
    records = role === "GM" ? currentRecords : [];
    await queueRender();
  }
  async function visibility(record,reveal) {
    await requireGM(record.scene);
    const existing = shared(record.id), local = locals.get(record.id);
    Object.assign(record,pose(existing || local || record));
    if (reveal) {
      const item = makeItem(record,false);
      if (existing) await OBR.scene.items.updateItems([existing.id],draft => { Object.assign(draft[0],item); });
      else await OBR.scene.items.addItems([item]);
      await removeLocal(record.id);
    } else if (existing) {
      // Remove from the shared scene, rather than sharing new hidden data.
      await OBR.scene.items.deleteItems([existing.id]);
    }
    record.revealed = reveal;
    await store.put(record);
    await refresh();
  }
  const safeImage = (image,art) => image && image.width === art.width && image.height === art.height &&
    ['image/png','image/jpeg','image/webp'].includes(image.mime) && typeof image.url === 'string' && image.url.startsWith('https://') && !image.url.includes('/storage/v1/object/sign/');
  const imageFields = image => ({url:image.url,mime:image.mime,width:image.width,height:image.height});
  const validTransfer = command => command && ['TOKEN','DOCUMENT'].includes(command.kind) &&
    typeof command.sourceKey === 'string' && !!command.sourceKey && command.sourceKey.length <= 300 &&
    typeof command.title === 'string' && !!command.title.trim() && command.title.length <= 120 && validArtwork(command.art) &&
    (!command.hosted || (safeHostedImage(command.hosted)&&command.hosted.mime===command.art.mime&&
      command.hosted.width===command.art.width&&command.hosted.height===command.art.height));
  async function nativeImages(batch,progress) {
    const entries = [],missing = new Map();
    for (const command of batch) {
      const blob = artworkBlob(command.art),hash = await blobDigest(blob),cached = command.forceImport === true ? null : await store.asset(hash);
      const hosted = command.hosted && safeHostedImage(command.hosted) &&
        command.hosted.mime === command.art.mime &&
        command.hosted.width === command.art.width &&
        command.hosted.height === command.art.height ? command.hosted : null;
      const entry = {command,hash,blob,name:'Archives · '+hash.slice(0,12),
        reused:!!hosted || safeImage(cached,command.art)};
      if (hosted) {
        entry.image=imageFields(hosted);
        // Signed URLs expire: never cache one as a permanent Owlbear asset.
        // The next click automatically refreshes the signature.
      } else if (entry.reused) entry.image = imageFields(cached);
      else missing.set(hash,entry);
      entries.push(entry);
    }
    if (missing.size) {
      const uploads = Array.from(missing.values(),entry => buildImageUpload(new File([entry.blob],entry.name+
        (entry.command.art.mime === 'image/webp' ? '.webp' : entry.command.art.mime === 'image/jpeg' ? '.jpg' : '.png'),{type:entry.command.art.mime}))
        .name(entry.name).grid(grid(entry.command.kind,entry.command.art)).visible(false).build());
      const allTokens = batch.every(command => command.kind === 'TOKEN'),allDocuments = batch.every(command => command.kind === 'DOCUMENT');
      const type = allTokens ? 'CHARACTER' : allDocuments ? 'PROP' : undefined;
      progress(missing.size === 1 ? 'Première importation de ce cadrage : choisis un dossier dans Owlbear.' : 'Choisis un dossier Owlbear pour les '+missing.size+' nouveaux rendus.');
      await OBR.assets.uploadImages(uploads,type);await requireGM(batch[0].scene);
      const search = missing.size === 1 ? missing.values().next().value.name : 'Archives ·';
      progress(missing.size === 1 ? 'Sélectionne l’image « '+search+' » pour terminer. Ce cadrage sera ensuite réutilisable sans réimportation.' :
        'Sélectionne les '+missing.size+' images « Archives · … » qui viennent d’être ajoutées, puis valide une seule fois.');
      const selected = await OBR.assets.downloadImages(missing.size > 1,search,type);await requireGM(batch[0].scene);
      if (!selected?.length) throw Error('Transfert annulé : aucune image sélectionnée dans Owlbear.');
      // Validate every selection before placing anything, especially for a revealed batch.
      for (const entry of missing.values()) {
        const asset = selected.find(asset => asset.name === entry.name);
        if (!asset || !safeImage(asset.image,entry.command.art)) throw Error('Sélectionne toutes les images indiquées, dont « '+entry.name+' ». Aucun élément du lot n’a été placé.');
        entry.image = imageFields(asset.image);
      }
      for (const entry of missing.values()) await store.putAsset(entry.hash,entry.image);
      for (const entry of entries) if (!entry.image) entry.image = missing.get(entry.hash).image;
    } else progress('Cadrages déjà importés : placement direct dans Owlbear…');
    return entries.map(entry => ({image:entry.image,reused:!!entry.reused}));
  }
  async function place(command,{image,reused},currentScene,position) {
    await requireGM(currentScene);await refresh();
    const previous = records.find(entry => entry.sourceKey === command.sourceKey && entry.kind === command.kind);
    const wasRevealed=previous ? Boolean(shared(previous.id)?.visible || previous.revealed) : false;
    const record = {...previous,id:previous?.id || command.art.id,version:command.art.version,scene:currentScene,
      sourceKey:command.sourceKey,title:command.title.trim(),kind:command.kind,image,grid:grid(command.kind,image),
      position:previous?.position || position || await centre(),scale:previous?.scale || {x:1,y:1},rotation:previous?.rotation || 0,locked:previous?.locked || false,revealed:false};
    await store.put(record);
    const framing = command.framing;
    if (framing && typeof framing.identity === 'string' && /^[a-f0-9]{64}$/.test(framing.identity))
      await store.putPreset(command.sourceKey,{identity:framing.identity,kind:command.kind,page:Number.isInteger(framing.page) && framing.page > 0 && framing.page <= 10000 ? framing.page : 1,crop:normalizeCrop(framing.crop)});
    await visibility(record,command.reveal === true || (command.reveal !== false && wasRevealed));
    return {title:record.title,revealed:record.revealed,assetId:record.id,reused};
  }
  async function execute(command,progress = () => {}) {
    const currentScene = await requireGM(command.scene);
    if (command.action === 'context') {
      const keys = Array.isArray(command.sourceKeys) ? command.sourceKeys.filter(key => typeof key === 'string' && key.length <= 300).slice(0,20) : [];
      const presets = [];for (const source of keys) presets.push({source,value:await store.preset(source)});
      return {scene:currentScene,preset:typeof command.sourceKey === 'string' && command.sourceKey.length <= 300 ? await store.preset(command.sourceKey) : null,presets};
    }
    if (command.action === 'focus') {
      await refresh();const record = records.find(entry => entry.sourceKey === command.sourceKey);
      if (!record) throw Error('Transfère d’abord cette cellule dans la scène Owlbear ouverte.');
      const bounds = await (shared(record.id) ? OBR.scene.items : OBR.scene.local).getItemBounds([record.id]);
      await requireGM(currentScene);await OBR.viewport.animateToBounds(bounds);return {focused:true};
    }
    if (command.action === 'batch') {
      const batch = command.commands;
      if (!Array.isArray(batch) || !batch.length || batch.length > 20 || !batch.every(validTransfer) ||
          new Set(batch.map(entry => entry.sourceKey+':'+entry.kind)).size !== batch.length ||
          batch.reduce((total,entry) => total+entry.art.data.length,0) > 40 * 1024 * 1024) throw Error('Prépare un lot de 1 à 20 éléments, limité à 30 Mo de rendus.');
      const scoped = batch.map(entry => ({...entry,scene:currentScene,reveal:command.reveal === true}));
      const images = await nativeImages(scoped,progress),origin = await centre(),results = [];
      try {
        for (let i = 0;i < scoped.length;i++) {
          progress('Placement '+(i+1)+' / '+scoped.length+'…');
          results.push(await place(scoped[i],images[i],currentScene,{x:origin.x+(i%4)*180,y:origin.y+Math.floor(i/4)*180}));
        }
      } catch (error) { throw Error(results.length+' élément(s) placé(s) avant l’interruption. '+error.message); }
      return {results,count:results.length,revealed:command.reveal === true};
    }
    if (command.action === "list") {
      await refresh();
      return {scene:currentScene,records:records.map(record => ({id:record.id,title:record.title,
        kind:record.kind,revealed:Boolean(shared(record.id)?.visible)}))};
    }
    if (["visibility","remove"].includes(command.action)) {
      const record = await store.get(command.assetId);
      if (!record || record.scene !== currentScene) throw Error("Cet élément n’appartient pas à la scène ouverte.");
      if (command.action === "visibility") await visibility(record,command.reveal === true);
      else {
        if (shared(record.id)) await OBR.scene.items.deleteItems([record.id]);
        await removeLocal(record.id);
        await store.remove(record.id);
        await refresh();
      }
      return {title:record.title,revealed:record.revealed};
    }
    if (command.action !== 'transfer' || !validTransfer(command)) throw Error('Le transfert n’est pas valide.');
    const [image] = await nativeImages([{...command,scene:currentScene}],progress);
    return place(command,image,currentScene);
  }
  channel.addEventListener("message",event => {
    const data = event.data;
    if (data?.type !== "artwork-command" || role !== "GM" || closed || !validSession(data.id)) return;
    commands = commands.then(async () => {
      try {
        const result = await execute(data.command || {},message => {
          if (!closed && role === "GM") channel.postMessage({type:"artwork-progress",id:data.id,message});
        });
        if (!closed) channel.postMessage({type:"artwork-result",id:data.id,safe:true,result});
      } catch (error) {
        if (!closed) channel.postMessage({type:"artwork-result",id:data.id,safe:false,
          message:error?.message || "Transfert impossible."});
      }
    }).catch(console.warn);
  });
  offs.push(OBR.scene.items.onChange(value => { items = value; void queueRender(); }));
  offs.push(OBR.scene.local.onChange(value => {
    if (role !== "GM" || closed) return;
    for (const item of value) {
      const before = locals.get(item.id), record = records.find(entry => entry.id === item.id);
      if (!before || !record || JSON.stringify(pose(before)) === JSON.stringify(pose(item))) continue;
      locals.set(item.id,item);
      Object.assign(record,pose(item));
      commands = commands.then(async () => { await requireGM(record.scene); await store.put(record); }).catch(console.warn);
    }
  }));
  offs.push(OBR.scene.onReadyChange(() => { void refresh().catch(console.warn); }));
  offs.push(OBR.scene.onMetadataChange(() => { void refresh().catch(console.warn); }));
  offs.push(OBR.player.onChange(player => {
    if (player.role === role) return;
    role = player.role;
    generation++;
    records = [];
    void queuePurge();
    void refresh().catch(console.warn);
  }));
  window.addEventListener("pagehide",() => {
    closed = true;
    generation++;
    offs.forEach(off => off?.());
    if (locals.size) void OBR.scene.local.deleteItems(Array.from(locals.keys())).catch(() => {});
    channel.close();
    void commands.finally(() => store?.close());
  },{once:true});
  // When Owlbear was opened from the primary Archives tab, use the existing
  // same-origin opener relationship: no additional Owlbear editor/picker.
  let primaryTab=null;
  function announceMain() {
    if(closed||role!=='GM'||!validRoomId(OBR.room.id))return;
    try{
      const opener=window.top.opener;
      if(!opener||opener.closed||opener.location.origin!==location.origin||
        !/\\/archives-app-v64-v55\\.html$/.test(opener.location.pathname))return;
      primaryTab=opener;
      opener.postMessage(packet('artwork-main-ready',{roomId:OBR.room.id}),location.origin);
    }catch{}
  }
  function onMainCommand(event){
    const data=event.data;
    if(closed||role!=='GM'||event.origin!==location.origin||event.source!==primaryTab||
      !isPacket(data)||data.roomId!==OBR.room.id)return;
    if(data.type==='artwork-main-ack')return;
    if(data.type!=='artwork-main-command'||!validSession(data.id))return;
    commands=commands.then(async()=>{
      try{
        await requireGM();
        const result=await execute(data.command||{},message=>{
          primaryTab?.postMessage(packet('artwork-main-progress',
            {roomId:OBR.room.id,id:data.id,message}),location.origin);
        });
        primaryTab?.postMessage(packet('artwork-main-result',
          {roomId:OBR.room.id,id:data.id,safe:true,result}),location.origin);
      }catch(error){
        primaryTab?.postMessage(packet('artwork-main-result',
          {roomId:OBR.room.id,id:data.id,safe:false,message:error?.message||'Transfert impossible.'}),location.origin);
      }
    }).catch(console.warn);
  }
  window.addEventListener('message',onMainCommand);
  const announceTimer=setInterval(announceMain,12000);
  window.addEventListener('pagehide',()=>{
    clearInterval(announceTimer);window.removeEventListener('message',onMainCommand);
  },{once:true});
  await queuePurge();
  await refresh();
  announceMain();
}
