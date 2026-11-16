import {button,element,isGM,nativeEditor,notice,sheet} from '../v63/ui.mjs?v=4560';
import {editEvent} from '../v56/link.mjs?v=4560';
import {createCloud,cloudError} from './cloud.mjs?v=4560';
import {autoBackup} from './autosave.mjs?v=4560';
import {campaignRequest} from './campaign-io.mjs?v=4560';
import {downloadArchive} from './download.mjs';
import {mountAccount} from '../v78/cloud-account.mjs?v=4560';
const cloud = createCloud(() => {
  if (!isGM()) throw Error('Commande réservée au maître de jeu.');
  if (!window.ArchivesCloudBridge) throw Error('Ouvre « Comptes & campagnes » pour connecter ton compte MJ.');
  return window.ArchivesCloudBridge.getClient();
},{onProgress:detail=>window.dispatchEvent(new CustomEvent('archives:backup-progress',{detail}))});
const labels = {off:'Enregistrement manuel',pending:'Modifications en attente d’envoi',saving:'Enregistrement en ligne…',saved:'Enregistré en ligne',error:'Envoi en attente — copie conservée sur cet appareil',conflict:'Une version plus récente existe en ligne'};
let engine,scope,interval,releaseRestore;
function dismissChoice(){document.getElementById('archives-autosave-choice')?.remove()}
const date = value => value ? new Date(value).toLocaleString('fr-FR') : '';
const bytes = value => (value/1024/1024).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
function stateText(state) {
  return (labels[state?.state] || labels.off)+(state?.binding?.savedAt ? ' · Dernière copie : '+date(state.binding.savedAt) : '')+(state?.message ? '\n'+state.message : '');
}
function start(value) {
  if (!isGM() || !value || scope === value) return;
  dismissChoice();engine?.dispose();clearInterval(interval);scope = value;
  const key = 'archives-cloud-backup-v446:'+scope;
  let previousBinding;
  engine = autoBackup({cloud,
    read:() => { try { const saved=JSON.parse(localStorage.getItem(key)||'null');previousBinding=saved && typeof saved.campaignId==='string' && Number.isSafeInteger(saved.revision) ? saved : null;return previousBinding?{...previousBinding,enabled:false}:null; } catch { return null; } },
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
  engine.pause();
  // Every opening starts in manual mode. Automatic saving is an explicit option inside Sauvegardes.
  // The regular check also catches changes to IndexedDB libraries and framing
  // which do not emit the canvas edit event. Identical exports never re-upload.
  interval = setInterval(() => { if (isGM() && !document.hidden) void engine.save(); },60000);
  engine.change();
}
export function pauseCloudBackup() { dismissChoice();engine?.pause(); }
export function installCloudBackup() {
  if (!isGM()) return;
  if (nativeEditor()) {
    if (window.ArchivesCampaignScope) start(window.ArchivesCampaignScope);
    window.addEventListener('archives:campaign-context',event => start(event.detail));
  } else if (window.parent === window) start('standalone');
  window.addEventListener(editEvent,() => { if (isGM()) engine?.change(); });
  window.addEventListener('archives:reserve-changed',() => { if(isGM())engine?.change(); });
  window.addEventListener('archives:scenario-replaced',() => { if(isGM())pauseCloudBackup(); });
  window.addEventListener('online',() => { if (isGM()) void engine?.save(); });
  window.addEventListener('focus',() => { if (isGM()) void engine?.save(); });
  document.addEventListener('visibilitychange',() => { if (isGM()) void engine?.save(); });
  window.addEventListener('pagehide',() => { engine?.dispose();clearInterval(interval); });
  window.addEventListener('archives:restore-begin',() => { releaseRestore=engine?.hold(); });
  window.addEventListener('archives:restore-end',() => { releaseRestore?.();releaseRestore=null; });
  const title = document.querySelector('#archives-cloud-launch-title');
  if (title && window.parent===window) {
    const open=button('☁ Retrouver ma session',() => window.ArchivesWorkbench?.openBackup(),title.className);open.id='archives-cloud-backups-title';title.insertAdjacentElement('afterend',open);
  }
}
export function mountCloudBackups(view,inspect,{localDownload}={}) {
  const {content,status} = view,section=element('section',null,'cloud-backup-section');section.id='archives-online-backups';
  const heading=element('h3','Enregistrer ma session complète'),state=element('p',stateText(engine?.status()),'studio-status');state.style.whiteSpace='pre-line';
  section.append(heading,element('p','Retrouve la campagne complète sur un autre appareil avec ton compte MJ. Cellules, actes, images originales, bibliothèques, réserve, secrets et journal sont inclus. L’enregistrement se fait quand tu le décides.','studio-hint'),state);
  const account=mountAccount(view,()=>load(select.value)),actions=element('div',null,'studio-actions backup-primary-actions'),refresh=button('Actualiser',() => { void load(); });
  section.append(actions);
  const label=element('label','Session à retrouver'),select=element('select');select.id='archives-online-campaign';label.htmlFor=select.id;section.append(label,select);
  const controls=element('div',null,'studio-actions'),enable=button('Activer la sauvegarde automatique',() => { void enableSelected(); }),save=button('Enregistrer en ligne',() => { void saveNow(); },'primary'),pause=button('Suspendre sur cet appareil',() => { engine?.pause();renderControls(); });
  save.id='archives-save-online';actions.append(save);if(localDownload)actions.append(localDownload);
  const resume=button('Reprendre la dernière sauvegarde',()=>{if(rows[0])void openVersion(rows[0])},'primary');resume.id='archives-resume-online';section.append(resume);
  controls.append(enable,pause);
  const more=element('details',null,'backup-more');more.id='archives-backup-more';more.append(element('summary','Versions précédentes et autres options'),controls);section.append(more);
  const hint=element('p','','studio-hint'),versions=element('div',null,'cloud-backup-versions');section.append(hint);more.append(versions);
  const selection=element('div',null,'studio-actions'),selectedCount=element('span'),selectAll=button('Tout sélectionner',()=>{
    const all=rows.length>0&&rows.every(row=>selected.has(row.id));selected.clear();if(!all)rows.forEach(row=>selected.add(row.id));syncSelection();
  }),remove=button('Supprimer la sélection',()=>{void removeSelected()});
  remove.id='archives-delete-backups';selection.append(selectAll,remove,selectedCount);versions.before(selection);
  const space=element('p','','studio-hint'),clean=button('Libérer l’espace restant',()=>{void cleanPending()});selection.before(space);selection.after(clean);
  clean.hidden=true;
  const createRow=element('div',null,'studio-actions'),name=element('input');name.placeholder='Nom de la nouvelle campagne';name.setAttribute('aria-label','Nom de la nouvelle campagne en ligne');
  name.id='archives-backup-name';name.placeholder='Nom de ma session';const nameLabel=element('label','Nom de ma session');nameLabel.htmlFor=name.id;heading.after(nameLabel,name);
  createRow.append(button('Sauvegarder dans une nouvelle campagne',() => { void create(); }));more.firstElementChild.after(createRow);
  const setup=element('details'),summary=element('summary','Activer ou mettre à jour le stockage');
  const link=element('a','Ouvrir le script SQL');link.href=new URL('../../sql/archives-cloud-backups-v449.sql',import.meta.url).href;link.target='_blank';link.rel='noopener';
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
    button('Afficher le script',()=>{void showScript()}),button('Copier le script',()=>{void showScript(true)}),script);more.append(setup);section.append(account.node,refresh);content.prepend(section);
  let rows=[],campaigns=[],ctx,closed=false,working=false,loading=true,sequence=0,releasePreview,catalog={revision:0,canDelete:false,cleanupPending:0,cleanupBytes:0};
  const selected=new Set();
  const update=event => { if(!closed){state.textContent=stateText(event.detail);state.dataset.state=event.detail.state;renderControls();} };
  state.setAttribute('role','status');state.dataset.state=engine?.status().state||'off';
  const progress=event=>{if(!closed&&working){const p=event.detail;status.textContent=(p.operation==='download'?'Récupération':'Enregistrement')+' : '+bytes(p.loaded)+' / '+bytes(p.total)+' · '+Math.round(p.loaded/p.total*100)+' %';}};
  window.addEventListener('archives:backup-progress',progress);
  window.addEventListener('archives:cloud-backup-status',update);
  view.cleanup(() => { closed=true;sequence++;releasePreview?.();window.removeEventListener('archives:cloud-backup-status',update);window.removeEventListener('archives:backup-progress',progress);account.dispose(); });
  function fail(error) { const value=cloudError(error);status.textContent=value.message;status.dataset.result='error';if(value.code==='SETUP'){more.open=true;setup.open=true;}else if(!ctx||/connect|compte|clé|projet|session/i.test(value.message))account.open(); }
  function busy(value){working=value;view.busy(value);}
  function confirmed(result){const value=result||engine?.status();if(!['saved','pending'].includes(value?.state)||!value.binding?.savedAt){const error=Error(value?.message||'L’enregistrement en ligne n’a pas été confirmé. Ta session reste sur cet appareil.');error.code=value?.state==='conflict'?'CONFLICT':undefined;throw error;}return value;}
  function syncSelection() {
    for(const input of versions.querySelectorAll('input[data-select-backup]'))input.checked=selected.has(input.dataset.selectBackup);
    const picked=rows.filter(row=>selected.has(row.id));
    remove.disabled=working||!picked.length;remove.textContent='Supprimer la sélection'+(picked.length?' ('+picked.length+')':'');
    selectedCount.textContent=picked.length+' sélectionnée(s) · '+bytes(picked.reduce((total,row)=>total+row.byte_size,0));
    selectAll.disabled=working||!rows.length;selectAll.textContent=rows.length&&picked.length===rows.length?'Tout désélectionner':'Tout sélectionner';
    space.textContent=rows.length+' sauvegarde(s) · '+bytes(rows.reduce((total,row)=>total+row.byte_size,0))+' pour cette campagne'+
      (catalog.cleanupPending?' · '+bytes(catalog.cleanupBytes)+' restant à libérer':'');
    clean.hidden=!catalog.cleanupPending;
  }
  function matches() { const bound=engine?.binding();return bound && bound.project===ctx?.project && bound.owner===ctx?.user.id && bound.campaignId===select.value; }
  function renderControls() {
    const bound=engine?.binding(),active=matches() && bound.enabled;
    enable.hidden=!!active;enable.disabled=working||!ctx || !select.value || (!!rows.length && !matches());
    save.hidden=false;save.disabled=working||loading;pause.hidden=!active;resume.disabled=working||!rows.length;
    resume.hidden=!rows.length;label.hidden=!campaigns.length;select.hidden=!campaigns.length;
    hint.textContent=rows.length&&!matches() ? 'Choisis « Reprendre la dernière sauvegarde » pour continuer cette session. Pour conserver ton canevas actuel séparément, utilise « Sauvegarder dans une nouvelle campagne » dans les autres options.' : matches()&&!active?'Sauvegarde automatique désactivée pour cette ouverture. Tu peux enregistrer manuellement.':'';
  }
  async function load(preferred) {
    const generation=++sequence;loading=true;renderControls();versions.replaceChildren();rows=[];select.replaceChildren(new Option('Choisir une campagne…',''));
    try {
      const result=await cloud.campaigns();if(closed||generation!==sequence)return;
      ctx=result.ctx;campaigns=result.rows;
      for(const item of campaigns)select.append(new Option(item.name || 'Campagne sans nom',item.id));
      const bound=engine?.binding();select.value=preferred || (bound?.project===ctx.project && bound?.owner===ctx.user.id ? bound.campaignId : campaigns.length===1 ? campaigns[0].id : '');
      const loaded=await list(generation);if(loaded!==false){status.textContent='Connecté avec '+ctx.user.email+'. Enregistre ta session ou reprends sa dernière sauvegarde.';account.close();if(!name.value)name.value=bound?.name||campaigns.find(c=>c.id===select.value)?.name||window.DuneApp?.getState?.().boards?.[0]?.name||'Ma session Archives';}
    } catch(error){
      ctx=null;fail(error);
      // Keep the current campaign and its retry/pause actions accessible offline.
      // This display context never authenticates a request: cloud rechecks Auth.
      const bound=engine?.binding();
      if(bound){ctx={project:bound.project,user:{id:bound.owner}};select.append(new Option(bound.name || 'Campagne de cet appareil',bound.campaignId));select.value=bound.campaignId;}
    }
    loading=false;renderControls();syncSelection();
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
      if(!rows.length)versions.append(element('p','Aucune version en ligne pour cette session. Clique sur « Enregistrer en ligne » pour créer la première.','studio-hint'));
    } catch(error){fail(error);renderControls();syncSelection();return false}
    renderControls();syncSelection();return true;
  }
  async function bind(campaign,revision=0,fingerprint=null,savedAt=null,options={automatic:false}) {
    if(!engine)throw Error('La campagne est en cours d’ouverture. Réessaie dans un instant.');
    const current=await cloud.context();
    dismissChoice();return engine.bind({campaignId:campaign.id,name:campaign.name,owner:current.user.id,project:current.project,revision,fingerprint,savedAt},options);
  }
  async function enableSelected() {
    busy(true);
    try {
      const campaign=campaigns.find(item=>item.id===select.value);if(!campaign)throw Error('Choisis une campagne.');
      const latest=await cloud.versions(campaign.id),bound=engine?.binding();
      if(latest.rows.length&&(!matches()||bound.revision!==latest.revision))throw Error('Ouvre d’abord une version en ligne de cette campagne.');
      const resume=matches()&&latest.rows.length>0;
      confirmed(await bind(campaign,latest.revision,resume?bound.fingerprint:null,resume?bound.savedAt:null,{automatic:true}));await list();status.textContent='Sauvegarde automatique activée pour cette ouverture.';
    } catch(error){fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function saveNow() {
    if(working)return;busy(true);status.dataset.result='';status.textContent='Préparation de la session complète et de ses fichiers…';
    try {
      await cloud.context();let result;
      if(matches())result=await engine.manualSave();
      else {
        let campaign=campaigns.find(c=>c.id===select.value);
        if(campaign&&rows.length)throw Error('Reprends d’abord la dernière sauvegarde de cette session, ou enregistre ton canevas comme nouvelle campagne dans les autres options.');
        if(!campaign){campaign=await cloud.create(name.value.trim()||window.DuneApp?.getState?.().boards?.[0]?.name||'Ma session Archives');}
        result=await bind(campaign,catalog.revision||0);
        await load(campaign.id);
      }
      const saved=confirmed(result);await list();
      status.dataset.result='saved';status.textContent='Session complète enregistrée en ligne le '+date(saved.binding.savedAt)+'. Tu peux la reprendre sur un autre appareil avec le même compte MJ.';
    }catch(error){fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function create() {
    busy(true);status.textContent='Création de la campagne et de sa première sauvegarde…';
    try { const campaign=await cloud.create(name.value.trim()||'Ma session Archives');const result=await bind(campaign);await load(campaign.id);const saved=confirmed(result);status.dataset.result='saved';status.textContent='Session complète enregistrée en ligne le '+date(saved.binding.savedAt)+'.'; }
    catch(error){fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function openVersion(row) {
    if(engine?.status().state==='saving'){status.textContent='Attends la fin de l’enregistrement avant d’ouvrir une version.';return}
    releasePreview?.();releasePreview=engine?.hold();busy(true);status.textContent='Téléchargement et vérification de la version privée…';
    const campaign=campaigns.find(item=>item.id===row.campaign_id);
    try {
      const result=await cloud.download(row.campaign_id,row.id,async()=>{if(closed||!isGM())throw Error('Ouverture interrompue.');});
      await inspect({action:'inspect',file:result.blob},{
        before:async()=>{
          const latest=await cloud.versions(row.campaign_id);
          if(latest.ctx.user.id!==result.ctx.user.id||latest.ctx.project!==result.ctx.project||latest.revision!==result.revision)
            throw Error('La version en ligne ou le compte a changé. Actualise la liste avant de restaurer.');
        },
        cancelled:()=>{releasePreview?.();releasePreview=null;},
        after:async()=>{releasePreview?.();releasePreview=null;await bind(campaign,result.revision,result.head.fingerprint,result.head.created_at,{automatic:false,save:false});}
      });
    }catch(error){releasePreview?.();releasePreview=null;fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function downloadVersion(row) {
    busy(true);status.textContent='Téléchargement de la sauvegarde vérifiée…';
    try{const result=await cloud.download(row.campaign_id,row.id);if(closed)return;
      const campaign=campaigns.find(item=>item.id===row.campaign_id);
      downloadArchive(result.blob,(campaign?.name || 'Campagne_Archives')+'_version_'+row.revision+'_'+row.created_at);
      status.textContent='Fichier .archives téléchargé : '+bytes(result.blob.size)+'.';
    }catch(error){fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function cleanPending() {
    busy(true);status.textContent='Suppression des fichiers en attente…';
    try{const result=await cloud.cleanup(select.value);await list();status.textContent=bytes(result.freedBytes)+' libérés.'}
    catch(error){fail(error)}finally{busy(false);renderControls();syncSelection()}
  }
  async function removeSelected() {
    const picked=rows.filter(row=>selected.has(row.id));if(!picked.length)return;
    if(!catalog.canDelete){setup.open=true;status.textContent='Exécute le script de mise à jour Supabase ci-dessous pour activer la suppression.';return}
    if(engine?.status().state==='saving'){status.textContent='Attends la fin de l’enregistrement avant de supprimer une sauvegarde.';return}
    const before=catalog,campaignId=select.value,account={owner:ctx.user.id,project:ctx.project};
    const release=engine?.hold(),confirm=sheet('archives-delete-backup-confirm','Supprimer les sauvegardes','Confirmation');
    busy(true);
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
    confirm.cleanup(()=>{release?.();busy(false);renderControls();syncSelection()});
  }
  select.onchange=()=>{releasePreview?.();releasePreview=null;selected.clear();const campaign=campaigns.find(c=>c.id===select.value);if(campaign)name.value=campaign.name;void list()};void load();
}
