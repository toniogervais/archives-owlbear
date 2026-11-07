import { isPacket, packet } from "../v56/link.mjs";
import { prepareSource,renderSource,sourcePicture } from "./media.mjs?v=4210";
import { installCropEditor } from "../v61/token-crop.mjs";

const pending = new Map();
const $ = id => document.getElementById(id);
let activeDialog;
const directTransfers = new Set();
function gmState() {
  const state = window.DuneApp?.getState?.();
  if (!state || state.playerMode || state.strictReadOnly) throw Error("Le transfert est réservé au MJ.");
  return state;
}
function request(command,report) {
  gmState();
  const params = new URLSearchParams(location.search);
  if (window.parent === window || !params.has("owl-editor"))
    throw Error("Dans ta salle Owlbear, clique sur le livre pour ouvrir les Archives, puis effectue ce transfert.");
  const id = crypto.randomUUID();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { pending.delete(id);reject(Error("Le transfert n’a pas été confirmé. Vérifie la scène avant de réessayer.")); },180000);
    pending.set(id,{resolve,reject,timer,report});
    window.parent.postMessage(packet("owl-transfer-command",{id,command}),location.origin);
  });
}
window.addEventListener("message",event => {
  if (event.source !== window.parent || event.origin !== location.origin || !isPacket(event.data) ||
      !["owl-transfer-result","owl-transfer-progress"].includes(event.data.type)) return;
  const entry = pending.get(event.data.id);
  if (!entry) return;
  if (event.data.type === "owl-transfer-progress") { entry.report?.(String(event.data.message || ""));return; }
  pending.delete(event.data.id);clearTimeout(entry.timer);
  if (event.data.safe) entry.resolve(event.data.result);
  else entry.reject(Error(event.data.message || "Le transfert n’a pas abouti."));
});
function notify(message) {
  let el = $("archives-v55-transfer-status");
  if (!el) {
    el = document.createElement("div");el.id = "archives-v55-transfer-status";el.setAttribute("role","status");
    el.style.cssText = "position:fixed;right:16px;bottom:18px;z-index:50000;max-width:min(420px,90vw);padding:14px;background:#261f31;color:#ffe9ac;border:1px solid #b59b5b;border-radius:8px";
    document.body.append(el);
  }
  el.textContent = message;el.hidden = false;
  clearTimeout(notify.timer);notify.timer = setTimeout(() => { el.hidden = true; },14000);
}
function buildDialog() {
  activeDialog?.close();
  document.querySelectorAll('#archives-owl-transfer:not([open])').forEach(old => old.remove());
  const dialog = document.createElement("dialog");dialog.id = "archives-owl-transfer";
  dialog.innerHTML = `<style>
  #archives-owl-transfer{color-scheme:dark;box-sizing:border-box;width:min(880px,96vw);max-height:94dvh;overflow:auto;margin:auto;padding:20px;border:1px solid #b99b60;border-radius:14px;background:#19131f;color:#f3e6cb;font:15px/1.45 system-ui,sans-serif}
  #archives-owl-transfer::backdrop{background:rgba(0,0,0,.75)}
  #archives-owl-transfer *{box-sizing:border-box}#archives-owl-transfer [hidden]{display:none!important}
  #archives-owl-transfer header{display:flex;gap:10px;align-items:center;justify-content:space-between}#archives-owl-transfer h2{font-size:20px;margin:0}
  #archives-owl-transfer button,#archives-owl-transfer select,#archives-owl-transfer input:not([type=checkbox]),#archives-owl-transfer textarea{font:inherit;min-height:42px;padding:9px;border:1px solid #897149;border-radius:7px;background:#271e30;color:inherit}
  #archives-owl-transfer button{cursor:pointer}#archives-owl-transfer button:disabled{opacity:.5;cursor:wait}
  #archives-owl-transfer button.primary{background:#695127;color:#fff3cb;font-weight:700}#archives-owl-transfer button:focus-visible,#archives-owl-transfer input:focus-visible,#archives-owl-transfer select:focus-visible,#archives-owl-transfer textarea:focus-visible{outline:2px solid #e8c575;outline-offset:2px}
  #archives-owl-transfer .fields label{display:block;margin:12px 0}#archives-owl-transfer .fields input:not([type=checkbox]),#archives-owl-transfer select,#archives-owl-transfer textarea{display:block;width:100%;margin-top:5px}
  #archives-owl-transfer input[type=checkbox]{width:20px;height:20px;vertical-align:middle;margin:0 7px 0 0}
  #archives-owl-transfer .layout{display:grid;grid-template-columns:minmax(220px,1fr) minmax(230px,1fr);gap:20px;margin-top:12px}
  #archives-owl-transfer figure{position:relative;margin:0;background:#0d0a11;border:1px solid #514334;border-radius:9px;display:grid;place-items:center;min-height:260px;max-height:46dvh;overflow:auto;padding:12px}
  #archives-owl-transfer [data-preview-status]{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:#0d0a11e8;text-align:center}
  #archives-owl-transfer img{display:block;max-width:100%;max-height:50dvh;object-fit:contain}
  #archives-owl-transfer [data-crop-stage]{position:relative;width:min(320px,100%,36dvh);aspect-ratio:1}
  #archives-owl-transfer [data-crop]{display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:3px}
  #archives-owl-transfer [data-crop].dragging{cursor:grabbing}
  #archives-owl-transfer [data-crop]:focus-visible{outline:2px solid #e8c575}
  #archives-owl-transfer [data-crop-tools]{margin-top:10px}
  #archives-owl-transfer .zoom-row{display:flex;gap:10px;align-items:center}
  #archives-owl-transfer [data-zoom]{flex:1;min-width:0;padding:0;accent-color:#d2b273;min-height:36px;border:0;background:transparent}
  #archives-owl-transfer [data-zoom-value]{min-width:54px;text-align:right}
  #archives-owl-transfer .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}#archives-owl-transfer .hint{color:#d7c5a7;font-size:13px}
  #archives-owl-transfer .record{border-top:1px solid #59452e;padding:12px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}#archives-owl-transfer .record span{flex:1;min-width:150px}#archives-owl-transfer .status{white-space:pre-wrap}
  @media(max-width:620px){#archives-owl-transfer{padding:13px}.layout{display:block!important}#archives-owl-transfer figure{min-height:150px;max-height:35dvh}#archives-owl-transfer img{max-height:30dvh}#archives-owl-transfer [data-crop-stage]{width:min(280px,100%,27dvh)}}
  </style><header><h2 data-heading>Transfert vers Owlbear</h2><button type="button" data-close aria-label="Fermer le transfert">✕</button></header>
  <p class="hint">Un élément caché reste réservé au MJ. Révéler partage uniquement le rendu choisi et son nom.</p>
  <section data-edit hidden><div class="layout"><div class="fields">
    <label>Nom dans Owlbear<input data-title maxlength="120" required></label>
    <label>Format<select data-kind><option value="TOKEN">Token rond</option><option value="DOCUMENT">Document</option></select></label>
    <label data-page-label hidden>Page du PDF<input data-page type="number" min="1" value="1"></label>
    <div data-text-box hidden><label><input data-include type="checkbox">Ajouter ce texte au document</label><label>Texte à montrer<textarea data-text rows="5" maxlength="12000"></textarea></label></div>
    <p class="hint">« Placer caché » garde l’élément dans ta vue MJ. « Placer et révéler » le montre aux joueurs.</p>
    </div><div class="preview-column"><figure aria-label="Aperçu du rendu transféré"><img data-preview alt="Aperçu du document" hidden><div data-crop-stage hidden><canvas data-crop width="512" height="512" tabindex="0" role="img" aria-label="Image dans le token : glisser pour déplacer, zoomer ou dézoomer" aria-describedby="archives-crop-help"></canvas></div><span data-preview-status>Préparation de l’aperçu…</span></figure>
    <div data-crop-tools hidden><div class="zoom-row"><label for="archives-token-zoom">Zoom</label><input id="archives-token-zoom" data-zoom type="range" min="15" max="800" step="1" value="100"><output data-zoom-value for="archives-token-zoom">100 %</output></div><p id="archives-crop-help" class="hint">Glisse l’image dans le token. Zoome avec la molette, le curseur ou deux doigts.</p></div></div></div>
    <div class="actions"><button type="button" class="primary" data-submit disabled>Placer caché</button><button type="button" data-share disabled>Placer et révéler</button><button type="button" data-list>Éléments déjà transférés</button></div>
  </section>
  <section data-manager hidden><h3>Éléments de cette scène</h3><div data-records></div><div class="actions"><button type="button" data-file>Ajouter un fichier</button><button type="button" data-back hidden>Revenir à l’aperçu</button></div></section>
  <p class="status" data-status role="status" aria-live="polite">Connexion à la scène Owlbear…</p>`;
  document.body.append(dialog);dialog.showModal();activeDialog = dialog;
  const ui = selector => dialog.querySelector("[data-" + selector + "]");
  let busy = false, dispose = () => {},busyHook = () => {};
  const setBusy = value => {
    busy = value;
    dialog.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = value; });
    busyHook(value);
  };
  dialog.addEventListener("cancel",event => { if (busy) event.preventDefault(); });
  ui("close").onclick = () => { if (!busy) dialog.close(); };
  dialog.addEventListener("close",() => { dispose();if (!window.ArchivesAppearance?.retire(dialog)) dialog.remove();if (activeDialog === dialog) activeDialog = null; },{once:true});
  return {dialog,ui,setBusy,setDispose:fn => { dispose = fn; },setBusyHook:fn => { busyHook = fn; }};
}
async function manager(view,context,back) {
  const {ui,dialog,setBusy} = view;
  ui("edit").hidden = true;ui("manager").hidden = false;ui("back").hidden = !back;
  ui("back").onclick = () => { ui("manager").hidden = true;ui("edit").hidden = false;ui("status").textContent = "Vérifie l’aperçu, le format et la visibilité avant de transférer."; };
  ui("file").onclick = () => openFiles();
  try {
    setBusy(true);
    const result = await request({action:"list",scene:context.scene});
    ui("records").replaceChildren();
    if (!result.records.length) ui("records").textContent = "Aucun transfert dans cette scène pour le moment.";
    for (const record of result.records) {
      const row = document.createElement("div");row.className = "record";
      const label = document.createElement("span");label.textContent = record.title + " · " + (record.kind === "TOKEN" ? "token" : "document") + " · " + (record.revealed ? "révélé" : "caché");
      const toggle = document.createElement("button");toggle.type = "button";toggle.textContent = record.revealed ? "Cacher" : "Révéler";
      const remove = document.createElement("button");remove.type = "button";remove.textContent = "Retirer";
      const perform = async (action,reveal) => {
        setBusy(true);ui("status").textContent = "Mise à jour de la scène…";
        try {
          await request({action,scene:context.scene,assetId:record.id,reveal});
          if (!dialog.open) return;
          await manager(view,context,back);
          ui("status").textContent = action === "remove" ? "Élément retiré de la scène. Le fichier reste dans ta bibliothèque Owlbear." : reveal ? "Élément révélé aux joueurs." : "Élément caché. Les joueurs peuvent conserver une copie de ce qui a déjà été révélé.";
        } catch (error) { ui("status").textContent = error.message; }
        finally { setBusy(false); }
      };
      toggle.onclick = () => { void perform("visibility",!record.revealed); };
      remove.onclick = () => { void perform("remove"); };
      row.append(label,toggle,remove);ui("records").append(row);
    }
    ui("status").textContent = "Les fichiers non révélés restent réservés au MJ. Les révélations et retraits s’appliquent à la scène ouverte.";
  } catch (error) { ui("status").textContent = error.message; }
  finally { setBusy(false); }
}
async function showManager() {
  try {
    gmState();const context = await request({action:"context"});
    const view = buildDialog();await manager(view,context,false);
  } catch (error) { notify(error.message); }
}
async function openSource(input,report = notify) {
  let source,view,crop;
  try {
    gmState();const context = await request({action:"context",sourceKey:input.key});
    view = buildDialog();const {ui,dialog,setBusy} = view;
    setBusy(true);source = await prepareSource(input);
    if (!dialog.open) { source.release();return; }
    let rendering = Promise.resolve(),latest = 0,ready = false,working = false,renderError,lastInputSignature;
    const preset = context.preset?.identity === source.identity ? context.preset : null;
    let presetCrop = preset?.crop;
    crop = installCropEditor({canvas:ui("crop"),range:ui("zoom"),output:ui("zoom-value")});
    view.setDispose(() => { crop.dispose();source.release(); });
    view.setBusyHook(value => {
      working = value;crop.setDisabled(value);
      ui("submit").disabled = ui("share").disabled = value || !ready;
    });
    setBusy(false);ui("edit").hidden = false;ui("title").value = source.title;
    ui("kind").value = ["TOKEN","DOCUMENT"].includes(preset?.kind) ? preset.kind : source.kind || "DOCUMENT";
    ui("text").value = source.text;
    ui("include").checked = !source.bitmap && !source.pdf && !!source.text;
    if (source.pages) {
      ui("page-label").hidden = false;ui("page").max = source.pages;
      ui("page").value = Number.isInteger(preset?.page) && preset.page > 0 && preset.page <= source.pages ? preset.page : 1;
      ui("page-label").firstChild.textContent = "Page du PDF (1 à " + source.pages + ")";
    }
    function render() {
      const signature = JSON.stringify([ui("title").value,ui("kind").value,ui("text").value,ui("page").value,ui("include").checked]);
      if (signature === lastInputSignature) return rendering;
      lastInputSignature = signature;const version = ++latest;ready = false;
      ui("submit").disabled = ui("share").disabled = true;
      rendering = rendering.catch(() => {}).then(async () => {
        if (version !== latest || !dialog.open) return;
        ui("preview-status").hidden = false;ui("preview-status").textContent = "Préparation de l’aperçu…";
        try {
          const title = ui("title").value.trim(),token = ui("kind").value === "TOKEN",page = Number(ui("page").value);
          if (!title) throw Error("Donne un nom à cet élément.");
          if (source.pages && (!Number.isInteger(page) || page < 1 || page > source.pages)) throw Error("Choisis une page existante du PDF.");
          ui("heading").textContent = token ? "Préparer le token" : "Transférer un document";
          ui("text-box").hidden = !source.text || token;
          if (token) {
            const picture = await sourcePicture(source,page);
            if (version !== latest || !dialog.open) return;
            crop.setPicture(picture,title,presetCrop);presetCrop = null;
            ui("preview").hidden = true;ui("crop-stage").hidden = false;ui("crop-tools").hidden = !picture;
          } else {
            const art = await renderSource(source,{kind:"DOCUMENT",title,page,text:ui("text").value,includeText:ui("include").checked});
            if (version !== latest || !dialog.open) return;
            ui("preview").src = art.data;ui("preview").hidden = false;ui("crop-stage").hidden = true;ui("crop-tools").hidden = true;
          }
          renderError = null;ready = true;ui("preview-status").hidden = true;
          ui("status").textContent = token ? "Ajuste librement l’image dans le token, puis choisis de le placer caché ou de le révéler." : "Seuls le rendu de l’aperçu et son nom seront transférés.";
          ui("submit").disabled = ui("share").disabled = working;
        } catch (error) {
          if (version !== latest || !dialog.open) return;
          ready = false;renderError = error;ui("preview").hidden = true;ui("crop-stage").hidden = true;ui("crop-tools").hidden = true;
          ui("preview-status").textContent = error.message;ui("status").textContent = error.message;
        }
      });
      return rendering;
    }
    for (const field of ["title","kind","text","page","include"]) ui(field).addEventListener(["title","text","page"].includes(field) ? "input" : "change",() => { void render(); });
    ui("list").onclick = () => { void manager(view,context,true); };
    async function transfer(reveal) {
      await rendering;if (!ready || renderError || working) return;
      setBusy(true);ui("status").textContent = "Préparation du placement dans Owlbear…";
      try {
        const kind = ui("kind").value,title = ui("title").value.trim(),page = Number(ui("page").value);
        const framing = {identity:source.identity,crop:crop.getState(),page};
        const art = await renderSource(source,{kind,title,page,text:ui("text").value,includeText:ui("include").checked,crop:framing.crop});
        gmState();
        const result = await request({action:"transfer",scene:context.scene,sourceKey:source.key,kind,title,reveal,art,framing},message => {
          if (dialog.open) ui("status").textContent = message;
        });
        if (!dialog.open) return;
        const message = result.revealed ? "« " + result.title + " » placé et révélé dans Owlbear." : "« " + result.title + " » placé dans ta vue MJ, caché aux joueurs.";
        dialog.close();report(message);
      } catch (error) { if (dialog.open) ui("status").textContent = error.message; }
      finally { setBusy(false); }
    }
    ui("submit").onclick = () => { void transfer(false); };
    ui("share").onclick = () => { void transfer(true); };
    await render();
  } catch (error) {
    if (view?.dialog.open) { view.ui("status").textContent = error.message;view.setBusy(false); }
    else report(error.message);
  }
}
function cellSource(node,boardId) {
  return {key:"cell:" + String(boardId || "bibliotheque") + ":" + String(node.id),title:node.title,
    kind:node.category === "personnage" ? "TOKEN" : "DOCUMENT",data:node.bgImg || node.image || node.imageData || "",text:node.desc || ""};
}
function imageSource(item) {
  return {key:'library:'+item.id,title:item.name,data:item.data,
    kind:(item.category || 'personnage') === 'personnage' ? 'TOKEN' : 'DOCUMENT'};
}
function selectedCell() {
  const state = gmState(),node = (state.nodes || []).find(node => node.id === state.selectedId);
  if (!node) throw Error("Sélectionne une cellule du canevas.");
  return cellSource(node,state.activeBoardId);
}
async function placeSource(input,reveal = false) {
  // Documents retain their preview, including explicit PDF page/text choices.
  if (input.kind !== 'TOKEN') return openSource(input);
  if (directTransfers.has(input.key)) return;
  directTransfers.add(input.key);
  const controls = document.querySelectorAll('[data-direct-transfer]');
  controls.forEach(control => { control.disabled = true; });
  let source;
  try {
    gmState();notify('Préparation du token…');
    const context = await request({action:'context',sourceKey:input.key});
    source = await prepareSource(input);
    const preset = context.preset?.identity === source.identity ? context.preset : null;
    const framing = {identity:source.identity,crop:preset?.crop,page:1};
    const art = await renderSource(source,{kind:'TOKEN',title:source.title,crop:framing.crop});
    gmState();
    const result = await request({action:'transfer',scene:context.scene,sourceKey:source.key,
      kind:'TOKEN',title:source.title,reveal:reveal === true,art,framing},notify);
    notify(result.revealed ? '« '+result.title+' » placé et révélé dans Owlbear.' :
      '« '+result.title+' » placé dans ta vue MJ, caché aux joueurs.');
  } catch (error) { notify(error.message); }
  finally { source?.release();directTransfers.delete(input.key);controls.forEach(control => { control.disabled = false; }); }
}
async function placeSelected(reveal = false) {
  try { await placeSource(selectedCell(),reveal); }
  catch (error) { notify(error.message); }
}
function openFiles() {
  try { gmState(); }
  catch (error) { notify(error.message);return; }
  const input = document.createElement("input");input.type = "file";input.accept = "image/png,image/jpeg,image/webp,application/pdf,text/plain,.pdf,.txt";
  input.onchange = () => {
    const file = input.files[0];
    if (file) void openSource({key:"file:" + file.name + ":" + file.size + ":" + file.lastModified,
      file,title:file.name.replace(/\.[^.]+$/,""),kind:"DOCUMENT"});
  };
  input.click();
}
function install() {
  const state = window.DuneApp?.getState?.();
  if (!state || state.playerMode || state.strictReadOnly) return;
  const reveal = document.querySelector('#pin-block-cell-actions button[onclick="DuneApp.toggleSelectedReveal()"]');
  if (reveal && !$("archives-v45-transfer-button")) {
    const button = document.createElement("button");button.id = "archives-v45-transfer-button";button.type = "button";
    button.className = "btn";button.textContent = "Owlbear · Placer caché";button.dataset.directTransfer = '1';
    button.onclick = () => { void placeSelected(false); };
    const share = document.createElement('button');share.type = 'button';share.className = 'btn';
    share.id = 'archives-owl-direct-reveal';share.dataset.directTransfer = '1';share.textContent = 'Owlbear · Placer et révéler';
    share.onclick = () => { void placeSelected(true); };
    const frame = document.createElement('button');frame.type = 'button';frame.className = 'btn';
    frame.id = 'archives-owl-frame';frame.textContent = 'Cadrer / préparer…';frame.onclick = () => { void sendSelected(); };
    const actions = document.createElement('div');actions.className = 'archives-transfer-actions';
    actions.setAttribute('role','group');actions.setAttribute('aria-label','Transfert vers Owlbear');
    actions.append(button,share,frame);reveal.parentElement.after(actions);
  }
  const context = $('ctx-send-to-owlbear');
  if (context) {
    context.textContent = 'Owlbear · Placer caché';context.dataset.directTransfer = '1';
    context.addEventListener('click',() => { window.DuneApp.closeContextMenus();void placeSelected(false); });
    for (const [id,label,handler] of [
      ['archives-ctx-owl-reveal','Owlbear · Placer et révéler',() => placeSelected(true)],
      ['archives-ctx-owl-frame','Owlbear · Cadrer / préparer…',sendSelected]
    ]) {
      const control = document.createElement('button');control.id = id;control.type = 'button';control.className = 'ctx-item';
      control.textContent = label;control.style.cssText = context.style.cssText;
      control.onclick = () => { window.DuneApp.closeContextMenus();void handler(); };context.before(control);
    }
  }
  const library = $("archives-image-library-files");
  if (library && !$("archives-owl-files")) {
    const button = document.createElement("button");button.type = "button";button.id = "archives-owl-files";
    button.textContent = "Owlbear : fichiers et transferts…";button.className = "btn";
    button.onclick = () => { void showManager(); };library.parentElement.append(button);
  }
}
async function sendSelected() {
  try { await openSource(selectedCell()); }
  catch (error) { notify(error.message); }
}
window.ArchivesCellTransfer = {
  sendSelected,placeSelected,placeCell:(node,boardId,reveal = false) => placeSource(cellSource(node,boardId),reveal),openFiles,showManager,request,
  sendLibraryFile:({id,file,title}) => openSource({key:"documents:" + id,file,title,kind:"DOCUMENT"}),
  sendCell:(node,boardId) => openSource(cellSource(node,boardId)),
  sendImage:item => openSource(imageSource(item)),
  placeImage:(item,reveal = false) => placeSource(imageSource(item),reveal),
  sendFile:(file,title,placement,report) => openSource({key:"file:" + file.name + ":" + file.size + ":" + file.lastModified,
    title,file,kind:"DOCUMENT"},report)
};
install();
