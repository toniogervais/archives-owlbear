/* SoundShow — grille sons/vidéos et lecteur à droite du canevas, réservé au MJ. */
import {mountMiniPlayer} from './mini-player.mjs?v=028';
const modes={
  start:'Lecture normale',
  fade_in:'Fondu d’entrée',
  crossfade:'Fondu enchaîné',
  replace:'Remplacer',
  toggle:'Lecture / arrêt',
  toggle_fade:'Lecture / fondu',
  none:'Ne rien faire'
};
const defaults=()=>({left:'start',right:'crossfade',middle:'none',double:'none',shift:'fade_in'});
export function validSoundAction(action){return Object.hasOwn(modes,action)?action:'none';}
export function clickCommand(item,action){
  if(!item||!['sound','video'].includes(item.kind)||item.locked===true)return null;
  const selected=validSoundAction(action);
  return selected==='none'?null:{type:'play_playable',playable_id:item.id,action:selected};
}
function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
}
function safeColor(value){
  return typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:'#c6a56e';
}
function loadPrefs(project){
  try {
    const item=JSON.parse(localStorage.getItem('archives-soundshow-clicks-v1:'+project)||'null')||{};
    return Object.fromEntries(Object.entries(defaults()).map(([key,value])=>[key,
      validSoundAction(item[key])==='none'&&item[key]!=='none'?value:validSoundAction(item[key]??value)]));
  }catch{return defaults();}
}
export function mountSoundDock({send,refresh,isGM}){
  const app=document.getElementById('app');
  const main=document.getElementById('main-area');
  if(!app||!main||typeof send!=='function')return null;
  if(document.getElementById('soundshow-sounds-dock'))return null;
  const css=document.createElement('link');css.rel='stylesheet';
  css.href=new URL('./sounds-dock.css?v=031',import.meta.url).href;
  document.head.append(css);
  let state={connected:false,media:[],active:[],project:''};
  let project='',prefs=defaults(),expanded=false,collapsed=false,category='all',search='',mediaKind='sound',floating=false;
  let panelWidth=370;
  try{panelWidth=Math.round(Math.max(190,Math.min(650,Number(localStorage.getItem('archives-soundshow-width'))||370)));}catch{}
  document.body.style.setProperty('--ss-panel-width',panelWidth+'px');
  let lastSignature='',pendingClicks=new Map(),pendingCommands=new Set(),disposed=false;
  try{collapsed=localStorage.getItem('archives-soundshow-dock-minimized')==='1';}catch{}
  const dock=el('nav');dock.id='soundshow-sounds-dock';dock.setAttribute('aria-label','Barre SoundShow rétractable');
  const fold=el('button','ss-collapse',collapsed?'›':'‹');fold.type='button';
  fold.setAttribute('aria-label',collapsed?'Déployer la barre SoundShow':'Réduire la barre SoundShow');
  fold.title=collapsed?'Déployer les icônes SoundShow':'Réduire les icônes SoundShow';
  const sound=el('button','ss-sound-trigger');sound.type='button';
  sound.title='Sons — grille SoundShow';sound.setAttribute('aria-label','Sons — ouvrir la grille SoundShow');
  sound.setAttribute('aria-controls','soundshow-sounds-panel');
  sound.setAttribute('aria-expanded','false');
  sound.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
  const video=el('button','ss-video-trigger');video.type='button';
  video.title='Vidéos à diffuser chez les joueurs';video.setAttribute('aria-label','Vidéos SoundShow');
  video.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 8 6 4-6 4z"/></svg>';
  const dragButton=el('button','ss-drag-handle','⠿');dragButton.type='button';
  dragButton.setAttribute('aria-label','Déplacer la barre SoundShow');
  dock.prepend(dragButton);dock.append(sound,video,fold);document.body.append(dock);
  const panel=el('aside');panel.id='soundshow-sounds-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Grille des sons SoundShow');
  const header=el('div','ss-head');const title=el('h2',null,'Sons SoundShow');
  const close=el('button','ss-close','×');close.type='button';close.setAttribute('aria-label','Fermer la grille des sons');close.title='Fermer le panneau';
  const floatButton=el('button','ss-float-toggle','↗');floatButton.type='button';
  floatButton.title='Détacher ou ancrer le panneau';floatButton.setAttribute('aria-label','Détacher le panneau SoundShow');
  const actionsHead=el('div','ss-head-actions');actionsHead.append(floatButton,close);
  header.append(title,actionsHead);
  const status=el('p','ss-status');status.setAttribute('role','status');status.textContent='Connexion SoundShow en cours…';
  const resizer=el('div','ss-resize-handle');resizer.title='Redimensionner la fenêtre SoundShow';resizer.setAttribute('aria-label','Ajuster la largeur du panneau SoundShow');
  const playerHost=el('div','ss-player-host');
  const controls=el('div','ss-controls');
  const searchBox=el('input','ss-search');
  searchBox.type='search';searchBox.placeholder='Rechercher un son…';
  searchBox.setAttribute('aria-label','Rechercher un son');
  controls.append(searchBox);
  const categories=el('nav','ss-category-strip');categories.setAttribute('aria-label','Catégories SoundShow');
  const scroll=el('div','ss-content');const grid=el('div','ss-grid');grid.setAttribute('aria-label','Grille des sons');
  scroll.append(grid);
  const settings=el('details','ss-advanced');
  const summary=el('summary',null,'Préférences des clics');
  const fields=el('div','ss-settings');
  const fieldNames=[['left','Clic gauche / tactile'],['right','Clic droit'],['middle','Clic du milieu'],['double','Double clic'],['shift','Maj + clic gauche']];
  const selects=new Map();
  for(const [key,label] of fieldNames){
    const wrapper=el('label',null,label),select=el('select');
    select.setAttribute('aria-label',label);
    for(const [value,text] of Object.entries(modes)){
      const option=el('option',null,text);option.value=value;select.append(option);
    }
    select.onchange=()=>{
      prefs[key]=validSoundAction(select.value);
      try{localStorage.setItem('archives-soundshow-clicks-v1:'+project,JSON.stringify(prefs));}catch{}
    };
    selects.set(key,select);wrapper.append(select);fields.append(wrapper);
  }
  const hint=el('p','ss-help','Les boucles, fondus, volumes et sorties audio restent ceux du projet SoundShow. Les actions attribuées aux clics dans Les Archives sont enregistrées uniquement ici.');
  settings.append(summary,fields,hint);
  panel.append(resizer,header,status,playerHost,controls,categories,scroll,settings);
  app.append(panel);
  const miniPlayer=mountMiniPlayer(playerHost,{send,isGM,readState:()=>state});
  function clamp(x,min,max){return Math.max(min,Math.min(max,x));}
  function setWidth(width){
    panelWidth=Math.round(clamp(width,190,Math.min(680,Math.max(200,app.clientWidth-(document.getElementById('sidebar')?.offsetWidth||0)-(document.getElementById('sidebar-resizer')?.offsetWidth||0)-270))));
    document.body.style.setProperty('--ss-panel-width',panelWidth+'px');
    try{localStorage.setItem('archives-soundshow-width',String(panelWidth));}catch{}
    resetView();
  }
  function positionDock(x,y){
    dock.classList.add('ss-moved');dock.style.right='auto';
    dock.style.left=clamp(x,2,Math.max(2,innerWidth-dock.offsetWidth-4))+'px';
    dock.style.top=clamp(y,2,Math.max(2,innerHeight-dock.offsetHeight-4))+'px';
  }
  function saveDock(){
    try{localStorage.setItem('archives-soundshow-dock-location',JSON.stringify({
      x:parseFloat(dock.style.left),y:parseFloat(dock.style.top),
      horizontal:dock.classList.contains('ss-horizontal')
    }));}catch{}
  }
  try{
    const saved=JSON.parse(localStorage.getItem('archives-soundshow-dock-location')||'null');
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
      dock.classList.toggle('ss-horizontal',saved.horizontal===true);
      positionDock(saved.x,saved.y);
    }
  }catch{}
  function draggable(handle,target,{dockHandle=false}={}){
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!isGM?.()||(dockHandle&&event.target.closest('button')!==handle)||(!dockHandle&&event.target.closest('button')))return;
      event.preventDefault();
      const rect=target.getBoundingClientRect(),fromX=event.clientX,fromY=event.clientY;
      handle.setPointerCapture?.(event.pointerId);
      const move=ev=>{
        if(dockHandle){
          positionDock(rect.left+ev.clientX-fromX,rect.top+ev.clientY-fromY);
        }else{
          if(!floating)floatWindow(rect);
          panel.style.left=clamp(rect.left+ev.clientX-fromX,0,innerWidth-120)+'px';
          panel.style.top=clamp(rect.top+ev.clientY-fromY,0,innerHeight-90)+'px';
        }
      };
      const finish=()=>{
        handle.removeEventListener('pointermove',move);
        handle.removeEventListener('pointerup',finish);
        handle.removeEventListener('pointercancel',finish);
        if(dockHandle){
          const r=dock.getBoundingClientRect();
          const cx=r.left+r.width/2,cy=r.top+r.height/2;
          const horizontal=Math.min(cy,innerHeight-cy)<Math.min(cx,innerWidth-cx);
          dock.classList.toggle('ss-horizontal',horizontal);
          positionDock(cx-dock.offsetWidth/2,cy-dock.offsetHeight/2);
          saveDock();
        }
      };
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    });
  }
  function floatWindow(rect=panel.getBoundingClientRect()){
    if(floating)return;
    floating=true;panel.classList.add('ss-floating');document.body.append(panel);
    const w=Math.round(Math.max(250,Math.min(680,rect.width)));
    panel.style.left=clamp(rect.left,0,innerWidth-130)+'px';panel.style.top=clamp(rect.top,0,innerHeight-120)+'px';
    panel.style.setProperty('--ss-float-width',w+'px');
    panel.style.setProperty('--ss-float-height',clamp(Math.round(rect.height*.75),320,innerHeight-24)+'px');
    document.body.classList.remove('soundshow-sounds-open');floatButton.textContent='↙';floatButton.setAttribute('aria-label','Ancrer le panneau à droite du canevas');
    resetView();
  }
  function anchorWindow(){
    if(!floating)return;
    floating=false;panel.classList.remove('ss-floating');panel.removeAttribute('style');app.append(panel);
    if(expanded)document.body.classList.add('soundshow-sounds-open');
    floatButton.textContent='↗';floatButton.setAttribute('aria-label','Détacher le panneau SoundShow');
    resetView();
  }
  floatButton.onclick=()=>floating?anchorWindow():floatWindow();
  draggable(dragButton,dock,{dockHandle:true});
  draggable(header,panel);
  resizer.addEventListener('pointerdown',event=>{
    if(event.button!==0||floating)return;event.preventDefault();
    const start=event.clientX,initial=panelWidth;resizer.setPointerCapture?.(event.pointerId);
    const move=ev=>setWidth(initial+start-ev.clientX);
    const done=()=>{resizer.removeEventListener('pointermove',move);resizer.removeEventListener('pointerup',done);};
    resizer.addEventListener('pointermove',move);resizer.addEventListener('pointerup',done);
  });
  function resetView(){
    // Resize the flex canvas; recenter the whole diagram rather than clipping nodes.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!disposed&&isGM?.())try{window.DuneApp?.resetView?.();}catch{}
    }));
  }
  function setExpanded(value){
    if(disposed||!isGM?.())return;
    expanded=!!value;
    panel.hidden=!expanded;
    document.body.classList.toggle('soundshow-sounds-open',expanded&&!floating);
    sound.setAttribute('aria-expanded',String(expanded));
    sound.setAttribute('aria-pressed',String(expanded));
    if(expanded&&collapsed)toggleFold(false);
    if(expanded)void refresh?.();
    resetView();
  }
  function toggleFold(value){
    if(disposed||!isGM?.())return;
    collapsed=!!value;
    dock.classList.toggle('ss-is-collapsed',collapsed);
    fold.textContent=collapsed?'›':'‹';
    fold.setAttribute('aria-label',collapsed?'Déployer la barre SoundShow':'Réduire la barre SoundShow');
    fold.title=fold.getAttribute('aria-label');
    if(collapsed)setExpanded(false);
    try{localStorage.setItem('archives-soundshow-dock-minimized',collapsed?'1':'0');}catch{}
  }
  fold.onclick=()=>toggleFold(!collapsed);
  sound.onclick=()=>{mediaKind='sound';setExpanded(true);renderCats();renderGrid();};
  video.onclick=()=>{mediaKind='video';setExpanded(true);renderCats();renderGrid();};
  close.onclick=()=>setExpanded(false);
  dock.classList.toggle('ss-is-collapsed',collapsed);
  searchBox.addEventListener('input',()=>{search=searchBox.value;renderGrid();});
  function renderCats(){
    const seen=new Map();
    for(const item of state.media||[]){
      if(item.kind!==mediaKind)continue;
      if(!seen.has(item.categoryId))seen.set(item.categoryId,item.category||'Sans catégorie');
    }
    if(category!=='all'&&!seen.has(category))category='all';
    const make=(id,label)=>{
      const button=el('button','ss-category',label);button.type='button';
      button.setAttribute('aria-pressed',String(category===id));
      button.onclick=()=>{category=id;renderCats();renderGrid();};
      return button;
    };
    categories.replaceChildren(make('all',mediaKind==='sound'?'Tous les sons':'Toutes les vidéos'),...[...seen.entries()].map(([id,label])=>make(id,label)));
  }
  function updatePrefs(){
    for(const [key,select] of selects)select.value=prefs[key];
  }
  function report(message){
    status.textContent=message;status.title=message;
  }
  async function run(item,action){
    const command=clickCommand(item,action);
    if(!command||!state.connected||!isGM?.()||disposed)return;
    if(pendingCommands.has(item.id))return;
    pendingCommands.add(item.id);
    const tile=Array.from(grid.querySelectorAll('button.ss-tile')).find(e=>e.dataset.id===item.id);
    if(tile)tile.setAttribute('aria-busy','true');
    report('Commande « '+item.name+' » envoyée à SoundShow…');
    try{
      const result=await send(command);
      if(disposed)return;
      report(result?.message||'Commande transmise à SoundShow ; lecture en attente de confirmation.');
      if(result?.state)update(result.state);
    }catch(error){if(!disposed)report(error?.message||'Lecture impossible : vérifie SoundShow.');}
    finally{
      pendingCommands.delete(item.id);
      if(tile?.isConnected)tile.removeAttribute('aria-busy');
    }
  }
  function cancelPending(itemId){
    const timeout=pendingClicks.get(itemId);
    if(timeout){clearTimeout(timeout);pendingClicks.delete(itemId);}
  }
  function makeTile(item){
    const tile=el('button','ss-tile');tile.type='button';
    tile.dataset.id=item.id;tile.style.setProperty('--ss-tile-color',safeColor(item.color||item.categoryColor));
    const running=(state.active||[]).filter(player=>player.source===item.id&&player.kind===mediaKind);
    const active=running.length>0||item.playing===true;
    if(active)tile.classList.add('ss-playing');
    tile.disabled=!state.connected||item.locked===true;
    tile.title=item.name+(item.locked?' · Verrouillé dans SoundShow':' · Clic gauche : '+modes[prefs.left]+' · Clic droit : '+modes[prefs.right]);
    tile.setAttribute('aria-label',item.name+(active?' — en cours de lecture':'')+(item.locked?' — verrouillé':''));
    tile.append(el('span','ss-tile-name',item.name));
    const foot=el('span','ss-tile-foot');
    foot.append(el('span',null,active?'● Lecture':item.locked?'🔒 Verrouillé':'♫ Son'));
    if(item.playCount>0)foot.append(el('span',null,'×'+item.playCount));
    tile.append(foot);
    tile.onclick=event=>{
      if(event.button!==0||event.defaultPrevented||item.locked||!state.connected)return;
      const key=event.shiftKey?'shift':'left';
      const action=prefs[key];
      if(!event.shiftKey&&prefs.double!=='none'){
        cancelPending(item.id);
        const timer=setTimeout(()=>{pendingClicks.delete(item.id);void run(item,action);},260);
        pendingClicks.set(item.id,timer);
      }else void run(item,action);
    };
    tile.ondblclick=event=>{
      event.preventDefault();cancelPending(item.id);
      if(prefs.double!=='none')void run(item,prefs.double);
    };
    tile.oncontextmenu=event=>{
      event.preventDefault();cancelPending(item.id);
      void run(item,prefs.right);
    };
    tile.onauxclick=event=>{
      if(event.button!==1)return;
      event.preventDefault();cancelPending(item.id);
      void run(item,prefs.middle);
    };
    tile.onmousedown=event=>{if(event.button===1)event.preventDefault();};
    return tile;
  }
  function renderGrid(){
    if(disposed)return;
    const visible=(state.media||[]).filter(item=>item.kind===mediaKind&&
      (category==='all'||item.categoryId===category)&&
      (item.name+' '+item.category).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
    grid.replaceChildren();
    if(!visible.length){
      grid.append(el('p','ss-empty',state.connected?'Aucun média dans cette catégorie.':'Connecte SoundShow pour afficher les médias.'));
      return;
    }
    const limit=visible.slice(0,300);
    for(const item of limit)grid.append(makeTile(item));
    if(visible.length>limit.length)grid.append(el('p','ss-empty','Affichage limité aux 300 premiers sons ; utilise la recherche.'));
  }
  function update(value){
    if(disposed||!value||typeof value!=='object')return;
    const incoming={
      connected:value.connected===true,
      project:String(value.project||'').slice(0,160),
      media:Array.isArray(value.media)?value.media.slice(0,500):[],
      active:Array.isArray(value.active)?value.active.slice(0,100):[]
    };
    const changedProject=project!==incoming.project;
    const sig=JSON.stringify(incoming);
    if(sig===lastSignature)return;
    lastSignature=sig;state=incoming;
    if(changedProject){project=incoming.project;prefs=loadPrefs(project);updatePrefs();category='all';}
    report(state.connected?(project||'SoundShow')+' · '+state.media.filter(e=>e.kind===mediaKind).length+(mediaKind==='sound'?' sons':' vidéos')+' disponibles':'SoundShow non relié — ouvre Owlbear depuis le connecteur Windows.');
    renderCats();renderGrid();miniPlayer.update(value);
  }
  function visibility(){
    const visible=!!isGM?.();
    dock.hidden=!visible;
    if(!visible&&expanded){expanded=false;panel.hidden=true;document.body.classList.remove('soundshow-sounds-open');}
  }
  const observer=new MutationObserver(visibility);
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  visibility();
  const timer=setInterval(()=>{if(expanded&&isGM?.())void refresh?.();},9000);
  return {
    update,
    open:()=>setExpanded(true),
    close:()=>setExpanded(false),
    isOpen:()=>expanded,
    destroy(){
      disposed=true;clearInterval(timer);observer.disconnect();
      for(const timeout of pendingClicks.values())clearTimeout(timeout);
      pendingClicks.clear();
      miniPlayer.destroy();panel.remove();dock.remove();css.remove();
      document.body.classList.remove('soundshow-sounds-open');
    }
  };
}
