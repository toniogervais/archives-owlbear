import OBR, { buildImage, buildImageUpload } from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { localRoom } from "../v57/room.mjs?v=4590";
import {isPacket,packet,validRoomId,validSession} from "../v56/link.mjs?v=4590";
import { artworkBlob,assetKey,blobDigest,privateArtworkStore,sceneKey,validArtwork } from "./model.mjs?v=4590";
import { normalizeCrop } from "../v61/token-crop.mjs";
import {safeHostedImage} from "./hosted-assets.mjs?v=4590";
import {mergeTransferredTokenCondition,publicTokenMarker} from '../v82/npc-token-model.mjs?v=4660';

// Only the GM talks to this local channel. Unrevealed artwork never enters a
// shared item, broadcast, room metadata, public bucket, or player snapshot.
export async function installArtworkTransfers() {
  const {channel} = await localRoom(OBR);
  let role = await OBR.player.getRole(), scene = "", store, records = [], items = [];
  let closed = false, generation = 0;
  let refreshQueue = Promise.resolve();
  let commands = Promise.resolve(), renders = Promise.resolve(), syncTimer;
  const locals = new Map();
  const expectedLocalRemovals = new Set(),expectedSharedRemovals = new Set();
  const deleted = new Map();
  const offs = [];
  function captureLabel(item,before){
    if(role!=='GM'||!before||item.metadata?.[assetKey]?.id!==item.id||item.text?.plainText===before.text?.plainText)return;
    if(item.lastModifiedUserId&&item.lastModifiedUserId!==OBR.player.id)return;
    const record=records.find(r=>r.id===item.id),text=item.text?.plainText;
    if(!record||typeof text!=='string'||text.length>120||record.label===text)return;
    record.label=text;commands=commands.then(async()=>{await requireGM(record.scene);await store.put(record);}).catch(console.warn);
  }
  const pose = item => ({position:item.position, scale:item.scale, rotation:item.rotation, locked:item.locked});
  const shared = id => items.find(item => item.id === id && item.metadata?.[assetKey]?.id === id);
  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{
      if(closed||role!=='GM'||!scene)return;
      // Only delivered locally to this GM/browser; never broadcast to players.
      const state={scene,records:records.filter(record=>!isDeleted(record)).map(record=>{
        const native=shared(record.id)||locals.get(record.id);
        return {id:record.id,sourceKey:record.sourceKey,title:record.title,kind:record.kind,
          revealed:Boolean(shared(record.id)?.visible),visibleToGM:!!native,
          private:!shared(record.id),position:native?.position||record.position};
      })};
      channel.postMessage({type:'artwork-sync',...state});
      try{
        if(primaryTab&&!primaryTab.closed&&primaryTab.location.origin===location.origin)
          primaryTab.postMessage(packet('artwork-main-sync',{roomId:OBR.room.id,...state}),location.origin);
      }catch{}
    },90);
  }
  const isDeleted = record => deleted.get(record.id)?.scene === record.scene && deleted.get(record.id)?.version === record.version;
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
      .name(record.title)
      .createdUserId(OBR.player.id)
      .plainText(record.label||'').textItemType("LABEL")
      .layer(record.kind === "TOKEN" ? "CHARACTER" : "PROP")
      .position(record.position).visible(true)
      .metadata({[assetKey]:publicTokenMarker(record)}).build();
    Object.assign(item,pose(record));
    // Local scene: GM only. Keep the same genuine CHARACTER/PROP layer;
    // POPOVER isn't an editable character layer in the Owlbear scene.
    if (hidden) item.zIndex = 0;
    return item;
  }
  async function removeLocal(id) {
    if (!locals.has(id)) return;
    locals.delete(id);
    await deleteLocalItems([id]);
  }
  async function deleteLocalItems(ids) {
    ids.forEach(id=>expectedLocalRemovals.add(id));
    try { await OBR.scene.local.deleteItems(ids); }
    catch(error) { ids.forEach(id=>expectedLocalRemovals.delete(id));throw error; }
  }
  async function deleteSharedItems(ids) {
    ids.forEach(id=>expectedSharedRemovals.add(id));
    try { await OBR.scene.items.deleteItems(ids); }
    catch(error) { ids.forEach(id=>expectedSharedRemovals.delete(id));throw error; }
  }
  function nativeDeletion(record,version) {
    if(!record||version&&record.version!==version||isDeleted(record)||closed||role!=="GM")return;
    const marker={scene:record.scene,version:record.version};deleted.set(record.id,marker);
    // Stop reconciliation immediately, then remove the persisted placement.
    // Scene unloads and our own reveal/hide/cleanup operations are not deletions.
    commands=commands.then(async()=>{
      if(closed||role!=="GM"||!await OBR.scene.isReady()||await OBR.player.getRole()!=="GM"||
          (await OBR.scene.getMetadata())?.[sceneKey]!==marker.scene){
        if(deleted.get(record.id)===marker)deleted.delete(record.id);return;
      }
      const current=await store.get(record.id);
      if(current&&current.scene===marker.scene&&current.version===marker.version){
        await store.remove(record.id);
        records=records.filter(entry=>entry.id!==record.id||entry.version!==marker.version);
      }
      await queueRender();
      scheduleSync();
    }).catch(error=>console.warn("Suppression du transfert Owlbear",error));
  }
  // Local items are ephemeral Owlbear overlays. Reconcile against the *real*
  // local scene, not just our in-memory map: the browser/scene can discard an
  // item without invalidating its saved private record.
  async function render() {
    const active=generation;
    const wanted=role==="GM"&&!closed?records.filter(record=>!isDeleted(record)&&!shared(record.id)):[];
    const actual=await OBR.scene.local.getItems(item=>item.metadata?.[assetKey]?.id===item.id);
    if(active!==generation||closed||role!=="GM")return;
    const present=new Map(actual.map(item=>[item.id,item]));
    const wantedIds=new Set(wanted.map(record=>record.id));
    const obsolete=actual.filter(item=>!wantedIds.has(item.id));
    if(obsolete.length)await deleteLocalItems(obsolete.map(item=>item.id));
    for(const id of Array.from(locals.keys()))if(!wantedIds.has(id))locals.delete(id);
    for(const record of wanted){
      if(active!==generation||closed||role!=="GM")return;
      expectedLocalRemovals.delete(record.id);
      const desired=makeItem(record,true);
      const current=present.get(record.id);
      if(!current){
        await OBR.scene.local.addItems([desired]);
        const confirmed=await OBR.scene.local.getItems([record.id]);
        if(!confirmed.some(item=>item.id===record.id)){
          throw Error('Owlbear n’a pas conservé le token dans la couche locale du MJ. Aucun élément n’a été partagé.');
        }
        locals.set(record.id,desired);
      }else{
        // A visual/position update only when needed; do not override a GM
        // dragging an existing token with stale saved coordinates.
        locals.set(record.id,current);
        if(current.image?.url!==desired.image?.url ||
           current.image?.width!==desired.image?.width ||
           current.image?.height!==desired.image?.height ||
           current.visible!==true ||
           current.name!==desired.name || current.layer!==desired.layer || current.text?.plainText!==desired.text?.plainText ||
           current.metadata?.[assetKey]?.hasSheet!==desired.metadata?.[assetKey]?.hasSheet ||
            current.metadata?.[assetKey]?.kind!==desired.metadata?.[assetKey]?.kind){
          const updated={...desired,...pose(current)};
          await OBR.scene.local.updateItems([record.id],draft=>{Object.assign(draft[0],updated);});
          locals.set(record.id,updated);
        }
      }
    }
  }
  function queueRender() {
    // Never report a successful hidden transfer when Owlbear rejects its private image.
    const next = renders.catch(() => {}).then(render);
    renders = next;
    return next;
  }
  function queuePurge() {
    // Read the actual local scene after older renders finish. An add operation
    // can have completed while a scene change invalidated its tracking map.
    renders = renders.catch(() => {}).then(async () => {
      if (!await OBR.scene.isReady()) { locals.clear();return; }
      const owned = await OBR.scene.local.getItems(item => item.metadata?.[assetKey]?.id === item.id);
      if (owned.length) await deleteLocalItems(owned.map(item => item.id));
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
      // Upgrade only our own legacy labels. Player account names are not token
      // names; other existing labels chosen by the GM remain intact.
      const names=new Set((await OBR.party.getPlayers()).filter(p=>p.role==='PLAYER').map(p=>p.name));
      for(const record of currentRecords)if(record.label===undefined){
        const existing=currentItems.find(item=>item.id===record.id&&item.metadata?.[assetKey]?.id===item.id);
        const label=existing?.text?.plainText??record.title;
        record.label=names.has(label)?'':label;await store.put(record);
        if(existing&&existing.text?.plainText!==record.label)await OBR.scene.items.updateItems([record.id],draft=>{draft[0].text={...draft[0].text,type:'PLAIN',plainText:record.label};});
      }
    }
    if (closed) return;
    if (key !== scene) {
      generation++;
      expectedSharedRemovals.clear();
      records = [];
      await queuePurge();
      // A previously revealed placement missing from its saved scene was
      // deleted while the extension was closed (including older ghost records).
      // Hidden preparations are intentionally restored after a normal reload.
      if(key&&role==="GM"&&!closed&&await OBR.player.getRole()==="GM"&&
          await OBR.scene.isReady()&&(await OBR.scene.getMetadata())?.[sceneKey]===key){
        const ids=new Set(currentItems.filter(item=>item.metadata?.[assetKey]?.id===item.id).map(item=>item.id));
        const absent=currentRecords.filter(record=>record.revealed===true&&!ids.has(record.id));
        for(const record of absent)await store.remove(record.id);
        const removed=new Set(absent.map(record=>record.id));currentRecords=currentRecords.filter(record=>!removed.has(record.id));
      }
    }
    scene = key;
    items = currentItems;
    records = role === "GM" ? currentRecords.filter(record=>!isDeleted(record)) : [];
    await queueRender();
    scheduleSync();
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
      // The image has ALREADY been revealed. Keep its shared item and stable
      // Owlbear ID hidden in-place, so native Show works afterwards.
      // Never publish a newer unpublished image while hiding this item.
      if(existing.visible!==false)
        await OBR.scene.items.updateItems([existing.id],draft => {draft[0].visible=false;});
    }
    record.revealed = reveal;
    await store.put(record);
    await refresh();
    if(!reveal){
      const hiddenShared=shared(record.id);
      if(hiddenShared){
        if(hiddenShared.visible!==false)throw Error('Owlbear n’a pas masqué le token partagé.');
      }else{
        const check=await OBR.scene.local.getItems([record.id]);
        if(!check.some(item=>item.id===record.id && item.visible===true &&
            item.layer===(record.kind==='TOKEN'?'CHARACTER':'PROP')))
          throw Error('Token conservé dans Les Archives, mais invisible dans la couche privée du MJ. Actualise Owlbear.');
      }
    }
    scheduleSync();
  }
  const safeImage = (image,art) => image && image.width === art.width && image.height === art.height &&
    ['image/png','image/jpeg','image/webp'].includes(image.mime) && typeof image.url === 'string' && image.url.startsWith('https://') && !image.url.includes('/storage/v1/object/sign/');
  const imageFields = image => ({url:image.url,mime:image.mime,width:image.width,height:image.height});
  const validTransfer = command => command && ['TOKEN','DOCUMENT'].includes(command.kind) &&
    typeof command.sourceKey === 'string' && !!command.sourceKey && command.sourceKey.length <= 300 &&
    typeof command.title === 'string' && !!command.title.trim() && command.title.length <= 120 && validArtwork(command.art) &&
    (command.label===undefined||typeof command.label==='string'&&command.label.length<=120) &&
    (!command.hosted || (safeHostedImage(command.hosted)&&command.hosted.mime===command.art.mime&&
      command.hosted.width===command.art.width&&command.hosted.height===command.art.height)) &&
    (command.npcSheet==null || (command.kind==='TOKEN' && typeof command.npcSheet==='object' &&
      !Array.isArray(command.npcSheet) && JSON.stringify(command.npcSheet).length<=100000));
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
    const native=previous ? shared(previous.id)||locals.get(previous.id) : null;
    const placement=native?pose(native):previous;
    const wasRevealed=previous ? Boolean(shared(previous.id)?.visible || previous.revealed) : false;
    const npc=command.kind==='TOKEN'?mergeTransferredTokenCondition(previous,command.npcSheet):{sheet:null,origin:null};
    const record = {...previous,id:previous?.id || command.art.id,version:command.art.version,scene:currentScene,
      sourceKey:command.sourceKey,title:command.title.trim(),label:command.label===undefined?(previous?.label||''):command.label.trim(),kind:command.kind,image,grid:grid(command.kind,image),
      position:placement?.position || position || await centre(),scale:placement?.scale || {x:1,y:1},rotation:placement?.rotation || 0,locked:placement?.locked || false,
      npcSheet:npc.sheet,npcConditionOrigin:npc.origin,revealed:false};
    deleted.delete(record.id);
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
      await refresh();const record = records.find(entry =>
        entry.sourceKey === command.sourceKey || (typeof command.assetId === 'string' && entry.id === command.assetId));
      if (!record) throw Error('Transfère d’abord cette cellule dans la scène Owlbear ouverte.');
      // Repair missing GM-only items before framing the map.
      const native=shared(record.id);
      if(!native)await queueRender();
      if(!native) {
        const found=await OBR.scene.local.getItems([record.id]);
        if(!found.some(item=>item.id===record.id && item.visible===true))
          throw Error('Le token privé est enregistré, mais Owlbear ne le dessine pas. Vérifie le chargement de l’extension.');
      }
      const bounds = await (native ? OBR.scene.items : OBR.scene.local).getItemBounds([record.id]);
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
      await refresh();await queueRender();
      const actual=await OBR.scene.local.getItems(item=>item.metadata?.[assetKey]?.id===item.id);
      const localIds=new Set(actual.map(item=>item.id));
      return {scene:currentScene,records:records.map(record => ({id:record.id,title:record.title,label:record.label||'',
        sourceKey:record.sourceKey,kind:record.kind,revealed:Boolean(shared(record.id)?.visible),
        visibleToGM:Boolean(shared(record.id)||localIds.has(record.id)),
        privateLayer:shared(record.id)?'Owlbear · masqué':actual.find(item=>item.id===record.id)?.layer || null,
        position:shared(record.id)?.position||actual.find(item=>item.id===record.id)?.position||record.position}))};
    }
    if (["visibility","remove","label"].includes(command.action)) {
      const record = await store.get(command.assetId);
      if (!record || record.scene !== currentScene) throw Error("Cet élément n’appartient pas à la scène ouverte.");
      if(command.action==='label'){
        if(typeof command.label!=='string'||command.label.length>120)throw Error('Le nom affiché est limité à 120 caractères.');
        record.label=command.label.trim();await store.put(record);
        if(shared(record.id))await OBR.scene.items.updateItems([record.id],draft=>{draft[0].text={...draft[0].text,type:'PLAIN',plainText:record.label};});
        await refresh();
      }else if (command.action === "visibility") await visibility(record,command.reveal === true);
      else {
        if (shared(record.id)) await deleteSharedItems([record.id]);
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
  offs.push(OBR.scene.items.onChange(value => {
    value.forEach(item=>captureLabel(item,items.find(before=>before.id===item.id)));
    const ids=new Set(value.map(item=>item.id));
    for(const before of items)if(!ids.has(before.id)){
      if(expectedSharedRemovals.delete(before.id))continue;
      if(before.metadata?.[assetKey]?.id===before.id)nativeDeletion(records.find(record=>record.id===before.id),before.metadata[assetKey].version);
    }
    value.forEach(item=>expectedSharedRemovals.delete(item.id));
    for(const item of value){
      if(item.metadata?.[assetKey]?.id!==item.id)continue;
      const record=records.find(entry=>entry.id===item.id&&!isDeleted(entry));
      if(!record||record.version!==item.metadata?.[assetKey]?.version)continue;
      const revealed=item.visible===true,nativePose=pose(item);
      const label=typeof item.text?.plainText==='string'?item.text.plainText:null;
      if(record.revealed===revealed&&JSON.stringify(pose(record))===JSON.stringify(nativePose)&&
         (label===null||label===record.label))continue;
      Object.assign(record,nativePose);record.revealed=revealed;if(label!==null)record.label=label;
      const version=record.version,recordScene=record.scene;
      commands=commands.catch(()=>{}).then(async()=>{
        if(isDeleted(record))return;
        await requireGM(recordScene);
        const current=await store.get(item.id);
        if(!current||current.version!==version||current.scene!==recordScene)return;
        Object.assign(current,nativePose);current.revealed=revealed;
        if(label!==null)current.label=label;
        await store.put(current);
      }).catch(error=>console.warn('Synchronisation token Owlbear',error));
    }
    items = value;void queueRender().then(scheduleSync).catch(console.warn);
  }));
  offs.push(OBR.scene.local.onChange(value => {
    if (role !== "GM" || closed) return;
    const ids=new Set(value.map(item=>item.id)),expected=new Set();
    for(const id of expectedLocalRemovals)if(!ids.has(id)){expected.add(id);expectedLocalRemovals.delete(id);}
    for(const [id,before] of locals)if(!ids.has(id)&&!expected.has(id))nativeDeletion(records.find(record=>record.id===id),before.metadata?.[assetKey]?.version);
    for (const item of value) {
      const before = locals.get(item.id), record = records.find(entry => entry.id === item.id);
      captureLabel(item,before);
      if (!before || !record || isDeleted(record) || JSON.stringify(pose(before)) === JSON.stringify(pose(item))) continue;
      locals.set(item.id,item);
      Object.assign(record,pose(item));
      commands = commands.then(async () => { if(isDeleted(record))return;await requireGM(record.scene);
        const current=await store.get(record.id);
        if(current?.version===record.version&&!isDeleted(record)){
          Object.assign(current,pose(item));if(typeof item.text?.plainText==='string')current.label=item.text.plainText;
          await store.put(current);
        }
      }).catch(console.warn);
    }
    // Native "Hide" of a private token cannot erase it from the GM view.
    if(value.some(item=>item.metadata?.[assetKey]?.id===item.id&&
         (item.visible!==true||item.layer!==(records.find(r=>r.id===item.id)?.kind==='TOKEN'?'CHARACTER':'PROP'))))
      void queueRender().catch(console.warn);
    scheduleSync();
  }));
  offs.push(OBR.scene.onReadyChange(() => { void refresh().catch(console.warn); }));
  offs.push(OBR.scene.onMetadataChange(() => { void refresh().catch(console.warn); }));
  offs.push(OBR.player.onChange(player => {
    if (player.role === role) return;
    role = player.role;
    expectedSharedRemovals.clear();expectedLocalRemovals.clear();
    generation++;
    records = [];
    void queuePurge();
    void refresh().catch(console.warn);
  }));
  window.addEventListener("pagehide",() => {
    closed = true;
    generation++;
    offs.forEach(off => off?.());
    clearTimeout(syncTimer);
    if (locals.size) void OBR.scene.local.deleteItems(Array.from(locals.keys())).catch(() => {});
    delete window.ArchivesTokenVisibility;
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
        !opener.location.pathname.endsWith('/archives-app-v64-v55.html'))return;
      primaryTab=opener;
      opener.postMessage(packet('artwork-main-ready',{roomId:OBR.room.id}),location.origin);
      scheduleSync();
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
  window.ArchivesTokenVisibility=(id,reveal)=>{
    if(!validSession(id)||typeof reveal!=='boolean')return Promise.reject(Error('Identifiant de token invalide.'));
    const run=commands.catch(()=>{}).then(()=>execute({action:'visibility',assetId:id,reveal}));
    commands=run.catch(()=>{});
    return run;
  };
  await queuePurge();
  await refresh();
  announceMain();
}
