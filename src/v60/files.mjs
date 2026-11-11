export const maxDocumentBytes = 25 * 1024 * 1024;
export const maxMediaBytes = 8 * 1024 * 1024;
export const mediaChannel = "fr.archives-imaginaire.bridge/media-v60";
export const mediaModal = "fr.archives-imaginaire.bridge/media-view-v60";
export const chunkBytes = 9000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const validId = value => typeof value === "string" && uuid.test(value);
const types = {
  "application/pdf":"DOCUMENT", "text/plain":"DOCUMENT", "image/png":"DOCUMENT", "image/jpeg":"DOCUMENT", "image/webp":"DOCUMENT",
  "audio/mpeg":"AUDIO", "audio/wav":"AUDIO", "audio/x-wav":"AUDIO", "audio/ogg":"AUDIO", "audio/mp4":"AUDIO", "audio/webm":"AUDIO",
  "video/mp4":"VIDEO", "video/webm":"VIDEO", "video/ogg":"VIDEO"
};
const extensions = {pdf:"application/pdf",txt:"text/plain",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",
  mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",m4a:"audio/mp4",mp4:"video/mp4",webm:"video/webm",ogv:"video/ogg"};
const aliases = {"audio/mp3":"audio/mpeg","audio/x-m4a":"audio/mp4","audio/wave":"audio/wav",
  "audio/x-pn-wav":"audio/wav","application/ogg":"audio/ogg","image/jpg":"image/jpeg"};
export function kindOf(mime) { return types[mime] || ""; }
export function fileMime(file) {
  const raw = String(file?.type || "").split(";")[0].trim().toLowerCase(),mime = aliases[raw] || raw;
  return types[mime] ? mime : !mime || mime === "application/octet-stream"
    ? extensions[String(file.name || "").split(".").pop().toLowerCase()] || "" : "";
}
export async function validateFile(file) {
  const mime = fileMime(file),kind = kindOf(mime);
  if (!(file instanceof Blob) || !kind || !file.size) throw Error("Formats : PDF, TXT, PNG, JPG, WebP, MP3, WAV, OGG, M4A, MP4 et WebM.");
  const limit = kind === "DOCUMENT" ? maxDocumentBytes : maxMediaBytes;
  if (file.size > limit) throw Error(kind === "DOCUMENT" ? "Document limité à 25 Mo." : "Sons et vidéos limités à 8 Mo par fichier. Prépare un extrait plus court.");
  const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());
  const ascii = (from,to) => String.fromCharCode(...bytes.slice(from,to));
  const valid = mime === "text/plain" ||
    mime === "application/pdf" && ascii(0,5) === "%PDF-" ||
    mime === "image/png" && bytes[0] === 137 && ascii(1,4) === "PNG" ||
    mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 ||
    mime === "image/webp" && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP" ||
    mime === "audio/mpeg" && (ascii(0,3) === "ID3" || bytes[0] === 255 && (bytes[1] & 224) === 224) ||
    ["audio/wav","audio/x-wav"].includes(mime) && ascii(0,4) === "RIFF" && ascii(8,12) === "WAVE" ||
    ["audio/ogg","video/ogg"].includes(mime) && ascii(0,4) === "OggS" ||
    ["video/mp4","audio/mp4"].includes(mime) && ascii(4,8) === "ftyp" ||
    ["video/webm","audio/webm"].includes(mime) && bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163;
  if (!valid) throw Error("Le contenu du fichier ne correspond pas à son format. Choisis le fichier original.");
  return {mime,kind};
}
export async function digest(value) {
  const bytes = value instanceof Blob ? await value.arrayBuffer() : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),byte => byte.toString(16).padStart(2,"0")).join("");
}
export function validPublication(value) {
  return validSharedFile(value) && ["AUDIO","VIDEO"].includes(kindOf(value.mime));
}
export function validSharedFile(value) {
  const kind = kindOf(value?.mime),limit = kind === 'DOCUMENT' ? maxDocumentBytes : maxMediaBytes;
  return value && validId(value.id) && validId(value.version) && !!kind &&
    typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 120 &&
    Number.isInteger(value.size) && value.size > 0 && value.size <= limit &&
    typeof value.hash === "string" && /^[a-f0-9]{64}$/.test(value.hash);
}
// Explicit allowlist: never publish a library record, filename, linked cell or campaign.
export const publicFile = ({id,version,title,mime,size,hash}) => ({id,version,title,mime,size,hash});
export async function* fileChunks(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  for (let offset = 0,index = 0;offset < bytes.length;offset += chunkBytes,index++) {
    yield {index,chunk:btoa(String.fromCharCode(...bytes.subarray(offset,offset + chunkBytes)))};
  }
}
export function fileReceiver(publication,validate = validPublication) {
  if (!validate(publication)) throw Error("Présentation invalide.");
  const bytes = new Uint8Array(publication.size),seen = new Set();
  const count = Math.ceil(publication.size / chunkBytes);
  let transfer,finished = false;
  return {
    async push(data) {
      if (finished || data?.id !== publication.id || data.version !== publication.version || !validId(data.transfer) ||
          !Number.isInteger(data.index) || data.index < 0 || data.index >= count ||
          typeof data.chunk !== "string" || data.chunk.length > Math.ceil(chunkBytes / 3) * 4 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(data.chunk)) return null;
      if (!transfer) { if (data.index !== 0) return null;transfer = data.transfer; }
      if (transfer !== data.transfer || seen.has(data.index)) return null;
      const decoded = atob(data.chunk),length = Math.min(chunkBytes,publication.size - data.index * chunkBytes);
      if (decoded.length !== length) return null;
      bytes.set(Uint8Array.from(decoded,ch => ch.charCodeAt(0)),data.index * chunkBytes);seen.add(data.index);
      if (seen.size !== count) return {progress:Math.floor(seen.size / count * 100)};
      finished = true;
      if (await digest(bytes) !== publication.hash) throw Error("Le fichier reçu est incomplet. Réessaie.");
      return {progress:100,blob:new Blob([bytes],{type:publication.mime})};
    }
  };
}
export async function openFileLibrary(room,owner) {
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open("archives-imaginaire-files",1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("entries").createIndex("scope","scope");
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close();resolve(request.result); };request.onerror = () => reject(request.error);
  });
  const key = id => [room,owner,id],scope = [room,owner];
  function transaction(names,mode,fn) {
    return new Promise((resolve,reject) => {
      const tx = db.transaction(names,mode);let result;
      try { result = fn(name => tx.objectStore(name)); }
      catch (error) { tx.abort();reject(error);return; }
      tx.oncomplete = () => resolve(result?.result);tx.onabort = () => reject(tx.error || Error("La sauvegarde du fichier a échoué."));tx.onerror = () => {};
    });
  }
  return {
    list:() => transaction(["entries"],"readonly",get => get("entries").index("scope").getAll(scope)),
    get:id => transaction(["entries"],"readonly",get => get("entries").get(key(id))),
    blob:id => transaction(["files"],"readonly",get => get("files").get(key(id))),
    put:(entry,blob) => transaction(blob ? ["entries","files"] : ["entries"],"readwrite",get => {
      if (blob) get("files").put(blob,key(entry.id));
      return get("entries").put({...entry,scope},key(entry.id));
    }),
    remove:id => transaction(["entries","files"],"readwrite",get => { get("files").delete(key(id));return get("entries").delete(key(id)); }),
    restore:(records,replace = false) => transaction(['entries','files'],'readwrite',get => {
      if (replace) for (const name of ['entries','files']) get(name).delete(IDBKeyRange.bound([room,owner],[room,owner,[]]));
      for (const {entry,blob} of records) { get('files').put(blob,key(entry.id));get('entries').put({...entry,scope},key(entry.id)); }
    }),
    close:() => db.close()
  };
}
