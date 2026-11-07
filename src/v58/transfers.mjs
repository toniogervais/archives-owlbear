import OBR, { buildImage, buildImageUpload } from "../../assets/owlbear-transfer-sdk-v55.mjs";
import { localRoom } from "../v57/room.mjs?v=4160";
import { validSession } from "../v56/link.mjs";
import { artworkBlob, assetKey, privateArtworkStore, sceneKey, validArtwork } from "./model.mjs";

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
        await OBR.scene.local.addItems([item]);
        locals.set(record.id,item);
      } else if (JSON.stringify(item) !== JSON.stringify(existing)) {
        await OBR.scene.local.updateItems([record.id],draft => { Object.assign(draft[0],item); });
        locals.set(record.id,item);
      }
    }
  }
  function queueRender() {
    renders = renders.then(render).catch(error => console.warn("Affichage privé Owlbear",error));
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
      if (locals.size) await OBR.scene.local.deleteItems(Array.from(locals.keys()));
      locals.clear();
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
  async function nativeImage(command) {
    const name = command.title.trim() + " · " + command.art.version.slice(0,8);
    const upload = buildImageUpload(new File([artworkBlob(command.art)],name + (command.art.mime === "image/webp" ? ".webp" : command.art.mime === "image/jpeg" ? ".jpg" : ".png"),{type:command.art.mime}))
      .name(name).grid(grid(command.kind,command.art)).visible(false).build();
    const type = command.kind === "TOKEN" ? "CHARACTER" : "PROP";
    await OBR.assets.uploadImages([upload],type);
    await requireGM(command.scene);
    const selected = await OBR.assets.downloadImages(false,name,type);
    await requireGM(command.scene);
    if (!selected?.length) throw Error("Transfert annulé : aucune image sélectionnée dans Owlbear.");
    const asset = selected[0];
    const image = asset.image;
    if (asset.name !== name || !image || typeof image.url !== "string" || !image.url.startsWith("https://") ||
        !["image/png","image/jpeg","image/webp"].includes(image.mime) ||
        image.width !== command.art.width || image.height !== command.art.height)
      throw Error("Sélectionne l’image « " + name + " » qui vient d’être ajoutée dans Owlbear, puis réessaie.");
    // Allowlist fields. Never persist a file, URL, or title from another asset.
    return {url:image.url,mime:image.mime,width:image.width,height:image.height};
  }
  async function execute(command) {
    const currentScene = await requireGM(command.scene);
    if (command.action === "context") return {scene:currentScene};
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
    if (command.action !== "transfer" || !["TOKEN","DOCUMENT"].includes(command.kind) ||
        typeof command.sourceKey !== "string" || !command.sourceKey || command.sourceKey.length > 300 ||
        typeof command.title !== "string" || !command.title.trim() || command.title.length > 120 ||
        !validArtwork(command.art)) throw Error("Le transfert n’est pas valide.");
    const image = await nativeImage(command);
    await refresh();
    const previous = records.find(entry => entry.sourceKey === command.sourceKey && entry.kind === command.kind);
    const position = previous?.position || await centre();
    const record = {...previous,id:previous?.id || command.art.id,version:command.art.version,scene:currentScene,
      sourceKey:command.sourceKey,title:command.title.trim(),kind:command.kind,image,grid:grid(command.kind,image),
      position,scale:previous?.scale || {x:1,y:1},rotation:previous?.rotation || 0,locked:previous?.locked || false,
      revealed:false};
    // Private, durable record first. Sharing is a separate, explicit operation.
    await store.put(record);
    await visibility(record,command.reveal === true);
    return {title:record.title,revealed:record.revealed,assetId:record.id};
  }
  channel.addEventListener("message",event => {
    const data = event.data;
    if (data?.type !== "artwork-command" || role !== "GM" || closed || !validSession(data.id)) return;
    commands = commands.then(async () => {
      try {
        const result = await execute(data.command || {});
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
    void queueRender();
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
  await refresh();
}
