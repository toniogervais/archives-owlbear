import {button,element,isGM,nativeEditor,notice,request,requireGM,sheet} from './ui.mjs?v=4420';
import {packet,editEvent} from '../v56/link.mjs';
import {installCloudBackup} from '../v71/cloud-ui.mjs?v=4480';
import {sendScreenCommand,leaveToMap} from '../v65/screens.mjs?v=4210';
import {dossierFilters,openAddFile,openSharedFile,removeSharedFile} from '../v69/dossier-ui.mjs?v=4420';
let players = [];
const paths = {
  batch:'<rect x="3" y="4" width="13" height="13" rx="2"/><path d="M8 20h11a2 2 0 0 0 2-2V9M7 13l3-3 3 3M7 8h.01"/>',
  roster:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  dossier:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 12h8M8 16h5"/>'
};
function command(id,label,path,handler) {
  const control = button('',handler,'studio-command');control.id = id;control.title = label;control.setAttribute('aria-label',label);
  control.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';return control;
}
async function openBackup() {
  try { requireGM();const module = await import('./backup-ui.mjs?v=4480');module.openBackup(); }
  catch (error) { notice(error.message); }
}
async function openBatch() {
  try { requireGM();const module = await import('./batch.mjs');await module.openBatch(); }
  catch (error) { notice(error.message); }
}
function stateLabel(player) {
  if (!player.connected) return ['OFFLINE','Déconnecté'];
  if (player.pending) return ['PENDING','Invitation en attente'];
  return player.screen === 'ARCHIVES' ? ['ARCHIVES','Archives'] : player.screen === 'OWLBEAR' ? ['OWLBEAR','Owlbear'] : ['UNKNOWN','Connexion…'];
}
function openRoster() {
  requireGM();const view = sheet('archives-room-roster','Joueurs et écrans','Salle Owlbear');
  if (nativeEditor()) window.parent.postMessage(packet('owl-roster-request'),location.origin);
  const hint = element('p','Choisis l’écran de destination pour un joueur. Une invitation peut être refusée ; le suivi obligatoire garde le bouton central affiché jusqu’à la bascule.','studio-hint'),list = element('div',null,'studio-grid');
  const destinations=new Map();
  view.content.append(hint,list);
  function render() {
    list.replaceChildren();
    if (!players.length) list.append(element('p','Aucun joueur présent pour le moment.','studio-hint'));
    for (const player of players) {
      const row = element('article',null,'studio-card');row.dataset.player = player.id;row.dataset.connected=String(player.connected);
      const [state,label] = stateLabel(player),chip = element('span',label,'studio-chip');chip.dataset.state = state;
      row.append(element('h3',player.name),chip);
      const target=element('select');target.setAttribute('aria-label','Écran pour '+player.name);
      for(const [value,label] of [['ARCHIVES','Archives'],['OWLBEAR','Carte Owlbear']]){const option=element('option',label);option.value=value;target.append(option);}
      target.value=destinations.get(player.id)||(player.screen==='ARCHIVES'?'OWLBEAR':'ARCHIVES');target.onchange=()=>destinations.set(player.id,target.value);
      const actions=element('div',null,'studio-actions');
      for(const [policy,label] of [['OPTIONAL','Inviter'],['REQUIRED','Imposer la bascule']]) {
        const control=button(label,async()=>{
          try {view.busy(true);await sendScreenCommand({target:target.value,policy,recipients:[player.id]});view.status.textContent=(policy==='REQUIRED'?'Bascule obligatoire demandée à ':'Invitation envoyée à ')+player.name+'.';}
          catch(error){view.status.textContent=error.message;}finally{view.busy(false);view.dialog.querySelectorAll('[data-connected="false"] button,[data-connected="false"] select').forEach(el=>{el.disabled=true;});}
        });control.disabled=!player.connected;actions.append(control);
      }
      target.disabled=!player.connected;row.append(target,actions);list.append(row);
    }
    view.status.textContent = players.filter(player => player.connected).length+' joueur(s) connecté(s).';
  }
  render();window.addEventListener('archives:roster',render);view.cleanup(() => window.removeEventListener('archives:roster',render));
}
function publicNodes() {
  // Use the same sender-side projection as the player connection, even for the GM preview.
  const projected = window.ArchivesRelay?.publicView?.();
  return (projected?.boards || []).flatMap(board => board.nodes.filter(node => node.revealed === true).map(node => ({
    id:'cell:'+board.id+':'+node.id,title:node.title || 'Sans titre',category:node.category || '',description:node.desc || '',
    image:node.bgImg || '',clues:(node.clues || []).filter(clue => clue.revealed === true).map(clue => clue.text || '')
  })));
}
function detail(record) {
  if(record.file){openSharedFile(record);return}
  const view = sheet('archives-dossier-detail',record.title,'Dossier des joueurs');
  if (record.image) { const image = element('img');image.src = record.image;image.alt = record.title;image.referrerPolicy = 'no-referrer';image.style.cssText = 'display:block;width:100%;max-height:60dvh;object-fit:contain;border-radius:12px;background:#09080e';view.content.append(image); }
  if (record.description) view.content.append(element('p',record.description));
  for (const clue of record.clues || []) view.content.append(element('p','✦ '+clue,'studio-card'));
}
function openDossier() {
  const view = sheet('archives-player-dossier','Dossier des joueurs','Éléments révélés');
  const tools = element('div',null,'studio-tools dossier-tools'),search = element('input'),grid = element('div',null,'studio-grid');
  search.type = 'search';search.placeholder = 'Rechercher un personnage, un document ou un indice…';search.setAttribute('aria-label','Rechercher dans le dossier des joueurs');
  const filters=element('div',null,'dossier-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Filtrer par type de cellule');
  let selectedKind='';
  const controls=dossierFilters.map(([kind,label,path])=>{
    const control=button('',()=>{selectedKind=kind;render()});control.dataset.kind=kind;control.setAttribute('aria-label',label);control.title=label;
    control.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';control.append(element('span',label));filters.append(control);return control;
  });
  const add=button('＋ Ajouter un fichier dans Autre',()=>openAddFile(async()=>{selectedKind='autre';await refreshDocuments();render()}));
  tools.append(search,filters,add);view.content.append(element('p','Retrouve les informations révélées de la campagne et les documents, sons ou vidéos partagés par le MJ.','studio-hint'),tools,grid);
  let documents = [],files=[],documentSignature = '',closed = false,fetching = false;
  const knownKinds=new Set(dossierFilters.map(([kind])=>kind));
  function render() {
    if (closed) return;
    const query = search.value.toLocaleLowerCase('fr');
    for(const control of controls)control.setAttribute('aria-pressed',String(control.dataset.kind===selectedKind));
    add.hidden=!(isGM()&&nativeEditor()&&selectedKind==='autre');
    const records = [...publicNodes(),...documents,...files],filtered = records.filter(record => (!selectedKind ||
      (knownKinds.has(record.category)?record.category:'autre')===selectedKind) &&
      (record.title+' '+(record.description || '')+' '+(record.clues || []).join(' ')).toLocaleLowerCase('fr').includes(query));
    grid.replaceChildren();
    for (const record of filtered) {
      const card = element('article',null,'studio-card');card.dataset.dossierId = record.id;
      if (record.image) { const image = element('img');image.src = record.image;image.alt = record.title;image.loading = 'lazy';image.referrerPolicy = 'no-referrer';card.append(image); }
      card.append(element('h3',record.title));
      if (record.description) card.append(element('p',record.description.slice(0,170)+(record.description.length > 170 ? '…' : ''),'studio-hint'));
      if (record.clues?.length) card.append(element('p',record.clues.length+' indice(s) révélé(s)','studio-hint'));
      card.append(button('Consulter',() => detail(record)));
      if(record.file&&isGM()&&nativeEditor())card.append(button('Retirer du dossier',async()=>{
        try{await removeSharedFile(record);await refreshDocuments()}catch(error){view.status.textContent=error.message}
      }));
      grid.append(card);
    }
    if (!filtered.length) grid.append(element('p',query ? 'Aucun élément révélé pour cette recherche.' : 'Le MJ n’a encore partagé aucun élément correspondant.','studio-hint'));
    view.status.textContent = filtered.length+' élément(s) disponible(s).';
  }
  async function refreshDocuments() {
    if (closed || fetching || window.parent === window) return;
    fetching = true;
    try {
      const [artwork,shared]=await Promise.allSettled([request('public'),request('dossier',{action:'list'})]);if(closed)return;
      const nextDocuments=artwork.status==='fulfilled'?(artwork.value.items||[]).map(item=>({id:'owl:'+item.id,title:item.title,image:item.image.url,description:'',clues:[],category:item.kind==='TOKEN'?'personnage':'autre'})):documents;
      const nextFiles=shared.status==='fulfilled'?(shared.value.entries||[]).map(file=>({id:'file:'+file.id,title:file.title,description:file.mime.startsWith('audio/')?'Fichier audio':file.mime.startsWith('video/')?'Vidéo':'Document',clues:[],category:'autre',file})):files;
      const signature=JSON.stringify([nextDocuments,nextFiles]);
      if(signature!==documentSignature){documentSignature=signature;documents=nextDocuments;files=nextFiles;render()}
      if(shared.status==='rejected')view.status.textContent=shared.reason.message;
    } finally { fetching = false; }
  }
  search.oninput = render;render();void refreshDocuments();
  const timer = setInterval(() => { void refreshDocuments(); },4000);
  window.addEventListener('archives:public-view',render);window.addEventListener(editEvent,render);
  view.cleanup(() => { closed = true;clearInterval(timer);window.removeEventListener('archives:public-view',render);window.removeEventListener(editEvent,render); });
}
async function focusSelected() {
  try {
    requireGM();const state = window.DuneApp.getState(),node = state.nodes.find(node => node.id === state.selectedId);
    if (!node) throw Error('Sélectionne une cellule pour retrouver son élément Owlbear.');
    await window.ArchivesCellTransfer.request({action:'focus',sourceKey:'cell:'+state.activeBoardId+':'+node.id});
    await leaveToMap();
  } catch (error) { notice(error.message); }
}
window.ArchivesWorkbench = {openBackup,openBatch,openDossier,openRoster,focusSelected};
window.addEventListener('archives:roster',event => {
  players = (event.detail || []).map(player => ({id:player.id,name:player.name,connected:!!player.connected,screen:player.screen,pending:!!player.pending}));
  const roster = document.getElementById('archives-roster-open');
  if (roster) { const count = players.filter(player => player.connected).length;roster.setAttribute('aria-label','Joueurs et écrans : '+count+' connecté(s)');roster.dataset.studioLabel = 'Joueurs et écrans : '+count+' connecté(s)'; }
});
function install() {
  const group = document.querySelector('#top-hud .hud-row>.top-group');if (!group) return;
  const tabs = document.getElementById('tabs-bar'),add = control => group.insertBefore(control,tabs);
  add(command('archives-dossier-open','Dossier des joueurs',paths.dossier,openDossier));
  if (isGM() && nativeEditor()) {
    const caption = document.getElementById('archives-sync-diag-caption');if (caption) { caption.textContent = 'Salle Owlbear';caption.parentElement.title = 'Diagnostic avancé de la salle'; }
    add(command('archives-batch-open','Préparer plusieurs transferts',paths.batch,() => { void openBatch(); }));
    add(command('archives-roster-open','Joueurs et écrans',paths.roster,openRoster));
    const save = document.getElementById('canvas-save-icon');if (save) { save.onclick = () => { void openBackup(); };save.title = 'Sauvegarder toute la campagne';save.setAttribute('aria-label',save.title); }
    const backups = document.querySelector('#owl-settings-backups .owl-settings-body');
    if (backups) backups.prepend(button('Campagne complète : sauvegarder ou restaurer…',() => { void openBackup(); },'btn btn-gold'));
    const controls = document.querySelector('#pin-block-cell-actions button[onclick="DuneApp.toggleSelectedReveal()"]')?.parentElement;
    if (controls) { const focus = button('Voir dans Owlbear',() => { void focusSelected(); },'btn');focus.id = 'archives-focus-selected';controls.append(focus); }
    const context = document.getElementById('ctx-send-to-owlbear');
    if (context) { const focus = button('Voir dans Owlbear',() => { window.DuneApp.closeContextMenus();void focusSelected(); });focus.id = 'archives-focus-owlbear';context.insertAdjacentElement('afterend',focus); }
  }
}
install();
if(isGM()) {
  installCloudBackup();
  if(window.parent===window) {
    const save=document.getElementById('canvas-save-icon');if(save){save.onclick=openBackup;save.title='Sauvegardes';save.setAttribute('aria-label','Sauvegardes');}
  }
}
window.addEventListener('archives:campaign-restored',() => { Promise.resolve(window.ArchivesImageLibrary?.refresh?.()).catch(() => {}); });
