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

export async function privateArtworkStore(room, owner) {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("archives-imaginaire-private-artwork", 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore("artwork");
      store.createIndex("scope", "scope");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const key = id => [room, owner, id];
  const transact = (mode, operation) => new Promise((resolve, reject) => {
    const tx = db.transaction("artwork", mode);
    const request = operation(tx.objectStore("artwork"));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || Error("Sauvegarde du transfert impossible."));
    tx.onerror = () => {};
  });
  return {
    list: scene => transact("readonly", store => store.index("scope").getAll([room, owner, scene])),
    remove: id => transact("readwrite", store => store.delete(key(id))),
    get: id => transact("readonly", store => store.get(key(id))),
    put: record => transact("readwrite", store => store.put({...record, scope:[room, owner, record.scene]}, key(record.id))),
    close: () => db.close()
  };
}
