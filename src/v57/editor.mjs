import { createNotice, editEvent, isPacket, packet } from "../v56/link.mjs?v=4460";
import { installOwlPlayerInterface, installOwlSettings } from "../v59/settings.mjs?v=4210";
import { installPlayerNotebook } from '../v64/player-notebook.mjs?v=4210';
import {installScreenControls} from '../v65/screens.mjs?v=4210';

export function installOwlEditor(api) {
  installScreenControls();
  installOwlSettings();
  const notice = createNotice();
  const parent = window.parent;
  let ready = false, dirty = false, saveTimer, latest, returning = false, finalId,restoring = false;
  const post = (type, fields) => parent.postMessage(packet(type, fields), location.origin);
  function save(final = false) {
    if (!ready || restoring) return;
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
      "Nouveau scénario", () => { notice.hide(); window.DuneApp.startNewScenario(false); },
      "Sauvegardes en ligne", () => {
        void import('../v63/backup-ui.mjs?v=4460').then(module => { notice.hide();module.openBackup(); })
          .catch(error => notice.show(error.message));
      });
  }
  window.addEventListener(editEvent, () => {
    if (!ready || restoring) return;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 160);
  });
  window.addEventListener('archives:restore-begin',() => { restoring = true;clearTimeout(saveTimer);saveTimer = null; });
  window.addEventListener('archives:restore-end',event => {
    restoring = false;
    if (!event.detail?.safe && dirty) saveTimer = setTimeout(save,160);
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
      if(ready){window.ArchivesCampaignScope=data.scope;window.dispatchEvent(new CustomEvent('archives:campaign-context',{detail:data.scope}));}
    } else if (data.type === "return") {
      if (!ready) { post("return-result", {safe:true}); return; }
      returning = true;
      if (dirty) notice.show("Enregistrement du scénario…");
      save(true);
    } else if (data.type === "owl-editor-roster" && ready && Array.isArray(data.players)) {
      api.setOwlPlayers(data.players);
      window.dispatchEvent(new CustomEvent('archives:roster',{detail:data.players}));
    } else if (data.type === 'owl-campaign-restored' && ready) {
      clearTimeout(saveTimer);saveTimer = null;latest = finalId = null;dirty = returning = false;
      api.apply(data.snapshot);post('owl-editor-published',{payload:api.publicView()});
      window.dispatchEvent(new CustomEvent('archives:campaign-restored'));
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
  installScreenControls();
  installOwlPlayerInterface();
  installPlayerNotebook();
  const notice = createNotice();
  const parent = window.parent;
  const post = type => parent.postMessage(packet(type), location.origin);
  let received = false;
  const retry = () => post("owl-player-retry");
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== location.origin || !isPacket(event.data)) return;
    const data = event.data;
    if (data.type === 'owl-player-identity') {
      api.setPlayerScope(data.scope);
    } else if (data.type === "owl-player-snapshot") {
      try { api.apply(data.snapshot); received = true; notice.hide();window.dispatchEvent(new CustomEvent('archives:public-view')); }
      catch { if (!received) notice.show("La vue joueur n’a pas pu s’afficher.", "Réessayer", retry); }
    } else if (!received && data.type === "owl-player-status") {
      notice.show(data.message, "Réessayer", retry);
    }
  });
  notice.show("Chargement des éléments révélés…");
  post("owl-player-ready");
}
