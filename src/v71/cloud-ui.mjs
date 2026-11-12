import {button,element,isGM,nativeEditor,notice,sheet} from '../v63/ui.mjs';
import {editEvent} from '../v56/link.mjs';
import {createCloud,cloudError} from './cloud.mjs?v=4480';
import {autoBackup} from './autosave.mjs?v=4480';
import {campaignRequest} from './campaign-io.mjs';
import {downloadArchive} from './download.mjs';
const cloud = createCloud(() => {
  if (!isGM()) throw Error('Commande réservée au maître de jeu.');
  if (!window.ArchivesCloudBridge) throw Error('Ouvre « Comptes & campagnes » pour connecter ton compte MJ.');
  return window.ArchivesCloudBridge.getClient();
});
const labels = {off:'Sauvegarde en ligne désactivée',pending:'Modifications en attente d’envoi',saving:'Enregistrement en ligne…',saved:'Enregistré en ligne',error:'Envoi en attente — copie conservée sur cet appareil',conflict:'Une version plus récente existe en ligne'};
let engine,scope,interval,releaseRestore;
const date = value => value ? new Date(value).toLocaleString('fr-FR') : '';
const bytes = value => (value/1024/1024).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
function stateText(state) {
  return (labels[state?.state] || labels.off)+(state?.binding?.savedAt ? ' · Dernière copie : '+date(state.binding.savedAt) : '')+(state?.message ? '\n'+state.message : '');
}
function start(value) {
  if (!isGM() || !value || scope === value) return;
  engine?.dispose();clearInterval(interval);scope = value;
  const key = 'archives-cloud-backup-v446:'+scope;
  engine = autoBackup({cloud,
    read:() => { try { const saved=JSON.parse(localStorage.getItem(key)||'null');return saved && typeof saved.campaignId==='string' && Number.isSafeInteger(saved.revision) ? saved : null; } catch { return null; } },
    write:value => { if (value) localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key); },
    capture:() => campaignRequest({action:'export',snapshot:window.ArchivesRelay.snapshot()}),
    changed:state => {
      const save = document.getElementById('canvas-save-icon');
      if (save) { save.title='Sauvegardes · '+(labels[state.state] || labels.off);save.setAttribute('aria-label',save.title);save.dataset.cloudState=state.state; }
      window.dispatchEvent(new CustomEvent('archives:cloud-backup-status',{detail:state}));
      if (state.state==='conflict') notice(state.message);
    }
  });
  // A browser may keep its preferences after its campaign database was cleared.
  // Never send a newly generated blank canvas over a previous online campaign.
  if(nativeEditor() && window.ArchivesCampaignHasLocal===false)engine.pause();
  // The regular check also catches changes to IndexedDB libraries and framing
  // which do not emit the canvas edit event. Identical exports never re-upload.
  interval = setInterval(() => { if (isGM() && !document.hidden) void engine.save(); },60000);
  engine.change();
}
export function pauseCloudBackup() { engine?.pause(); }
export function installCloudBackup() {
  if (!isGM()) return;
  if (nativeEditor()) {
    if (window.ArchivesCampaignScope) start(window.ArchivesCampaignScope);
    window.addEventListener('archives:campaign-context',event => start(event.detail));
  } else if (window.parent === window) start('standalone');
  window.addEventListener(editEvent,() => { if (isGM()) engine?.change(); });
  window.addEventListener('archives:scenario-replaced',() => { if(isGM())engine?.pause(); });
  window.addEventListener('online',() => { if (isGM()) void engine?.save(); });
  window.addEventListener('focus',() => { if (isGM()) void engine?.save(); });
  document.addEventListener('visibilitychange',() => { if (isGM()) void engine?.save(); });
  window.addEventListener('pagehide',() => { engine?.dispose();clearInterval(interval); });
  window.addEventListener('archives:restore-begin',() => { releaseRestore=engine?.hold(); });
  window.addEventListener('archives:restore-end',() => { releaseRestore?.();releaseRestore=null; });
  const title = document.querySelector('#archives-cloud-launch-title');
  if (title && window.parent===window) {
    const open=button('☁ Sauvegardes',() => window.ArchivesWorkbench?.openBackup(),title.className);open.id='archives-cloud-backups-title';title.insertAdjacentElement('afterend',open);
  }
}
export function mountCloudBackups(view,inspect,{localDownload}={}) {
  const {content,status} = view,section=element('section',null,'cloud-backup-section');section.id='archives-online-backups';
  const heading=element('h3','Sauvegardes en ligne'),state=element('p',stateText(engine?.status()),'studio-status');state.style.whiteSpace='pre-line';
  section.append(heading,element('p','Retrouve la campagne complète sur un autre appareil avec ton compte MJ. Les dix dernières versions sont conservées, avec les secrets et les fichiers privés.','studio-hint'),state);
  const actions=element('div',null,'studio-actions'),accounts=button('Comptes & campagnes',() => {
    view.dialog.close();document.getElementById('archives-cloud-panel')?.classList.add('open');
  }),refresh=button('Actualiser',() => { void load(); });actions.append(accounts,refresh);if(localDownload)actions.append(localDownload);section.append(actions);
  const label=element('label','Campagne en ligne'),select=element('select');select.id='archives-online-campaign';label.htmlFor=select.id;section.append(label,select);
  const controls=element('div',null,'studio-actions'),enable=button('Activer la sauvegarde automatique',() => { void enableSelected(); },'primary'),save=button('Enregistrer maintenant',() => { void saveNow(); }),pause=button('Suspendre sur cet appareil',() => { engine?.pause();renderControls(); });
  controls.append(enable,save,pause);section.append(controls);
  const hint=element('p','','studio-hint'),versions=element('div',null,'cloud-backup-versions');section.append(hint,versions);
  const selection=element('div',null,'studio-actions'),selectedCount=element('span'),selectAll=button('Tout sélectionner',()=>{
    const all=rows.length>0&&rows.every(row=>selected.has(row.id));selected.clear();if(!all)rows.forEach(row=>selected.add(row.id));syncSelection();
  }),remove=button('Supprimer la sélection',()=>{void removeSelected()});
  remove.id='archives-delete-backups';selection.append(selectAll,remove,selectedCount);versions.before(selection);
  const space=element('p','','studio-hint'),clean=button('Libérer l’espace restant',()=>{void cleanPending()});selection.before(space);selection.after(clean);
  clean.hidden=true;
  const createRow=element('div',null,'studio-actions'),name=element('input');name.placeholder='Nom de la nouvelle campagne';name.setAttribute('aria-label','Nom de la nouvelle campagne en ligne');
  createRow.append(name,button('Sauvegarder dans une nouvelle campagne',() => { void create(); }));section.append(createRow);
  const setup=element('details'),summary=element('summary','Activer ou mettre à jour le stockage');
  const link=element('a','Ouvrir le script SQL');link.href=new URL('../../sql/archives-cloud-backups-v448.sql',import.meta.url).href;link.target='_blank';link.rel='noopener';
  const script=element('textarea');script.readOnly=true;script.hidden=true;script.setAttribute('aria-label','Script SQL des sauvegardes');script.style.cssText='display:block;width:100%;min-height:220px;margin-top:10px;font:12px/1.5 monospace';script.style.display='none';
  async function showScript(copy=false) {
    try {
      if(!script.value){const response=await fetch(link.href);if(!response.ok)throw Error('Script indisponible.');script.value=await response.text()}
      script.hidden=false;script.style.display='block';script.focus();script.select();
      if(copy){try{await navigator.clipboard.writeText(script.value);status.textContent='Script copié. Colle-le dans SQL Editor de Supabase, puis clique sur Run.';return}catch{}}
      status.textContent='Le script est sélectionné. Fais Ctrl + C (ou Copier sur tablette), puis colle-le dans SQL Editor de Supabase et clique sur Run.';
    }catch(error){status.textContent=error.message+' Utilise le lien « Ouvrir le script SQL ».'}
  }
  setup.append(summary,element('p','Exécute ce script une fois dans SQL Editor de ton projet Supabase pour activer les sauvegardes et leur suppression. Les campagnes et sauvegardes existantes sont conservées.','studio-hint'),link,
    button('Afficher le script',()=>{void showScript()}),button('Copier le script',()=>{void showScript(true)}),script);section.append(setup);content.prepend(section);
  let rows=[],campaigns=[],ctx,closed=false,sequence=0,releasePreview,catalog={revision:0,canDelete:false,cleanupPending:0,cleanupBytes:0};
  const selected=new Set();
  const update=event => { if(!closed){state.textContent=stateText(event.detail);renderControls();} };
  window.addEventListener('archives:cloud-backup-status',update);
  view.cleanup(() => { closed=true;sequence++;releasePreview?.();window.removeEventListener('archives:cloud-backup-status',update); });
  function fail(error) { const value=cloudError(error);status.textContent=value.message;if(value.code==='SETUP')setup.open=true; }
  function syncSelection() {
    for(const input of versions.querySelectorAll('input[data-select-backup]'))input.checked=selected.has(input.dataset.selectBackup);
    const picked=rows.filter(row=>selected.has(row.id));
    remove.disabled=!picked.length;remove.textContent='Supprimer la sélection'+(picked.length?' ('+picked.length+')':'');
    selectedCount.textContent=picked.length+' sélectionnée(s) · '+bytes(picked.reduce((total,row)=>total+row.byte_size,0));
    selectAll.disabled=!rows.length;selectAll.textContent=rows.length&&picked.length===rows.length?'Tout désélectionner':'Tout sélectionner';
    space.textContent=rows.length+' sauvegarde(s) · '+bytes(rows.reduce((total,row)=>total+row.byte_size,0))+' pour cette campagne'+
      (catalog.cleanupPending?' · '+bytes(catalog.cleanupBytes)+' restant à libérer':'');
    clean.hidden=!catalog.cleanupPending;
  }
  function matches() { const bound=engine?.binding();return bound && bound.project===ctx?.project && bound.owner===ctx?.user.id && bound.campaignId===select.value; }
  function renderControls() {
    const bound=engine?.binding(),active=matches() && bound.enabled;
    enable.hidden=!!active;enable.disabled=!ctx || !select.value || (!!rows.length && !matches());
    save.hidden=pause.hidden=!active;
    hint.textContent=rows.length&&!matches() ? 'Ouvre une version ci-dessous pour reprendre cette campagne sur cet appareil. Pour garder le scénario actuellement ouvert, sauvegarde-le dans une nouvelle campagne.' : '';
  }
  async function load(preferred) {
    const generation=++sequence;versions.replaceChildren();rows=[];select.replaceChildren(new Option('Choisir une campagne…',''));
    try {
      const result=await cloud.campaigns();if(closed||generation!==sequence)return;
      ctx=result.ctx;campaigns=result.rows;
      for(const item of campaigns)select.append(new Option(item.name || 'Campagne sans nom',item.id));
      const bound=engine?.binding();select.value=preferred || (bound?.project===ctx.project && bound?.owner===ctx.user.id ? bound.campaignId : campaigns.length===1 ? campaigns[0].id : '');
      const loaded=await list(generation);if(loaded!==false)status.textContent='Connecté avec '+ctx.user.email+'. Choisis une version à ouvrir ou active la sauvegarde de la campagne actuelle.';
    } catch(error){
      ctx=null;fail(error);
      // Keep the current campaign and its retry/pause actions accessible offline.
      // This display context never authenticates a request: cloud rechecks Auth.
      const bound=engine?.binding();
      if(bound){ctx={project:bound.project,user:{id:bound.owner}};select.append(new Option(bound.name || 'Campagne de cet appareil',bound.campaignId));select.value=bound.campaignId;}
    }
    renderControls();syncSelection();
  }
  async function list(generation=++sequence) {
    rows=[];catalog={revision:0,canDelete:false,cleanupPending:0,cleanupBytes:0};versions.replaceChildren();renderControls();syncSelection();if(!select.value)return;
    try {
      const result=await cloud.versions(select.value);if(closed||generation!==sequence)return;rows=result.rows;catalog=result;
      for(const id of selected)if(!rows.some(row=>row.id===id))selected.delete(id);
      for(const row of rows) {
        const card=element('article',null,'studio-card');card.dataset.backupId=row.id;
        const choice=element('input');choice.type='checkbox';choice.dataset.selectBackup=row.id;choice.setAttribute('aria-label','Sélectionner la sauvegarde du '+date(row.created_at));
        choice.onchange=()=>{if(choice.checked)selected.add(row.id);else selected.delete(row.id);syncSelection()};
        const title=element('label');title.style.cssText='display:flex;align-items:center;gap:10px';title.append(choice,element('h4',date(row.created_at)));
        card.append(title,element('p',(row.summary?.cells || 0)+' cellule(s) · '+(row.summary?.images || 0)+' image(s) · '+bytes(row.byte_size),'studio-hint'),
          button('Ouvrir cette version…',() => { void openVersion(row); }),button('Télécharger sur cet appareil',()=>{void downloadVersion(row)}));versions.append(card);
      }
      if(!rows.length)versions.append(element('p','Aucune version en ligne pour cette campagne.','studio-hint'));
    } catch(error){fail(error);renderControls();syncSelection();return false}
    renderControls();syncSelection();return true;
  }
  async function bind(campaign,revision=0,fingerprint=null,savedAt=null) {
    if(!engine)throw Error('La campagne est en cours d’ouverture. Réessaie dans un instant.');
    const current=await cloud.context();
    return engine.bind({campaignId:campaign.id,name:campaign.name,owner:current.user.id,project:current.project,revision,fingerprint,savedAt});
  }
  async function enableSelected() {
    view.busy(true);
    try {
      const campaign=campaigns.find(item=>item.id===select.value);if(!campaign)throw Error('Choisis une campagne.');
      const latest=await cloud.versions(campaign.id),bound=engine?.binding();
      if(latest.rows.length&&(!matches()||bound.revision!==latest.revision))throw Error('Ouvre d’abord une version en ligne de cette campagne.');
      const resume=matches()&&latest.rows.length>0;
      await bind(campaign,latest.revision,resume?bound.fingerprint:null,resume?bound.savedAt:null);await list();
    } catch(error){fail(error)}finally{view.busy(false);renderControls();syncSelection()}
  }
  async function saveNow() { view.busy(true);try{await engine.save();await list()}catch(error){fail(error)}finally{view.busy(false);renderControls();syncSelection()} }
  async function create() {
    view.busy(true);status.textContent='Création de la campagne et de sa première sauvegarde…';
    try { const campaign=await cloud.create(name.value);await bind(campaign);name.value='';await load(campaign.id); }
    catch(error){fail(error)}finally{view.busy(false);renderControls();syncSelection()}
  }
  async function openVersion(row) {
    if(engine?.status().state==='saving'){status.textContent='Attends la fin de l’enregistrement avant d’ouvrir une version.';return}
    releasePreview?.();releasePreview=engine?.hold();view.busy(true);status.textContent='Téléchargement et vérification de la version privée…';
    const campaign=campaigns.find(item=>item.id===row.campaign_id);
    try {
      const result=await cloud.download(row.campaign_id,row.id,async()=>{if(closed||!isGM())throw Error('Ouverture interrompue.');});
      await inspect({action:'inspect',file:result.blob},{
        before:async()=>{
          const latest=await cloud.versions(row.campaign_id);
          if(latest.ctx.user.id!==result.ctx.user.id||latest.ctx.project!==result.ctx.project||latest.revision!==result.revision)
            throw Error('La version en ligne ou le compte a changé. Actualise la liste avant de restaurer.');
        },
        after:async()=>{releasePreview?.();releasePreview=null;await bind(campaign,result.revision,null,result.head.created_at);}
      });
    }catch(error){releasePreview?.();releasePreview=null;fail(error)}finally{view.busy(false);renderControls();syncSelection()}
  }
  async function downloadVersion(row) {
    view.busy(true);status.textContent='Téléchargement de la sauvegarde vérifiée…';
    try{const result=await cloud.download(row.campaign_id,row.id);if(closed)return;
      const campaign=campaigns.find(item=>item.id===row.campaign_id);
      downloadArchive(result.blob,(campaign?.name || 'Campagne_Archives')+'_version_'+row.revision+'_'+row.created_at);
      status.textContent='Fichier .archives téléchargé : '+bytes(result.blob.size)+'.';
    }catch(error){fail(error)}finally{view.busy(false);renderControls();syncSelection()}
  }
  async function cleanPending() {
    view.busy(true);status.textContent='Suppression des fichiers en attente…';
    try{const result=await cloud.cleanup(select.value);await list();status.textContent=bytes(result.freedBytes)+' libérés.'}
    catch(error){fail(error)}finally{view.busy(false);renderControls();syncSelection()}
  }
  async function removeSelected() {
    const picked=rows.filter(row=>selected.has(row.id));if(!picked.length)return;
    if(!catalog.canDelete){setup.open=true;status.textContent='Exécute le script de mise à jour Supabase ci-dessous pour activer la suppression.';return}
    if(engine?.status().state==='saving'){status.textContent='Attends la fin de l’enregistrement avant de supprimer une sauvegarde.';return}
    const before=catalog,campaignId=select.value,account={owner:ctx.user.id,project:ctx.project};
    const release=engine?.hold(),confirm=sheet('archives-delete-backup-confirm','Supprimer les sauvegardes','Confirmation');
    view.busy(true);
    confirm.content.append(element('p','Supprimer définitivement '+picked.length+' sauvegarde(s), soit '+bytes(picked.reduce((total,row)=>total+row.byte_size,0))+' ?'));
    const names=element('ul');for(const row of picked)names.append(element('li',date(row.created_at)+' · '+bytes(row.byte_size)));confirm.content.append(names);
    confirm.content.append(element('p','La campagne ouverte sur cet appareil est conservée. Les versions choisies et leurs fichiers seront effacés en ligne. Si tu supprimes la dernière version, la sauvegarde automatique sera suspendue sur cet appareil.','studio-hint'));
    const actions=element('div',null,'studio-actions');actions.append(button('Annuler',()=>confirm.dialog.close()),button('Supprimer définitivement',async()=>{
      confirm.busy(true);confirm.status.textContent='Suppression des sauvegardes et libération de l’espace…';
      try {
        const result=await cloud.remove({campaignId,ids:picked.map(row=>row.id),expectedRevision:before.revision,
          check:async()=>{if(closed||!isGM())throw Error('Suppression interrompue.')}});
        engine?.removed({campaignId,...account,previousRevision:before.revision,revision:result.catalog.revision,latestDeleted:result.latest_deleted});
        selected.clear();await list();
        status.textContent=result.deleted.length+' sauvegarde(s) supprimée(s). '+(result.cleanupError?
          'Nettoyage des fichiers à terminer : '+result.cleanupError:bytes(result.freedBytes)+' libérés.')+
          (result.latest_deleted?' La sauvegarde automatique est suspendue.':'');
        confirm.dialog.close();
      }catch(error){confirm.status.textContent=cloudError(error).message}
      finally{confirm.busy(false)}
    },'primary'));confirm.content.append(actions);
    confirm.cleanup(()=>{release?.();view.busy(false);renderControls();syncSelection()});
  }
  select.onchange=()=>{releasePreview?.();releasePreview=null;selected.clear();void list()};void load();
}
