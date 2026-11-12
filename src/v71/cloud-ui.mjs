import {button,element,isGM,nativeEditor,notice} from '../v63/ui.mjs';
import {editEvent} from '../v56/link.mjs';
import {createCloud,cloudError} from './cloud.mjs';
import {autoBackup} from './autosave.mjs';
import {campaignRequest} from './campaign-io.mjs';
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
export function mountCloudBackups(view,inspect) {
  const {content,status} = view,section=element('section',null,'cloud-backup-section');section.id='archives-online-backups';
  const heading=element('h3','Sauvegardes en ligne'),state=element('p',stateText(engine?.status()),'studio-status');state.style.whiteSpace='pre-line';
  section.append(heading,element('p','Retrouve la campagne complète sur un autre appareil avec ton compte MJ. Les dix dernières versions sont conservées, avec les secrets et les fichiers privés.','studio-hint'),state);
  const actions=element('div',null,'studio-actions'),accounts=button('Comptes & campagnes',() => {
    view.dialog.close();document.getElementById('archives-cloud-panel')?.classList.add('open');
  }),refresh=button('Actualiser',() => { void load(); });actions.append(accounts,refresh);section.append(actions);
  const label=element('label','Campagne en ligne'),select=element('select');select.id='archives-online-campaign';label.htmlFor=select.id;section.append(label,select);
  const controls=element('div',null,'studio-actions'),enable=button('Activer la sauvegarde automatique',() => { void enableSelected(); },'primary'),save=button('Enregistrer maintenant',() => { void saveNow(); }),pause=button('Suspendre sur cet appareil',() => { engine?.pause();renderControls(); });
  controls.append(enable,save,pause);section.append(controls);
  const hint=element('p','','studio-hint'),versions=element('div',null,'cloud-backup-versions');section.append(hint,versions);
  const createRow=element('div',null,'studio-actions'),name=element('input');name.placeholder='Nom de la nouvelle campagne';name.setAttribute('aria-label','Nom de la nouvelle campagne en ligne');
  createRow.append(name,button('Sauvegarder dans une nouvelle campagne',() => { void create(); }));section.append(createRow);
  const setup=element('details'),summary=element('summary','Activer le stockage (une seule fois)');
  const link=element('a','Afficher le script d’activation');link.href=new URL('../../sql/archives-cloud-backups-v446.sql',import.meta.url).href;link.target='_blank';link.rel='noopener';
  setup.append(summary,element('p','Dans ton projet Supabase, ouvre SQL Editor, colle le script ci-dessous puis clique sur Run. Reviens ensuite ici et clique sur Actualiser. Les campagnes existantes sont conservées.','studio-hint'),link,
    button('Copier le script',async () => {
      try { const response=await fetch(link.href);if(!response.ok)throw Error('Script indisponible.');await navigator.clipboard.writeText(await response.text());status.textContent='Script copié. Colle-le dans SQL Editor de Supabase, puis clique sur Run.'; }
      catch { status.textContent='Ouvre le script d’activation et copie son contenu dans SQL Editor de Supabase.'; }
    }));section.append(setup);content.prepend(section);
  let rows=[],campaigns=[],ctx,closed=false,sequence=0,releasePreview;
  const update=event => { if(!closed){state.textContent=stateText(event.detail);renderControls();} };
  window.addEventListener('archives:cloud-backup-status',update);
  view.cleanup(() => { closed=true;sequence++;releasePreview?.();window.removeEventListener('archives:cloud-backup-status',update); });
  function fail(error) { const value=cloudError(error);status.textContent=value.message;if(value.code==='SETUP')setup.open=true; }
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
    renderControls();
  }
  async function list(generation=++sequence) {
    rows=[];versions.replaceChildren();renderControls();if(!select.value)return;
    try {
      const result=await cloud.versions(select.value);if(closed||generation!==sequence)return;rows=result.rows;
      for(const row of rows) {
        const card=element('article',null,'studio-card');card.dataset.backupId=row.id;
        card.append(element('h4',date(row.created_at)),element('p',(row.summary?.cells || 0)+' cellule(s) · '+(row.summary?.images || 0)+' image(s) · '+bytes(row.byte_size),'studio-hint'),
          button('Ouvrir cette version…',() => { void openVersion(row); }));versions.append(card);
      }
      if(!rows.length)versions.append(element('p','Aucune version en ligne pour cette campagne.','studio-hint'));
    } catch(error){fail(error);renderControls();return false}
    renderControls();return true;
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
      if(latest.rows.length&&!matches())throw Error('Ouvre d’abord une version en ligne de cette campagne.');
      await bind(campaign,matches()?bound.revision:0,matches()?bound.fingerprint:null,matches()?bound.savedAt:null);await list();
    } catch(error){fail(error)}finally{view.busy(false);renderControls()}
  }
  async function saveNow() { view.busy(true);try{await engine.save();await list()}catch(error){fail(error)}finally{view.busy(false);renderControls()} }
  async function create() {
    view.busy(true);status.textContent='Création de la campagne et de sa première sauvegarde…';
    try { const campaign=await cloud.create(name.value);await bind(campaign);name.value='';await load(campaign.id); }
    catch(error){fail(error)}finally{view.busy(false);renderControls()}
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
          if(latest.ctx.user.id!==result.ctx.user.id||latest.ctx.project!==result.ctx.project||latest.rows[0]?.revision!==result.head.revision)
            throw Error('La version en ligne ou le compte a changé. Actualise la liste avant de restaurer.');
        },
        after:async()=>{releasePreview?.();releasePreview=null;await bind(campaign,result.head.revision,null,result.head.created_at);}
      });
    }catch(error){releasePreview?.();releasePreview=null;fail(error)}finally{view.busy(false);renderControls()}
  }
  select.onchange=()=>{releasePreview?.();releasePreview=null;void list()};void load();
}
