import { requireEditor,libraryRequest } from "./request.mjs";
import { maxMediaBytes } from "./files.mjs";
const $ = id => document.getElementById(id);
const labels = {DOCUMENT:"Document",AUDIO:"Audio",VIDEO:"Vidéo"};
let active;
const sizeText = size => size < 1024 * 1024 ? Math.ceil(size / 1024) + " Ko" : (size / 1024 / 1024).toLocaleString("fr",{maximumFractionDigits:1}) + " Mo";
function notify(text) {
  let status = $("archives-files-notice");
  if (!status) {
    status = document.createElement("p");status.id = "archives-files-notice";status.setAttribute("role","status");
    status.style.cssText = "position:fixed;bottom:18px;right:18px;z-index:50000;padding:14px;max-width:min(460px,90vw);background:#241a2d;color:#ffedc8;border:1px solid #bba05f;border-radius:9px";document.body.append(status);
  }
  status.textContent = text;status.hidden = false;clearTimeout(notify.timer);notify.timer = setTimeout(() => { status.hidden = true; },12000);
}
export async function openLibrary(context = {}) {
  try { requireEditor(); }
  catch (error) { notify(error.message);return; }
  active?.close();
  document.querySelectorAll('#archives-file-library:not([open])').forEach(old => old.remove());
  const dialog = document.createElement("dialog");dialog.id = "archives-file-library";
  dialog.innerHTML = `<style>
  #archives-file-library{box-sizing:border-box;color-scheme:dark;width:min(1050px,96vw);height:min(900px,92dvh);padding:20px;border:1px solid #bda05d;border-radius:14px;background:#17111e;color:#f1e5cf;font:15px/1.45 system-ui,sans-serif;overflow:auto}
  #archives-file-library::backdrop{background:#000b}#archives-file-library *{box-sizing:border-box}#archives-file-library [hidden]{display:none!important}
  #archives-file-library header,#archives-file-library .tools,#archives-file-library .actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#archives-file-library header h2{flex:1;margin:0;font-size:22px}
  #archives-file-library button,#archives-file-library input:not([type=checkbox]),#archives-file-library select,#archives-file-library summary{font:inherit;min-height:42px;border:1px solid #82704e;border-radius:8px;background:#281e31;color:inherit;padding:9px 12px}
  #archives-file-library button,#archives-file-library summary{cursor:pointer}#archives-file-library button:disabled{opacity:.5;cursor:wait}#archives-file-library .primary{background:#624d26;color:#ffedbd;border-color:#c4a461}
  #archives-file-library :focus-visible{outline:2px solid #e4c176;outline-offset:3px}#archives-file-library p{color:#cdbd9f}#archives-file-library .hint{font-size:13px}
  #archives-file-library .tools{margin:16px 0}#archives-file-library .tools select{width:auto;max-width:210px}#archives-file-library [data-search]{width:auto;flex:1;min-width:150px}#archives-file-library [data-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:12px}
  #archives-file-library article{background:#211827;border:1px solid #625135;border-radius:10px;padding:15px;min-width:0;display:flex;flex-direction:column;gap:10px}#archives-file-library h3{margin:0;font-size:17px;overflow-wrap:anywhere}
  #archives-file-library article p{font-size:13px;margin:0}#archives-file-library article button{width:100%}#archives-file-library article details{margin-top:auto}#archives-file-library details button,#archives-file-library details input{margin-top:8px}
  #archives-file-library [data-preview] label{display:block;margin:15px 0}#archives-file-library [data-title]{display:block;width:100%;margin-top:5px}#archives-file-library input[type=checkbox]{width:21px;height:21px;vertical-align:middle;margin:0 8px 0 0}
  #archives-file-library audio,#archives-file-library video{display:block;width:100%;max-height:48dvh;margin:18px auto;background:#08050b;border-radius:8px}#archives-file-library .status{white-space:pre-wrap}
  @media(max-width:600px){#archives-file-library{padding:13px;width:98vw;height:94dvh}#archives-file-library [data-grid]{grid-template-columns:1fr}#archives-file-library .tools>*{flex:1}#archives-file-library header h2{font-size:20px}}
  </style><header><h2>Documents et autres</h2><button type="button" data-close aria-label="Fermer la bibliothèque de documents">✕</button></header>
  <p class="hint">Tes fichiers restent privés jusqu’à ta révélation. Ils sont enregistrés sur cet appareil, pour cette salle et ton compte MJ. Conserve tes originaux.</p>
  <section data-library><p data-cell hidden></p><div class="tools"><button data-import class="primary" type="button">＋ Ajouter des fichiers</button><select data-kind aria-label="Type de fichier"><option value="">Tous les fichiers</option><option value="DOCUMENT">Documents</option><option value="AUDIO">Audios</option><option value="VIDEO">Vidéos</option></select><input data-search type="search" placeholder="Rechercher un fichier…" aria-label="Rechercher un fichier"><button data-all type="button" hidden>Voir toute la bibliothèque</button></div>
  <input data-input type="file" multiple hidden accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.ogv,application/pdf,text/plain,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,video/webm,video/ogg">
  <p class="hint">Documents : 25 Mo maximum. Sons et vidéos : 8 Mo maximum par fichier, pour une présentation dans la salle Owlbear.</p><div data-grid></div></section>
  <section data-preview hidden><button data-back type="button">← Bibliothèque</button><h3 data-preview-name></h3><div data-player></div><label>Nom montré aux joueurs<input data-title maxlength="120"></label><label><input data-reveal type="checkbox">Révéler aux joueurs maintenant</label><p class="hint">Le fichier entier et ce nom seront partagés. Les joueurs lancent la lecture sur leur appareil.</p><div class="actions"><button data-present type="button" class="primary">Garder privé</button></div></section>
  <p class="status" data-status role="status" aria-live="polite">Ouverture de ta bibliothèque…</p>`;
  document.body.append(dialog);dialog.showModal();active = dialog;
  const ui = key => dialog.querySelector("[data-" + key + "]");
  let entries = [],onlyLinked = !!context.cellKey,busy = false,media,objectUrl;
  function status(text) { if (dialog.open) ui("status").textContent = text; }
  function setBusy(value) {
    busy = value;dialog.querySelectorAll("button,input,select").forEach(el => { el.disabled = value; });
  }
  function releaseMedia() {
    media?.pause();media?.removeAttribute("src");media?.load();media = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);objectUrl = null;ui("player").replaceChildren();
  }
  dialog.addEventListener("cancel",event => { if (busy) event.preventDefault(); });
  dialog.addEventListener("close",() => { releaseMedia();if (!window.ArchivesAppearance?.retire(dialog)) dialog.remove();if (active === dialog) active = null; },{once:true});
  ui("close").onclick = () => { if (!busy) dialog.close(); };
  if (context.cellKey) {
    ui("cell").hidden = false;ui("cell").textContent = "Documents liés à « " + (context.title || "cette cellule") + " »";ui("all").hidden = false;
    ui("all").onclick = () => { onlyLinked = !onlyLinked;render(); };
  }
  async function refresh(message) {
    const result = await libraryRequest({action:"list"});
    if (!dialog.open) return;entries = result.entries;render();
    status(message || (entries.length ? "Choisis un fichier pour le préparer ou le présenter." : "Ajoute un fichier. Il restera privé jusqu’à ta révélation."));
  }
  async function perform(command,message) {
    setBusy(true);
    try { await libraryRequest(command);await refresh(message); }
    catch (error) { status(error.message); }
    finally { setBusy(false); }
  }
  async function read(entry) {
    const result = await libraryRequest({action:"get",fileId:entry.id});
    if (!(result.blob instanceof Blob)) throw Error("Ce fichier ne peut pas être lu.");
    return new File([result.blob],result.entry.name,{type:result.entry.mime,lastModified:result.entry.created});
  }
  async function preview(entry) {
    // Clear the previous opt-in before loading another file asynchronously.
    ui('reveal').checked = false;ui('present').onclick = null;
    setBusy(true);status("Ouverture de « " + entry.title + " »…");
    try {
      const file = await read(entry);if (!dialog.open) return;
      if (entry.kind === "DOCUMENT") {
        dialog.close();await window.ArchivesCellTransfer.sendLibraryFile({id:entry.id,file,title:entry.title});return;
      }
      releaseMedia();ui("library").hidden = true;ui("preview").hidden = false;
      ui("preview-name").textContent = "Aperçu privé — " + entry.title;ui("title").value = entry.title;
      const keepLabel = entry.presented ? "Arrêter la présentation" : entry.released ? "Ne pas présenter" : "Garder privé";
      ui("reveal").checked = false;ui("present").textContent = keepLabel;
      ui("reveal").onchange = () => { ui("present").textContent = ui("reveal").checked ? "Présenter aux joueurs" : keepLabel; };
      media = document.createElement(entry.kind === "AUDIO" ? "audio" : "video");
      media.controls = true;media.preload = "metadata";media.playsInline = true;media.volume = 0.65;
      media.setAttribute("aria-label","Aperçu privé de " + entry.title);objectUrl = URL.createObjectURL(file);media.src = objectUrl;ui("player").append(media);
      media.addEventListener("error",() => status("Ce navigateur ne peut pas lire ce fichier. Utilise de préférence un MP3 ou un MP4 compatible."));
      status(entry.presented ? "Ce média est en cours de présentation. Tu peux arrêter la présentation ou le présenter à nouveau." :
        entry.released ? "Aperçu local d’un média déjà révélé. Rien de plus n’est envoyé sans nouvelle présentation." :
        "Aperçu privé. Rien n’est envoyé aux joueurs tant que tu ne choisis pas de révéler.");
      ui("present").onclick = async () => {
        if (!ui("reveal").checked) {
          setBusy(true);
          try {
            await libraryRequest({action:"stop",fileId:entry.id});
            releaseMedia();ui("preview").hidden = true;ui("library").hidden = false;
            await refresh(entry.presented ? "Présentation arrêtée. Les joueurs peuvent conserver ce qu’ils ont déjà reçu." :
              entry.released ? "Aucune nouvelle présentation. Ce média a déjà été révélé auparavant." : "Fichier conservé privé. Aucun envoi aux joueurs.");
          } catch (error) { status(error.message); }
          finally { setBusy(false); }
          return;
        }
        if (file.size > maxMediaBytes) { status("Prépare un extrait de moins de 8 Mo.");return; }
        setBusy(true);status("Présentation aux joueurs…");
        try {
          await libraryRequest({action:"present",fileId:entry.id,title:ui("title").value});
          releaseMedia();ui("preview").hidden = true;ui("library").hidden = false;
          await refresh("Présentation envoyée. Les joueurs disposent d’un lecteur dans Owlbear et cliquent sur Lire.");
        } catch (error) { status(error.message); }
        finally { setBusy(false); }
      };
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  }
  ui("back").onclick = () => { releaseMedia();ui("preview").hidden = true;ui("library").hidden = false;status("Les fichiers non présentés restent privés."); };
  function button(text,handler) {
    const el = document.createElement("button");el.type = "button";el.textContent = text;el.onclick = handler;return el;
  }
  function render() {
    if (!dialog.open) return;
    const query = ui("search").value.toLocaleLowerCase("fr"),kind = ui("kind").value;
    const filtered = entries.filter(entry => (!kind || entry.kind === kind) && entry.title.toLocaleLowerCase("fr").includes(query) &&
      (!onlyLinked || entry.links.includes(context.cellKey))).sort((a,b) => a.title.localeCompare(b.title,"fr"));
    if (context.cellKey) ui("all").textContent = onlyLinked ? "Voir toute la bibliothèque" : "Voir seulement les documents liés";
    ui("grid").replaceChildren();
    if (!filtered.length) { const empty = document.createElement("p");empty.textContent = onlyLinked ? "Aucun document lié. Ajoute un fichier ou choisis-le dans la bibliothèque." : "Aucun fichier pour cette recherche.";ui("grid").append(empty); }
    for (const entry of filtered) {
      const card = document.createElement("article");card.dataset.fileId = entry.id;
      const title = document.createElement("h3");title.textContent = entry.title;
      const info = document.createElement("p");info.textContent = labels[entry.kind] + " · " + sizeText(entry.size) + " · " + (entry.presented ? "présenté aux joueurs" : entry.released ? "présentation arrêtée" : entry.kind === "DOCUMENT" ? "original côté MJ" : "privé");
      const action = button(entry.kind === "DOCUMENT" ? "Aperçu et transfert…" : "Aperçu et présentation…",() => { void preview(entry); });action.className = "primary";
      card.append(title,info,action);
      if (context.cellKey && !entry.links.includes(context.cellKey)) card.append(button("Lier à cette cellule",() => { void perform({action:"link",fileId:entry.id,cellKey:context.cellKey},"Document lié à la cellule."); }));
      if (entry.presented) card.append(button("Arrêter la présentation",() => { void perform({action:"stop",fileId:entry.id},"Présentation arrêtée. Ce qui a déjà été reçu peut être conservé par les joueurs."); }));
      const options = document.createElement("details"),summary = document.createElement("summary");summary.textContent = "Options";options.append(summary);
      const rename = document.createElement("input");rename.type = "text";rename.maxLength = 120;rename.value = entry.title;rename.setAttribute("aria-label","Nouveau nom de " + entry.title);options.append(rename);
      options.append(button("Renommer",() => { void perform({action:"rename",fileId:entry.id,title:rename.value},"Nom modifié dans la bibliothèque."); }));
      options.append(button("Enregistrer l’original",async () => {
        setBusy(true);
        try {
          const file = await read(entry),url = URL.createObjectURL(file),link = document.createElement("a");
          link.href = url;link.download = entry.name;document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),10000);status("Téléchargement de l’original demandé.");
        } catch (error) { status(error.message); }
        finally { setBusy(false); }
      }));
      if (context.cellKey && entry.links.includes(context.cellKey)) options.append(button("Délier de cette cellule",() => { void perform({action:"link",fileId:entry.id,cellKey:context.cellKey,remove:true},"Lien retiré. Le fichier reste dans la bibliothèque."); }));
      options.append(button("Supprimer de la bibliothèque",() => {
        if (window.confirm("Supprimer « " + entry.title + " » de cette bibliothèque ? Ton fichier d’origine sur ton ordinateur reste intact."))
          void perform({action:"remove",fileId:entry.id},"Fichier retiré de la bibliothèque.");
      }));
      card.append(options);ui("grid").append(card);
    }
  }
  ui("import").onclick = () => ui("input").click();
  ui("input").onchange = async () => {
    const files = Array.from(ui("input").files || []);ui("input").value = "";if (!files.length) return;
    setBusy(true);let count = 0;const errors = [];
    for (const file of files) {
      status("Ajout privé : " + file.name + "…");
      try { await libraryRequest({action:"import",file,name:file.name,cellKey:context.cellKey || ""});count++; }
      catch (error) { errors.push(file.name + " : " + error.message); }
    }
    try { await refresh(count + " fichier(s) enregistré(s), sans envoi aux joueurs." + (errors.length ? "\n" + errors.join("\n") : "")); }
    catch (error) { status(error.message); }
    finally { setBusy(false); }
  };
  ui("kind").onchange = render;ui("search").oninput = render;
  setBusy(true);
  try { await refresh(); }
  catch (error) { status(error.message); }
  finally { setBusy(false); }
}
function selectedContext() {
  const state = requireEditor(),node = (state.nodes || []).find(node => node.id === state.selectedId);
  if (!node) throw Error("Sélectionne une cellule pour lui joindre un document.");
  return {cellKey:"cell:" + state.activeBoardId + ":" + node.id,title:node.title};
}
function openCell() {
  try { return openLibrary(selectedContext()); }
  catch (error) { notify(error.message);return Promise.resolve(); }
}
function install() {
  const params = new URLSearchParams(location.search);
  if (params.get("owl-editor") !== "1" || params.has("ro")) return;
  try { requireEditor(); } catch { return; }
  const catalogue = $("archives-catalogue-modal")?.querySelector(".catalogue-tabs");
  if (catalogue && !$("catalogue-documents")) {
    const button = document.createElement("button");button.type = "button";button.id = "catalogue-documents";button.className = "catalogue-tab";
    button.textContent = "Documents et autres";button.onclick = () => { window.ArchivesCatalogue.close();void openLibrary(); };catalogue.append(button);
  }
  const context = $("ctx-send-to-owlbear");
  if (context && !$("ctx-cell-files")) {
    const button = document.createElement("button");button.type = "button";button.id = "ctx-cell-files";button.className = "ctx-item";
    button.style.cssText = context.style.cssText;button.textContent = "Documents liés…";
    button.onclick = () => { window.DuneApp.closeContextMenus();void openCell(); };context.after(button);
  }
  const transfer = $("archives-v45-transfer-button");
  if (transfer && !$("archives-cell-files")) {
    const button = document.createElement("button");button.type = "button";button.id = "archives-cell-files";button.className = "btn";
    button.textContent = "Documents liés…";button.onclick = () => { void openCell(); };transfer.after(button);
  }
}
if (new URLSearchParams(location.search).get("owl-editor") === "1") window.ArchivesFileLibrary = {open:openLibrary,openCell};
install();
