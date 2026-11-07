// The Owlbear host supplies the role and private data; these controls clarify the UI.
const $ = id => document.getElementById(id);
const ready = callback => document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", callback, {once:true}) : callback();

function returnButton() {
  const button = $("archives-home-fab");
  if (!button) return;
  button.textContent = "←";
  button.title = "Retour à Owlbear";
  button.setAttribute("aria-label", "Retour à Owlbear");
}

export function installOwlPlayerInterface() {
  ready(() => {
    // Cloud initialisation is separately blocked before reading any session.
    for (const id of ["archives-title-screen", "archives-gm-choice-modal", "archives-home-confirm",
      "archives-cloud-panel", "accounts-campaigns-setting", "settings-modal", "settings-fab"]) $(id)?.remove();
    returnButton();
  });
}

export function installOwlSettings() {
  ready(() => {
    const content = $("settings-content");
    if (!content || content.dataset.owlSimple) return;
    content.dataset.owlSimple = "1";
    returnButton();
    const style = document.createElement("style");
    style.textContent = [
      "#settings-content[data-owl-simple]{display:flex;flex-direction:column;gap:12px}",
      ".owl-settings-section{border:1px solid var(--skin-gold-dim);border-radius:10px;padding:12px}",
      ".owl-settings-section>summary{cursor:pointer;font-weight:700;color:var(--skin-gold-bright);padding:3px}",
      ".owl-settings-body{display:flex;flex-direction:column;gap:12px;padding-top:12px}",
      ".owl-settings-body>.pinnable-block{margin:0!important}",
      ".owl-settings-body .pin-btn{display:none}",
      ".owl-settings-note{margin:0;color:var(--skin-text-muted);font-size:13px;line-height:1.5}"
    ].join("\n");
    document.head.append(style);
    function section(label, id, open = false) {
      const details = document.createElement("details");
      details.className = "owl-settings-section";
      details.id = id;
      details.open = open;
      const summary = document.createElement("summary");
      summary.textContent = label;
      const body = document.createElement("div");
      body.className = "owl-settings-body";
      details.append(summary, body);
      content.append(details);
      return body;
    }
    function note(parent, text) {
      const p = document.createElement("p");
      p.className = "owl-settings-note";
      p.textContent = text;
      parent.append(p);
    }
    const original = Array.from(content.children);
    const appearance = section("Apparence", "owl-settings-appearance", true);
    const sounds = section("Sons", "owl-settings-sounds");
    const backups = section("Sauvegardes", "owl-settings-backups");
    const advanced = section("Options avancées", "owl-settings-advanced");
    const font = $("v18-font-target")?.closest("section");
    if (font) appearance.append(font);
    const fx = $("settings-fx-toggle")?.closest(".settings-toggle-row");
    if (fx) appearance.append(fx);
    const universe = content.querySelector(".universe-bar");
    if (universe) appearance.append(universe);
    const media = $("pin-block-canvas-bg");
    if (media) {
      for (const child of Array.from(media.children)) {
        if (child.classList.contains("pinnable-header")) continue;
        (child.querySelector("#up-bg,#inp-canvas-bg-op") ? appearance : sounds).append(child);
      }
      media.remove();
    }
    note(backups, "L’enregistrement est automatique sur cet appareil. Télécharge une copie pour conserver ton scénario ou changer d’appareil.");
    const session = $("pin-block-session");
    if (session) {
      const save = session.querySelector('[onclick="DuneApp.exportJson()"]');
      const full = save?.closest(".field-row");
      if (full) {
        save.textContent = "Sauvegarder le scénario";
        const label = full.querySelector('label[for="up-json"]');
        if (label) label.textContent = "Charger un scénario";
        backups.append(full);
      }
      for (const row of Array.from(session.querySelectorAll(".field-row"))) {
        if (row.querySelector("[data-live-standalone],#btn-live-panel") ||
          row.querySelector('[onclick="DuneApp.downloadReadOnlyPlayerHtml()"]')) continue;
        advanced.append(row);
      }
      session.remove();
    }
    const account = $("accounts-campaigns-setting");
    if (account) {
      const description = account.querySelector("p");
      if (description) description.textContent = "Accès à tes anciennes campagnes cloud. Inutile pour connecter les joueurs dans Owlbear.";
      advanced.append(account);
    }
    const images = $("pin-block-webimg");
    if (images) advanced.append(images);
    for (const child of original) {
      if (child.parentNode !== content) continue;
      if (child.id === "program-update-panel" || child.classList.contains("settings-note")) child.remove();
      else advanced.append(child);
    }
    note(advanced, "Les joueurs rejoignent la salle Owlbear avec ton accord. Leur vue contient uniquement les éléments révélés.");
  });
}
