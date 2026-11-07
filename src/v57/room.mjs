import { validSession } from "../v56/link.mjs";

export const release = "4210";
export const roomChannel = "fr.archives-imaginaire.bridge/room-v57";
export const inviteId = "fr.archives-imaginaire.bridge/screen-invite-v55";
export const localViewer = "owl-view";
export const localEditor = "owl-editor";
const chunkSize = 9000;
const maxChunks = 1024;
const maxDecoded = 18 * 1024 * 1024;

export async function localRoom(OBR) {
  const connectionId = await OBR.player.getConnectionId();
  if (typeof connectionId !== "string" || !connectionId) throw Error("La salle Owlbear n’est pas disponible.");
  const scope = roomChannel + ":" + OBR.room.id + ":" + OBR.player.id;
  let tab = connectionId;
  try {
    tab = sessionStorage.getItem(scope) || connectionId;
    sessionStorage.setItem(scope, tab);
  } catch {}
  return {connectionId, channel:new BroadcastChannel(scope + ":" + tab)};
}

export function screenUrl(target, native = true, options = {}) {
  const url = new URL("../../invite-v55.html", import.meta.url);
  url.searchParams.set("v", release);
  url.hash = target + (native ? "&room=1" : "");
  if (options.required) url.hash += '&required=1';
  if (validSession(options.id)) url.hash += '&id='+options.id;
  return url.href;
}

export function archivesUrl(native = false) {
  const url = new URL("../../archives-host-v55.html", import.meta.url);
  url.searchParams.set("v", release);
  if (native) url.hash = localViewer;
  return url.href;
}

export function roomMembers(OBR) {
  let members = new Map(), pending, generation = 0, disposed = false;
  const replace = players => {
    generation++;
    members = new Map(players.map(player => [player.connectionId, player.role]));
  };
  const off = OBR.party.onChange(replace);
  async function refresh() {
    const started = generation;
    pending ||= OBR.party.getPlayers().then(players => {
      if (!disposed && generation === started) replace(players);
    }).finally(() => { pending = null; });
    await pending;
  }
  void refresh().catch(() => {});
  const isMember = async (id, role) => {
    if (!members.has(id)) await refresh();
    return !disposed && members.get(id) === role;
  };
  isMember.dispose = () => { disposed = true; off?.(); };
  return isMember;
}

export async function snapshotChunks(snapshot) {
  const json = JSON.stringify(snapshot);
  const raw = new TextEncoder().encode(json);
  if (raw.length > maxDecoded) throw Error("La vue joueur est trop volumineuse. Réduis la taille des images révélées.");
  let bytes = raw, encoding = "raw";
  if (typeof CompressionStream === "function") {
    const gzip = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
    const zipped = new Uint8Array(await new Response(gzip).arrayBuffer());
    if (zipped.length < raw.length) { bytes = zipped; encoding = "gzip"; }
  }
  const count = Math.ceil(bytes.length / chunkSize);
  if (!count || count > maxChunks) throw Error("La vue joueur est trop volumineuse.");
  return Array.from({length:count}, (_, index) => ({
    type:"snapshot", encoding, index, count,
    chunk:btoa(String.fromCharCode(...bytes.subarray(index * chunkSize, (index + 1) * chunkSize)))
  }));
}

export function validSnapshot(snapshot) {
  return Array.isArray(snapshot?.boards) && snapshot.boards.length > 0 &&
    snapshot.boards.every(board => board && typeof board.id === "string" &&
      Array.isArray(board.nodes) && Array.isArray(board.links));
}

export function snapshotReader(onSnapshot, onIncomplete) {
  let current, lastRevision, lastSender, lastPublication;
  return async (data, sender) => {
    if (!validSession(data.id) || !validSession(data.revision) ||
        !["raw","gzip"].includes(data.encoding) || !Number.isInteger(data.count) ||
        data.count < 1 || data.count > maxChunks || !Number.isInteger(data.index) ||
        data.index < 0 || data.index >= data.count || typeof data.chunk !== "string" ||
        !data.chunk.length || data.chunk.length > chunkSize * 4 / 3 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data.chunk) || data.id === lastPublication ||
        (data.revision === lastRevision && sender === lastSender)) return;
    if (!current || current.id !== data.id || current.sender !== sender) {
      clearTimeout(current?.timer);
      const reception = {id:data.id, sender, revision:data.revision, count:data.count,
        encoding:data.encoding, parts:new Map()};
      reception.timer = setTimeout(() => {
        if (current === reception) { current = null; onIncomplete(); }
      }, 10000);
      current = reception;
    }
    const reception = current;
    if (reception.encoding !== data.encoding || reception.revision !== data.revision ||
        reception.count !== data.count) return;
    reception.parts.set(data.index, data.chunk);
    if (reception.parts.size !== reception.count || reception.decoding) return;
    reception.decoding = true;
    try {
      const parts = Array.from({length:reception.count}, (_, i) => Uint8Array.from(atob(reception.parts.get(i)), ch => ch.charCodeAt(0)));
      let bytes = new Blob(parts).stream();
      if (reception.encoding === "gzip") bytes = bytes.pipeThrough(new DecompressionStream("gzip"));
      const reader = bytes.getReader();
      const decoder = new TextDecoder("utf-8", {fatal:true});
      let size = 0, json = "";
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxDecoded) { await reader.cancel(); throw Error("Vue trop volumineuse."); }
        json += decoder.decode(value, {stream:true});
      }
      const snapshot = JSON.parse(json + decoder.decode());
      if (current !== reception) return;
      if (!validSnapshot(snapshot)) throw Error("Vue joueur invalide.");
      lastPublication = reception.id;
      if (lastRevision !== reception.revision || lastSender !== sender) {
        lastRevision = reception.revision;
        lastSender = sender;
        onSnapshot(snapshot, reception.revision);
      }
    } catch { if (current === reception) onIncomplete(); }
    finally {
      clearTimeout(reception.timer);
      if (current === reception) current = null;
    }
  };
}
