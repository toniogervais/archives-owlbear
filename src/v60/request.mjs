import { isPacket,packet } from "../v56/link.mjs";
const pending = new Map();
export function requireEditor() {
  const state = window.DuneApp?.getState?.();
  if (!state || state.playerMode || state.strictReadOnly) throw Error("Bibliothèque réservée au MJ.");
  if (window.parent === window || new URLSearchParams(location.search).get("owl-editor") !== "1")
    throw Error("Ouvre les Archives depuis le livre dans ta salle Owlbear pour accéder à cette bibliothèque.");
  return state;
}
export function libraryRequest(command) {
  requireEditor();
  const id = crypto.randomUUID();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { pending.delete(id);reject(Error("La bibliothèque ne répond pas. Garde la salle Owlbear ouverte et réessaie.")); },20000);
    pending.set(id,{resolve,reject,timer});
    window.parent.postMessage(packet("owl-file-command",{id,command}),location.origin);
  });
}
window.addEventListener("message",event => {
  if (event.source !== window.parent || event.origin !== location.origin || !isPacket(event.data) || event.data.type !== "owl-file-result") return;
  const entry = pending.get(event.data.id);if (!entry) return;
  pending.delete(event.data.id);clearTimeout(entry.timer);
  if (event.data.safe) entry.resolve(event.data.result);else entry.reject(Error(event.data.message || "Opération impossible."));
});
