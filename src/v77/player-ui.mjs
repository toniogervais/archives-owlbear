import {installPlayerNotebook} from '../v64/player-notebook.mjs?v=4590';
import {isPacket} from '../v56/link.mjs?v=4590';
import {dockPosition} from './geometry.mjs?v=4590';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const player=()=>{const s=window.DuneApp?.getState?.();return !!s&&(s.playerMode||s.strictReadOnly)};
const icons={eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[name]);svg.append(path);return svg}
function button(label,text,handler){const b=el('button',null,text);b.type='button';b.setAttribute('aria-label',label);b.title=label;b.onclick=handler;return b}
function viewport(){const v=window.visualViewport,css=getComputedStyle(document.documentElement),safe=edge=>parseFloat(css.getPropertyValue('--player-safe-'+edge))||0;return {left:(v?.offsetLeft||0)+safe('left'),top:(v?.offsetTop||0)+safe('top'),width:(v?.width||innerWidth)-safe('left')-safe('right'),height:(v?.height||innerHeight)-safe('top')-safe('bottom')}}
const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
const defaults=()=>({hidden:false,toolbar:{x:innerWidth>700?1:.5,y:innerWidth>700?.5:1,vertical:innerWidth>700,collapsed:false},toggle:{x:1,y:0}});
function install(){
 if(!window.DuneApp)return;const api=window.DuneApp,originals=new Map();installPlayerNotebook();let active=false,storageKey='',visibilityKey='',prefs=defaults(),arranging=false,queued=false,layoutFrame=0,owlControl,fittedCamera=null,lastViewport=viewport(),lastOrientation=orientation();
 const root=el('div');root.id='archives-player-tools';root.hidden=true;
 const toggle=button('Masquer les icônes','',()=>{const refit=isFitted();prefs.hidden=!prefs.hidden;if(prefs.hidden)setArrange(false);else prefs.toolbar.collapsed=false;paint();save();if(refit)fitView()});toggle.id='archives-player-icons-toggle';toggle.append(icon('eye'));
 const toggleCaption=el('span',null,'Icônes');toggle.append(toggleCaption);
 const arrange=button('Déplacer mes cellules','✥',()=>setArrange(!arranging));
 arrange.id='archives-player-arrange';arrange.className='player-command player-arrange-toggle';arrange.setAttribute('aria-pressed','false');
 const toolbar=makeBar('toolbar','des joueurs');
 toolbar.node.setAttribute('aria-label','Barre d’icônes des joueurs');
 root.append(toolbar.node,toggle);document.body.append(root);
 // These buttons move between the original GM dock and the single player bar.
 // Resolve the current API at activation instead of depending on inline handlers.
 root.addEventListener('click',event=>{
  if(!active||!player())return;const control=event.target.closest?.('button');if(!control||control.disabled)return;
  const live=window.DuneApp,handlers={
   'quick-player-center-cell':()=>{live.centerOnSelectedCell();live.setCanvasCamera(camera(),true)},
   'quick-player-layout':()=>{live.autoLayout();live.setCanvasCamera(camera(),true);fittedCamera=camera();save()},
   'quick-player-center-all':fitView,
   'quick-player-journal':()=>live.openJournal(),
   'quick-player-notes':()=>window.ArchivesPlayerNotebook?.open(),
   'archives-dossier-open':()=>window.ArchivesWorkbench?.openDossier(),
   'quick-grid-toggle':()=>window.ArchivesCanvasGrid?.toggle(),
   'quick-player-undo':()=>live.undo()
  };
  const handler=handlers[control.id];if(!handler)return;event.preventDefault();event.stopImmediatePropagation();live.closeContextMenus();handler();
 },true);

 function makeBar(id,caption){
  const node=el('nav','archives-player-dock');node.id='archives-player-'+id+'-bar';node.setAttribute('aria-label','Barre '+caption);
  const grip=button('Déplacer la barre '+caption,'⠿',()=>{});grip.className='player-bar-grip';
  const actions=el('div','player-bar-actions'),collapse=button('Réduire la barre '+caption,'−',()=>{const refit=isFitted();prefs[id].collapsed=!prefs[id].collapsed;paint();save();if(refit)fitView()});collapse.className='player-bar-collapse';
  node.append(grip,actions,collapse);movable(grip,node,id);return {node,actions,collapse,caption};
 }
 function camera(){const s=api.getState();return {panX:s.panX,panY:s.panY,zoom:s.zoom}}
 function isFitted(){const c=camera();return fittedCamera&&['panX','panY','zoom'].every(key=>Math.abs(c[key]-fittedCamera[key])<1e-9)}
 function fitView(){api.resetView();api.setCanvasCamera(camera(),true);fittedCamera=camera();save()}
 function sourceScope(){const params=new URLSearchParams(location.search);return window.ArchivesPlayerScope||((api.getState().strictReadOnly?'player:':'preview:')+(api.getState().liveRoomId||params.get('room')||'local'))}
 function load(){
  const scope=sourceScope(),base='archives:player-tools:v458:'+scope,next=base+':'+orientation();if(next===storageKey)return;const scopeChanged=visibilityKey!==base+':visibility';storageKey=next;visibilityKey=base+':visibility';prefs=defaults();if(scopeChanged)fittedCamera=null;
  try{
   const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
   if(saved){prefs.hidden=saved.hidden===true;for(const name of ['toolbar','toggle'])if(saved[name]&&Number.isFinite(saved[name].x)&&Number.isFinite(saved[name].y))prefs[name]={...prefs[name],x:Math.max(0,Math.min(1,saved[name].x)),y:Math.max(0,Math.min(1,saved[name].y)),vertical:saved[name].vertical===true,collapsed:saved[name].collapsed===true};if(scopeChanged&&saved.fitCamera&&['panX','panY','zoom'].every(key=>Number.isFinite(saved.fitCamera[key])))fittedCamera={...saved.fitCamera};}
   const hidden=localStorage.getItem(visibilityKey)??localStorage.getItem('archives:player-tools:v455:'+scope+':visibility');if(hidden!==null)prefs.hidden=hidden==='true';
  }catch{}
 }
 function save(){if(!active||!storageKey)return;try{localStorage.setItem(storageKey,JSON.stringify({...prefs,fitCamera:isFitted()?camera():null}));localStorage.setItem(visibilityKey,String(prefs.hidden))}catch{}}
 function place(node,position){
  if(node.dataset.dragging==='true')return;
  const v=viewport(),width=node.offsetWidth||44,height=node.offsetHeight||44;
  const p=dockPosition({x:v.left+8+position.x*Math.max(0,v.width-width-16),y:v.top+8+position.y*Math.max(0,v.height-height-16)},width,height,v);
  node.style.left=p.x+'px';node.style.top=p.y+'px';
 }
 function paint(){
  document.body.classList.toggle('player-icons-hidden',prefs.hidden);
  const v=viewport();root.style.setProperty('--player-vw',v.width+'px');root.style.setProperty('--player-vh',v.height+'px');
  for(const [name,bar]of [['toolbar',toolbar]]){
   const p=prefs[name];bar.node.hidden=prefs.hidden;bar.node.classList.toggle('player-bar-vertical',!!p.vertical);bar.node.classList.toggle('player-bar-collapsed',p.collapsed);
   bar.actions.hidden=p.collapsed;bar.collapse.textContent=p.collapsed?'＋':'−';bar.collapse.setAttribute('aria-label',(p.collapsed?'Déployer':'Réduire')+' la barre '+bar.caption);bar.collapse.title=bar.collapse.getAttribute('aria-label');bar.collapse.setAttribute('aria-expanded',String(!p.collapsed));
  }
  toggle.setAttribute('aria-label',prefs.hidden?'Afficher les icônes':'Masquer les icônes');toggle.title=toggle.getAttribute('aria-label');toggle.setAttribute('aria-pressed',String(!prefs.hidden));toggleCaption.textContent=prefs.hidden?'Afficher':'Masquer';
  const position=()=>{place(toolbar.node,prefs.toolbar);place(toggle,prefs.toggle)};
  position();if(layoutFrame)cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;position()});
 }
 function normalized(node,x,y){const v=viewport();return {x:Math.max(0,Math.min(1,(x-v.left-8)/Math.max(1,v.width-node.offsetWidth-16))),y:Math.max(0,Math.min(1,(y-v.top-8)/Math.max(1,v.height-node.offsetHeight-16)))}}
 function movable(grip,node,name){
  let drag,suppress=false;
  grip.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;e.preventDefault();suppress=false;const r=node.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};node.dataset.dragging='true';grip.setPointerCapture(e.pointerId)});
  grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;const p=dockPosition({x:drag.left+dx,y:drag.top+dy},node.offsetWidth,node.offsetHeight,viewport());node.style.left=p.x+'px';node.style.top=p.y+'px'});
  function end(e){
   if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;delete node.dataset.dragging;if(!moved)return;suppress=e.type==='pointerup';
   let rect=node.getBoundingClientRect();const v=viewport(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
   if(name!=='toggle'){prefs[name].vertical=Math.min(cx-v.left,v.left+v.width-cx)<Math.min(cy-v.top,v.top+v.height-cy);node.classList.toggle('player-bar-vertical',prefs[name].vertical);}
   const p=dockPosition({x:cx-node.offsetWidth/2,y:cy-node.offsetHeight/2},node.offsetWidth,node.offsetHeight,v);Object.assign(prefs[name],normalized(node,p.x,p.y));paint();save();
  }
  grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);grip.addEventListener('lostpointercapture',end);
  grip.addEventListener('click',e=>{if(suppress&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation()}suppress=false},true);
  grip.addEventListener('keydown',e=>{const shifts={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]},shift=shifts[e.key];if(!shift)return;e.preventDefault();const r=node.getBoundingClientRect(),p=dockPosition({x:r.x+shift[0],y:r.y+shift[1]},r.width,r.height,viewport());Object.assign(prefs[name],normalized(node,p.x,p.y));paint();save()});
 }
 movable(toggle,toggle,'toggle');
 function decorate(control,caption){
  if(!originals.has(control)){const marker=document.createComment('player-toolbar-position');control.before(marker);originals.set(control,{marker,label:null})}
  const record=originals.get(control);if(!record.label||record.label.parentNode!==control){record.label=el('span','player-action-caption',caption);control.append(record.label)}
  control.classList.add('player-command');
 }
 function command(id,caption){const control=document.getElementById(id);if(control)decorate(control,caption);return control}
 // A public snapshot can arrive between mousedown and mouseup. Re-appending a
 // button, even to its current parent, cancels that native click in Chromium.
 // Keep the toolbar DOM stable unless its actual contents or order changed.
 function placeCommands(destination,controls){
  let next=destination.firstElementChild;
  for(const control of controls.filter(Boolean)){if(control!==next)destination.insertBefore(control,next);next=control.nextElementSibling;}
 }
 function reconcile(){
  queued=false;const next=player();
  if(!next){if(active){active=false;setArrange(false);root.hidden=true;document.body.classList.remove('archives-player-ui','player-arrange-cells','player-icons-hidden');for(const [control,record]of originals){record.label?.remove();control.classList.remove('player-command','player-menu-command');if(record.marker.isConnected)record.marker.replaceWith(control)}originals.clear()}return}
  const route=new URLSearchParams(location.search);if(window.parent===window&&(route.get('ro')==='1'||route.get('player')==='1')&&!window.ArchivesPlayerScope)window.ArchivesRelay?.setPlayerScope('live:'+(api.getState().liveRoomId||route.get('room')||'second-ecran')+':'+(window.__archivesLivePlayerName||'Joueur'));
  active=true;root.hidden=false;document.body.classList.add('archives-player-ui');window.ArchivesPlayerNotebook?.refresh();load();
  owlControl=document.querySelector('#canvas-integrations-dock .canvas-integration-item:first-child button')||owlControl;if(owlControl?.isConnected&&!owlControl.disabled)decorate(owlControl,'Carte');
  placeCommands(toolbar.actions,[
   command('quick-player-center-cell','Centrer'),command('quick-player-layout','Organiser'),arrange,command('quick-player-center-all','Vue globale'),
   command('archives-dossier-open','Dossier'),command('quick-player-journal','Journal'),command('quick-player-notes','Notes'),
   command('quick-grid-toggle','Grille'),command('quick-player-undo','Annuler'),
   owlControl?.isConnected&&!owlControl.disabled?owlControl:null,command('archives-home-fab','Accueil'),
   !api.getState().strictReadOnly?command('quick-mode-switch','Mode MJ'):null
  ]);
  paint();
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(reconcile)}}
 function setArrange(value){
  arranging=value===true&&active&&player();
  document.body.classList.toggle('player-arrange-cells',arranging);
  arrange.setAttribute('aria-pressed',String(arranging));
  arrange.textContent=arranging?'✓':'✥';
  const label=arranging?'Terminer le déplacement des cellules':'Déplacer mes cellules';
  arrange.setAttribute('aria-label',label);arrange.title=label;
 }
 window.ArchivesPlayerUI={get arranging(){return arranging},setArrange,
  insets(){
   const v=viewport(),result={left:18,right:18,top:18,bottom:18};if(!active||prefs.hidden)return result;
   const r=toolbar.node.getBoundingClientRect();
   // A vertical bar can reach both the top and bottom on a short screen. Only
   // reserve its horizontal edge; otherwise fitting would use a negative height.
   if(prefs.toolbar.vertical){
    if(r.left<v.left+24)result.left=Math.max(result.left,r.right-v.left+16);
    if(r.right>v.left+v.width-24)result.right=Math.max(result.right,v.left+v.width-r.left+16);
   }else{
    if(r.top<v.top+24)result.top=Math.max(result.top,r.bottom-v.top+16);
    if(r.bottom>v.top+v.height-24)result.bottom=Math.max(result.bottom,v.top+v.height-r.top+16);
   }
   return result;
  }
 };
 for(const id of ['top-hud','quick-icon-dock','canvas-integrations-dock']){const target=document.getElementById(id);if(target)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']})}
 new MutationObserver(()=>{if(player()!==active)schedule()}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('archives:player-scope',schedule);window.addEventListener('archives:public-view',schedule);
 window.addEventListener('message',event=>{if(event.source===window.parent&&event.origin===location.origin&&isPacket(event.data)&&event.data.type==='owl-player-identity')schedule()});
 const resized=()=>{
  const before=lastViewport,after=viewport(),rotated=Math.abs(after.width-before.width)>40&&lastOrientation!==orientation();lastViewport=after;lastOrientation=orientation();
  if(!active)return;load();paint();
  if(rotated&&!document.querySelector('dialog[open],.modal-overlay.open,#player-cell-detail.open')){
   if(isFitted())fitView();else {const c=camera();api.setCanvasCamera({...c,panX:c.panX+(after.width-before.width)/2,panY:c.panY+(after.height-before.height)/2},true)}
  }
 };window.addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);window.visualViewport?.addEventListener('scroll',resized);
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
