import { validSession } from "../v56/link.mjs";

export const assetKey = "fr.archives-imaginaire.bridge/artwork-v58";
export const sceneKey = "fr.archives-imaginaire.bridge/scene-key";
export const maxImageBytes = 5 * 1024 * 1024;

export function validArtwork(value) {
  if (!value || !validSession(value.id) || !validSession(value.version) ||
      !["image/png","image/jpeg","image/webp"].includes(value.mime) ||
      !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
      value.width < 1 || value.height < 1 || value.width > 2400 || value.height > 3200 ||
      typeof value.data !== "string" || value.data.length > Math.ceil(maxImageBytes * 4 / 3) + 100) return false;
  return new RegExp("^data:" + value.mime.replace("/", "\\/") + ";base64,[A-Za-z0-9+/]+={0,2}$").test(value.data);
}

export function artworkBlob(art) {
  const encoded = art.data.slice(art.data.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
  return new Blob([bytes], {type:art.mime});
}
export async function blobDigest(blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer())),byte => byte.toString(16).padStart(2,"0")).join("");
}

export async function privateArtworkStore(room, owner) {
  const db = await new Promise((resolve, reject) => {
    let blocked = false;
    const open = indexedDB.open("archives-imaginaire-private-artwork", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("artwork")) {
        const store = open.result.createObjectStore("artwork");store.createIndex("scope", "scope");
      }
      if (!open.result.objectStoreNames.contains("assets")) open.result.createObjectStore("assets");
      if (!open.result.objectStoreNames.contains("presets")) open.result.createObjectStore("presets");
    };
    open.onblocked = () => { blocked = true;reject(Error("Ferme les anciennes vues des Archives, puis rouvre le transfert.")); };
    open.onsuccess = () => {
      if (blocked) { open.result.close();return; }
      open.result.onversionchange = () => open.result.close();resolve(open.result);
    };
    open.onerror = () => reject(open.error);
  });
  const key = id => [room, owner, id];
  const transact = (mode, operation, name = "artwork") => new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const request = operation(tx.objectStore(name));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || Error("Sauvegarde du transfert impossible."));
    tx.onerror = () => {};
  });
  return {
    list: scene => transact("readonly", store => store.index("scope").getAll([room, owner, scene])),
    remove: id => transact("readwrite", store => store.delete(key(id))),
    get: id => transact("readonly", store => store.get(key(id))),
    put: record => transact("readwrite", store => store.put({...record, scope:[room, owner, record.scene]}, key(record.id))),
    asset: hash => transact("readonly", store => store.get(key(hash)),"assets"),
    putAsset: (hash,image) => transact("readwrite", store => store.put(image,key(hash)),"assets"),
    preset: source => transact("readonly", store => store.get(key(source)),"presets"),
    putPreset: (source,preset) => transact("readwrite", store => store.put(preset,key(source)),"presets"),
    exportPresets: () => new Promise((resolve,reject) => {
      const tx = db.transaction('presets'),request = tx.objectStore('presets').openCursor(IDBKeyRange.bound([room,owner],[room,owner,[]])),entries = [];
      request.onsuccess = () => { const cursor = request.result;if (cursor) { entries.push({source:cursor.key[2],value:cursor.value});cursor.continue(); } };
      tx.oncomplete = () => resolve(entries);tx.onabort = () => reject(tx.error);
    }),
    restorePresets: (entries,replace = false) => new Promise((resolve,reject) => {
      const tx = db.transaction('presets','readwrite'),store = tx.objectStore('presets');
      const write = () => { for (const entry of entries) store.put(entry.value,key(entry.source)); };
      if (!replace) write();else {
        const request = store.openCursor(IDBKeyRange.bound([room,owner],[room,owner,[]]));
        request.onsuccess = () => { const cursor = request.result;if (cursor) { cursor.delete();cursor.continue(); }else write(); };
      }
      tx.oncomplete = resolve;tx.onabort = () => reject(tx.error || Error('Restauration des cadrages impossible.'));tx.onerror = () => {};
    }),
    close: () => db.close()
  };
}
