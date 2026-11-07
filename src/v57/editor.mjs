import { createNotice, editEvent, isPacket, packet } from "../v56/link.mjs";
import { installOwlPlayerInterface, installOwlSettings } from "../v59/settings.mjs?v=4161";

export function installOwlEditor(api) {
  installOwlSettings();
  const notice = createNotice();
  const parent = window.parent;
  let ready = false, dirty = false, saveTimer, latest, returning = false, finalId;
  const post = (type, fields) => parent.postMessage(packet(type, fields), location.origin);
  function save(final = false) {
    if (!ready) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (final && !dirty) { returning = false; post("return-result", {safe:true}); return; }
    const id = crypto.randomUUID();
    latest = id;
    if (final) finalId = id;
    post("owl-editor-save", {id, snapshot:api.current() || api.snapshot(), publicView:api.publicView()});
  }
  function firstOpen() {
    const board = {id:crypto.randomUUID(), name:"Acte I", nodes:[], links:[]};
    api.apply({boards:[board], activeBoardId:board.id, journalPages:[], playerLayout:{}, bgImage:""});
    notice.show("Ouvre une campagne existante ou commence un nouveau scénario.",
      "Importer un scénario", () => { notice.hide(); document.getElementById("up-json").click(); },
      "Nouveau scénario", () => { notice.hide(); window.DuneApp.startNewScenario(false); });
  }
  window.addEventListener(editEvent, () => {
    if (!ready) return;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 160);
  });
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== location.origin || !isPacket(event.data)) return;
    const data = event.data;
    if (data.type === "owl-editor-init" && !ready) {
      ready = true;
      notice.hide();
      try {
        if (!data.snapshot) firstOpen();
        else {
          api.apply(data.snapshot);
          post("owl-editor-published", {payload:api.publicView()});
        }
      } catch {
        ready = false;
        notice.show("Impossible de lire ce scénario. Retourne à Owlbear puis rouvre les Archives.");
      }
    } else if (data.type === "return") {
      if (!ready) { post("return-result", {safe:true}); return; }
      returning = true;
      if (dirty) notice.show("Enregistrement du scénario…");
      save(true);
    } else if (data.type === "owl-editor-roster" && ready && Array.isArray(data.players)) {
      api.setOwlPlayers(data.players);
    } else if (data.type === "owl-editor-saved" && data.id === latest) {
      if (data.safe) {
        if (!saveTimer) dirty = false;
        notice.hide();
        if (returning && data.id === finalId) {
          returning = false;
          post("return-result", {safe:!dirty});
        }
      } else {
        returning = false;
        notice.show(data.message || "Sauvegarde impossible. Garde les Archives ouvertes.",
          "Télécharger une copie", () => window.DuneApp.exportJson(),
          "Réessayer la sauvegarde", () => save());
        post("return-result", {safe:false});
      }
    }
  });
  notice.show("Ouverture des Archives…");
  post("owl-editor-ready");
}

export function installOwlPlayer(api) {
  installOwlPlayerInterface();
  const notice = createNotice();
  const parent = window.parent;
  const post = type => parent.postMessage(packet(type), location.origin);
  let received = false;
  const retry = () => post("owl-player-retry");
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== location.origin || !isPacket(event.data)) return;
    const data = event.data;
    if (data.type === "owl-player-snapshot") {
      try { api.apply(data.snapshot); received = true; notice.hide(); }
      catch { if (!received) notice.show("La vue joueur n’a pas pu s’afficher.", "Réessayer", retry); }
    } else if (!received && data.type === "owl-player-status") {
      notice.show(data.message, "Réessayer", retry);
    }
  });
  notice.show("Chargement des éléments révélés…");
  post("owl-player-ready");
}
