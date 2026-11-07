import {button,element,notice,requireGM,sheet} from './ui.mjs';
import {libraryRequest} from '../v60/request.mjs';
import {prepareSource,renderSource,sourcePicture} from '../v58/media.mjs?v=4210';
import {installCropEditor} from '../v61/token-crop.mjs';
async function catalogImages() {
  return new Promise((resolve,reject) => {
    const open = indexedDB.open('ArchivesImaginaireImageLibrary',1);
    open.onupgradeneeded = () => open.result.createObjectStore('images',{keyPath:'id'}).createIndex('name','name');
    open.onerror = () => reject(open.error);open.onsuccess = () => {
      const db = open.result,tx = db.transaction('images'),request = tx.objectStore('images').getAll();
      tx.oncomplete = () => { db.close();resolve(request.result); };tx.onabort = () => { db.close();reject(tx.error); };
    };
  });
}
export async function openBatch() {
  requireGM();const view = sheet('archives-batch-transfer','Préparer plusieurs transferts','Owlbear Rodeo');
  const {dialog,content,status} = view,choose = element('section'),preview = element('section');preview.hidden = true;
  const tools = element('div',null,'studio-tools'),search = element('input'),select = element('select'),list = element('div',null,'batch-list');
  search.type = 'search';search.placeholder = 'Rechercher parmi les cellules et bibliothèques…';search.setAttribute('aria-label','Rechercher les éléments à transférer');
  for (const [value,label] of [['','Toutes les sources'],['cell','Cellules du scénario'],['image','Bibliothèque d’images'],['file','Documents et autres']]) { const option = element('option',label);option.value = value;select.append(option); }
  select.setAttribute('aria-label','Source des éléments');tools.append(search,select);
  choose.append(element('p','Choisis jusqu’à 20 personnages ou documents. Tu pourras ajuster chaque aperçu avant de placer le lot.','studio-hint'),tools,list);
  const actions = element('div',null,'studio-actions'),prepare = button('Préparer la sélection',() => { void prepareSelected(); },'primary');prepare.disabled = true;
  actions.append(prepare);choose.append(actions);content.append(choose,preview);
  const style = element('style');style.textContent = '#archives-batch-transfer .batch-list{display:grid;gap:7px;max-height:47dvh;overflow:auto}#archives-batch-transfer .batch-choice{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #b69c6925;background:#ffffff03;border-radius:9px;cursor:pointer}#archives-batch-transfer .batch-choice:has(input:checked){border-color:#d6b57866;background:#d6b5780c}#archives-batch-transfer .batch-choice small{display:block;color:#b9adbf;font-size:12px}#archives-batch-transfer label{display:block;margin:10px 0}#archives-batch-transfer .batch-card input:not([type=range]),#archives-batch-transfer .batch-card select{display:block;width:100%;margin-top:5px}#archives-batch-transfer .batch-crop{width:min(260px,100%);margin:12px auto}#archives-batch-transfer canvas{display:block;width:100%;height:auto;aspect-ratio:1;touch-action:none;cursor:grab}#archives-batch-transfer canvas.dragging{cursor:grabbing}#archives-batch-transfer .batch-zoom{display:flex;gap:10px;align-items:center}#archives-batch-transfer .batch-zoom input{min-width:0;padding:0;flex:1;accent-color:#d3b075}#archives-batch-transfer .batch-card img{height:260px}';dialog.prepend(style);
  let sources = [],states = [],closed = false,working = false,context;
  const selected = new Set(),drafts = new Map();
  function disposeStates() {
    for (const state of states) {
      drafts.set(state.input.key,{identity:state.source.identity,kind:state.kind.value,page:Number(state.page.value),crop:state.crop.getState(),title:state.title.value});
      state.disposed = true;state.crop.dispose();state.source.release();
    }
    states = [];
  }
  view.cleanup(() => { closed = true;disposeStates(); });
  function renderChoices() {
    const query = search.value.toLocaleLowerCase('fr'),kind = select.value;list.replaceChildren();
    for (const source of sources.filter(source => (!kind || source.group === kind) && source.title.toLocaleLowerCase('fr').includes(query))) {
      const row = element('label',null,'batch-choice'),checkbox = element('input'),text = element('span');checkbox.type = 'checkbox';checkbox.checked = selected.has(source.key);
      checkbox.disabled = selected.size >= 20 && !checkbox.checked;checkbox.dataset.sourceKey = source.key;
      text.append(element('strong',source.title),element('small',source.label));row.append(checkbox,text);list.append(row);
      checkbox.onchange = () => { if (checkbox.checked) selected.add(source.key);else selected.delete(source.key);renderChoices(); };
    }
    prepare.disabled = !selected.size;prepare.textContent = 'Préparer la sélection'+(selected.size ? ' ('+selected.size+')' : '');
    status.textContent = selected.size+' / 20 éléments sélectionnés.';
  }
  search.oninput = select.onchange = renderChoices;
  const back = button('← Modifier la sélection',() => { if (working) return;disposeStates();preview.replaceChildren();preview.hidden = true;choose.hidden = false;renderChoices(); });
  let hidden,share;
  function busy(value) {
    working = value;view.busy(value);for (const state of states) state.crop.setDisabled(value);
    if (hidden) hidden.disabled = share.disabled = value || !states.length || states.some(state => !state.ready);
  }
  async function prepareSelected() {
    working = true;view.busy(true);status.textContent = 'Préparation des aperçus…';
    try {
      const inputs = sources.filter(source => selected.has(source.key));
      context = await window.ArchivesCellTransfer.request({action:'context',sourceKeys:inputs.map(source => source.key)});
      if (closed) return;
      const presets = new Map((context.presets || []).map(entry => [entry.source,entry.value]));
      const grid = element('div',null,'studio-grid'),finish = element('div',null,'studio-actions');
      hidden = button('Placer le lot caché',() => { void transfer(false); },'primary');share = button('Placer le lot et révéler',() => { void transfer(true); });hidden.disabled = share.disabled = true;
      finish.append(hidden,share);preview.append(back,element('p','Glisse chaque image dans son token et ajuste le zoom. Seuls les rendus des aperçus seront transférés.','studio-hint'),grid,finish);
      choose.hidden = true;preview.hidden = false;
      for (let index = 0;index < inputs.length;index++) {
        const input = inputs[index];status.textContent = 'Préparation '+(index+1)+' / '+inputs.length+' : '+input.title+'…';
        let preparedInput = input;
        if (input.group === 'file') {
          const result = await libraryRequest({action:'get',fileId:input.fileId});
          preparedInput = {...input,file:new File([result.blob],result.entry.name,{type:result.entry.mime,lastModified:result.entry.created})};
        }
        const source = await prepareSource(preparedInput);if (closed) { source.release();return; }
        const candidate = drafts.get(input.key) || presets.get(input.key),preset = candidate?.identity === source.identity ? candidate : null;
        const card = element('article',null,'studio-card batch-card');card.dataset.sourceKey = input.key;
        const title = element('input');title.value = preset?.title || source.title;title.maxLength = 120;title.setAttribute('aria-label','Nom dans Owlbear de '+source.title);
        const kind = element('select');kind.setAttribute('aria-label','Format de '+source.title);
        for (const [value,label] of [['TOKEN','Token rond'],['DOCUMENT','Document']]) { const option = element('option',label);option.value = value;kind.append(option); }
        kind.value = preset?.kind || input.kind;
        const page = element('input');page.type = 'number';page.min = 1;page.max = source.pages || 1;page.value = Number.isInteger(preset?.page) && preset.page <= (source.pages || 1) ? preset.page : 1;
        const pageLabel = element('label','Page du PDF');pageLabel.append(page);pageLabel.hidden = !source.pages;
        const image = element('img');image.alt = source.title;image.hidden = true;
        const stage = element('div',null,'batch-crop'),canvas = element('canvas');canvas.width = canvas.height = 512;canvas.tabIndex = 0;canvas.setAttribute('aria-label','Déplacer l’image de '+source.title);stage.append(canvas);
        const zoom = element('div',null,'batch-zoom'),range = element('input'),output = element('output');range.type = 'range';range.min = 15;range.max = 800;range.value = 100;range.setAttribute('aria-label','Zoom de '+source.title);zoom.append(element('span','Zoom'),range,output);
        const label = element('label','Nom dans Owlbear');label.append(title);card.append(label,kind,pageLabel,stage,image,zoom);
        const message = element('p','','studio-hint');card.append(message);grid.append(card);
        const crop = installCropEditor({canvas,range,output}),state = {input,source,card,title,kind,page,crop,ready:false,version:0,disposed:false};states.push(state);
        let presetCrop = preset?.crop;
        async function render() {
          const version = ++state.version;state.ready = false;hidden.disabled = share.disabled = true;
          try {
            if (!title.value.trim()) throw Error('Donne un nom à cet élément.');
            const number = Number(page.value);
            if (!Number.isInteger(number) || number < 1 || number > (source.pages || 1)) throw Error('Choisis une page existante du PDF.');
            if (kind.value === 'TOKEN') {
              const picture = await sourcePicture(source,number);if (closed || state.disposed || version !== state.version) return;
              crop.setPicture(picture,title.value,presetCrop);presetCrop = null;stage.hidden = false;image.hidden = true;zoom.hidden = !picture;
            } else {
              const art = await renderSource(source,{kind:'DOCUMENT',title:title.value,text:source.text,page:number,includeText:!source.bitmap && !source.pdf && !!source.text});
              if (closed || state.disposed || version !== state.version) return;
              image.src = art.data;image.hidden = false;stage.hidden = true;zoom.hidden = true;
            }
            state.ready = true;message.textContent = kind.value === 'TOKEN' ? 'Zoom / dézoom et glisser l’image.' : 'Ce rendu entier sera transféré.';
          } catch (error) { if (!state.disposed && version === state.version) message.textContent = error.message; }
          finally { if (!state.disposed && !closed) hidden.disabled = share.disabled = working || states.length !== selected.size || states.some(state => !state.ready); }
        }
        title.oninput = page.oninput = kind.onchange = () => { void render(); };
        await render();
      }
      if (!closed) { status.textContent = 'Vérifie les aperçus puis choisis la visibilité du lot.';busy(false); }
    } catch (error) { status.textContent = error.message; }
    finally { if (!closed) { working = false;view.busy(false);if (hidden) hidden.disabled = share.disabled = !states.length || states.length !== selected.size || states.some(state => !state.ready); } }
  }
  async function transfer(reveal) {
    if (working || !states.length || states.some(state => !state.ready)) return;
    busy(true);status.textContent = 'Création des rendus du lot…';
    try {
      const commands = [];
      for (const state of states) {
        const framing = {identity:state.source.identity,page:Number(state.page.value),crop:state.crop.getState()};
        const art = await renderSource(state.source,{kind:state.kind.value,title:state.title.value.trim(),page:framing.page,crop:framing.crop,
          text:state.source.text,includeText:!state.source.bitmap && !state.source.pdf && !!state.source.text});
        commands.push({sourceKey:state.input.key,kind:state.kind.value,title:state.title.value.trim(),art,framing});
      }
      const result = await window.ArchivesCellTransfer.request({action:'batch',scene:context.scene,reveal,commands},message => { if (dialog.open) status.textContent = message; });
      if (!dialog.open) return;dialog.close();notice(result.count+' élément(s) placé(s) '+(result.revealed ? 'et révélé(s) dans Owlbear.' : 'dans ta vue MJ, cachés aux joueurs.'));
    } catch (error) { status.textContent = error.message; }
    finally { busy(false); }
  }
  view.busy(true);
  try {
    const state = window.DuneApp.getState();
    sources = state.boards.flatMap(board => board.nodes.map(node => ({key:'cell:'+board.id+':'+node.id,title:node.title || 'Sans titre',
      kind:node.category === 'personnage' ? 'TOKEN' : 'DOCUMENT',data:node.bgImg || node.image || node.imageData || '',text:node.desc || '',group:'cell',label:'Cellule · '+board.name})));
    const files = await libraryRequest({action:'list'}),images = await catalogImages();if (closed) return;
    sources.push(...files.entries.filter(entry => entry.kind === 'DOCUMENT').map(entry => ({key:'documents:'+entry.id,fileId:entry.id,title:entry.title,kind:'DOCUMENT',group:'file',label:'Document · '+entry.name})));
    sources.push(...images.map(image => ({key:'library:'+image.id,title:image.name,data:image.data,kind:image.category === 'personnage' ? 'TOKEN' : 'DOCUMENT',group:'image',label:'Bibliothèque d’images'})));
    sources.sort((a,b) => a.title.localeCompare(b.title,'fr'));renderChoices();
  } catch (error) { status.textContent = error.message; }
  finally { if (!closed) { view.busy(false);prepare.disabled = !selected.size; } }
}
