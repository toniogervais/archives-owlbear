export const protocol = "archives:owlbear:v56";
export const editEvent = "archives:edit:v55";
export const roomUrlKey = "archives_owlbear_room_url_v38";
export const pairingKey = "archives-owlbear-private-link-v56";
export const screenChannel = "fr.archives-imaginaire.bridge/screen-v55";
export const liveRoomKey = "fr.archives-imaginaire.bridge/live-room-v52";
export const viewerId = "fr.archives-imaginaire.bridge/archives-viewer";
export const owlOrigins = new Set(["https://owlbear.rodeo", "https://www.owlbear.rodeo"]);

export const packet = (type, fields) => ({...fields, protocol, type});
export const isPacket = data => data?.protocol === protocol;
export const validRoomId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
export const validLiveRoom = value => typeof value === "string" && /^(JDR-)?[A-Z0-9-]{8,80}$/.test(value);
export const validSession = value => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);
export const validPairing = value => typeof value === "string" && /^archives-[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value);

export function randomHex(size) {
  return Array.from(crypto.getRandomValues(new Uint8Array(size)), n => n.toString(16).padStart(2, "0")).join("");
}

export function readLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function owlRoomUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); }
  catch { throw Error("Colle l’adresse complète de ta salle Owlbear."); }
  if (!owlOrigins.has(url.origin) || url.username || url.password || (url.pathname === "/" && !url.search))
    throw Error("Colle l’adresse complète de ta salle Owlbear.");
  return url.href;
}

export function trustedOwlbearSdk() {
  if (window.parent === window) return false;
  try {
    const ref = new URLSearchParams(location.search).get("obrref");
    const [origin, id] = atob(ref.replace(/-/g, "+").replace(/_/g, "/")).split(" ");
    return owlOrigins.has(origin) && validRoomId(id);
  } catch { return false; }
}

export function localWire(port) {
  return {
    send: data => port.postMessage(data),
    onMessage: handler => { port.onmessage = event => handler(event.data); },
    onClose: handler => { port.onmessageerror = handler; port.addEventListener("close", handler); },
    close: () => port.close()
  };
}

export function createNotice() {
  const panel = document.createElement("section");
  panel.className = "archives-bridge-notice";
  panel.hidden = true;
  const text = document.createElement("p");
  text.setAttribute("role", "status");
  const action = document.createElement("button");
  const secondary = document.createElement("button");
  action.type = "button";
  secondary.type = "button";
  panel.tabIndex = -1;
  panel.append(text, action, secondary);
  document.body.append(panel);
  window.addEventListener("keydown", event => {
    if (!panel.hidden && !panel.contains(event.target) &&
      !event.target.closest?.('#canvas-integrations-dock .canvas-integration-item:first-child,.studio-screen-choice,.soundshow-view,.soundshow-receive')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  return {
    show(message, label, callback, secondaryLabel, secondaryCallback) {
      text.textContent = message;
      action.hidden = !label;
      action.textContent = label || "";
      action.onclick = callback || null;
      secondary.hidden = !secondaryLabel;
      secondary.textContent = secondaryLabel || "";
      secondary.onclick = secondaryCallback || null;
      panel.hidden = false;
      if (document.hasFocus() && !panel.contains(document.activeElement)) panel.focus();
    },
    hide() { panel.hidden = true; }
  };
}
