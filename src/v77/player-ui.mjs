import {isPacket} from '../v56/link.mjs?v=4550';
import {dockPosition,zoomCamera} from './geometry.mjs?v=4550';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const player=()=>{const s=window.DuneApp?.getState?.();return !!s&&(s.playerMode||s.strictReadOnly)};
const icons={minus:'M5 12h14',plus:'M5 12h14M12 5v14',fit:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z',more:'M4 12h.01M12 12h.01M20 12h.01',eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[name]);svg.append(path);return svg}
function button(label,text,handler){const b=el('button',null,text);b.type='button';b.setAttribute('aria-label',label);b.title=label;b.onclick=handler;return b}
function viewport(){const v=window.visualViewport,css=getComputedStyle(document.documentElement),safe=edge=>parseFloat(css.getPropertyValue('--player-safe-'+edge))||0;return {left:(v?.offsetLeft||0)+safe('left'),top:(v?.offsetTop||0)+safe('top'),width:(v?.width||innerWidth)-safe('left')-safe('right'),height:(v?.height||innerHeight)-safe('top')-safe('bottom')}}
const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
const defaults=()=>({hidden:false,reading:{x:.5,y:0,vertical:false,collapsed:false},zoom:{x:.5,y:1,vertical:false,collapsed:false},toggle:{x:1,y:.72}});
function install(){
 if(!window.DuneApp)return;const api=window.DuneApp,originals=new Map();let active=false,storageKey='',visibilityKey='',prefs=defaults(),arranging=false,queued=false,layoutFrame=0,owlControl;
 const root=el('div');root.id='archives-player-tools';root.hidden=true;
 const toggle=button('Masquer les icônes','',()=>{prefs.hidden=!prefs.hidden;if(prefs.hidden)setArrange(false);else for(const bar of [prefs.reading,prefs.zoom])bar.collapsed=false;paint();save()});toggle.id='archives-player-icons-toggle';toggle.append(icon('eye'));
 const toggleCaption=el('span',null,'Icônes');toggle.append(toggleCaption);
 const menu=el('dialog');menu.id='archives-player-display';menu.setAttribute('aria-label','Mon affichage');
 const header=el('header'),title=el('h2',null,'Mon affichage'),close=button('Fermer mon affichage','×',()=>menu.close());header.append(title,close);
 const note=el('p','player-display-hint','Un doigt pour déplacer la vue, deux pour zoomer. Appuie sur une cellule pour la lire.');
 const zoomLabel=el('label',null,'Zoom précis'),slider=el('input');slider.type='range';slider.min=5;slider.max=500;slider.step=1;slider.id='archives-player-zoom-range';zoomLabel.htmlFor=slider.id;
 const zoomValue=el('output');zoomValue.htmlFor=slider.id;
 slider.oninput=()=>zoomTo(Number(slider.value)/100);const zoomSection=el('section','player-display-zoom');zoomSection.append(zoomLabel,zoomValue,slider);
 const menuActions=el('div','player-display-actions'),sceneSection=el('section'),sceneTitle=el('h3',null,'Scènes disponibles'),scenes=el('div','player-scenes');sceneSection.append(sceneTitle,scenes);
 const arrange=button('Déplacer mes cellules','Déplacer mes cellules',()=>setArrange(!arranging));arrange.id='archives-player-arrange';arrange.setAttribute('aria-pressed','false');
 const reset=button('Remettre les barres en place','Remettre les barres en place',()=>{prefs=defaults();paint();save();menu.close()});
 menu.append(header,note,zoomSection,menuActions,arrange,sceneSection,reset);
 const reading=makeBar('reading','de lecture'),zoom=makeBar('zoom','de zoom');
 const more=button('Options de mon affichage','',()=>openMenu());more.id='archives-player-display-open';more.className='player-command';more.append(icon('more'),el('span','player-action-caption','Options'));
 const minus=button('Dézoomer la vue','',()=>step(-1)),plus=button('Zoomer la vue','',()=>step(1)),fit=button('Afficher toutes les cellules','',()=>{api.resetView();api.setCanvasCamera(camera(),true)});
 minus.id='archives-player-zoom-out';plus.id='archives-player-zoom-in';fit.id='archives-player-fit';minus.append(icon('minus'));plus.append(icon('plus'));fit.append(icon('fit'));
 const percent=button('Régler précisément le zoom','100 %',()=>openMenu(true));percent.id='archives-player-zoom-value';zoom.actions.append(minus,percent,plus,fit);
 root.append(reading.node,zoom.node,toggle,menu);document.body.append(root);
 function makeBar(id,caption){
  const node=el('nav','archives-player-dock');node.id='archives-player-'+id+'-bar';node.setAttribute('aria-label','Barre '+caption);
  const grip=button('Déplacer la barre '+caption,'⠿',()=>{});grip.className='player-bar-grip';
  const actions=el('div','player-bar-actions'),collapse=button('Réduire la barre '+caption,'−',()=>{prefs[id].collapsed=!prefs[id].collapsed;paint();save()});collapse.className='player-bar-collapse';
  node.append(grip,actions,collapse);movable(grip,node,id);return {node,actions,collapse,caption};
 }
 function camera(){const s=api.getState();return {panX:s.panX,panY:s.panY,zoom:s.zoom}}
 function zoomTo(value){const box=document.getElementById('viewport').getBoundingClientRect();api.setCanvasCamera(zoomCamera(camera(),value,{x:box.width/2,y:box.height/2}),true)}
 function step(direction){zoomTo(camera().zoom*(direction>0?1.1:1/1.1))}
 function repeat(control,direction){
  let timer,repeated=false;
  const stop=()=>{clearTimeout(timer);timer=null};
  control.addEventListener('pointerdown',e=>{if(e.button!==0)return;stop();repeated=false;control.setPointerCapture(e.pointerId);timer=setTimeout(function tick(){if(!active||prefs.hidden)return;repeated=true;step(direction);timer=setTimeout(tick,130)},380)});
  control.addEventListener('click',e=>{if(repeated){e.preventDefault();e.stopImmediatePropagation();repeated=false}},true);
  for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])control.addEventListener(name,stop);
 }
 repeat(minus,-1);repeat(plus,1);
 function sourceScope(){const params=new URLSearchParams(location.search);return window.ArchivesPlayerScope||((api.getState().strictReadOnly?'player:':'preview:')+(api.getState().liveRoomId||params.get('room')||'local'))}
 function load(){
  const base='archives:player-tools:v455:'+sourceScope(),next=base+':'+orientation();if(next===storageKey)return;storageKey=next;visibilityKey=base+':visibility';prefs=defaults();
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){prefs.hidden=saved.hidden===true;for(const name of ['reading','zoom','toggle'])if(saved[name]&&Number.isFinite(saved[name].x)&&Number.isFinite(saved[name].y))prefs[name]={...prefs[name],x:Math.max(0,Math.min(1,saved[name].x)),y:Math.max(0,Math.min(1,saved[name].y)),vertical:saved[name].vertical===true,collapsed:saved[name].collapsed===true}}const hidden=localStorage.getItem(visibilityKey);if(hidden!==null)prefs.hidden=hidden==='true';}catch{}
 }
 function save(){if(!active||!storageKey)return;try{localStorage.setItem(storageKey,JSON.stringify(prefs));localStorage.setItem(visibilityKey,String(prefs.hidden))}catch{}}
 function place(node,position){
  const v=viewport(),width=node.offsetWidth||44,height=node.offsetHeight||44;
  const p=dockPosition({x:v.left+8+position.x*Math.max(0,v.width-width-16),y:v.top+8+position.y*Math.max(0,v.height-height-16)},width,height,v);
  node.style.left=p.x+'px';node.style.top=p.y+'px';
 }
 function paint(){
  document.body.classList.toggle('player-icons-hidden',prefs.hidden);
  const v=viewport();root.style.setProperty('--player-vw',v.width+'px');root.style.setProperty('--player-vh',v.height+'px');
  for(const [name,bar]of [['reading',reading],['zoom',zoom]]){
   const p=prefs[name];bar.node.hidden=prefs.hidden;bar.node.classList.toggle('player-bar-vertical',!!p.vertical);bar.node.classList.toggle('player-bar-collapsed',p.collapsed);
   bar.actions.hidden=p.collapsed;bar.collapse.textContent=p.collapsed?'＋':'−';bar.collapse.setAttribute('aria-label',(p.collapsed?'Déployer':'Réduire')+' la barre '+bar.caption);bar.collapse.title=bar.collapse.getAttribute('aria-label');bar.collapse.setAttribute('aria-expanded',String(!p.collapsed));
  }
  toggle.setAttribute('aria-label',prefs.hidden?'Afficher les icônes':'Masquer les icônes');toggle.title=toggle.getAttribute('aria-label');toggle.setAttribute('aria-pressed',String(!prefs.hidden));toggleCaption.textContent=prefs.hidden?'Afficher':'Masquer';
  if(layoutFrame)cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;place(reading.node,prefs.reading);place(zoom.node,prefs.zoom);place(toggle,prefs.toggle)});
 }
 function normalized(node,x,y){const v=viewport();return {x:Math.max(0,Math.min(1,(x-v.left-8)/Math.max(1,v.width-node.offsetWidth-16))),y:Math.max(0,Math.min(1,(y-v.top-8)/Math.max(1,v.height-node.offsetHeight-16)))}}
 function movable(grip,node,name){
  let drag,suppress=false;
  grip.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;e.preventDefault();const r=node.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};grip.setPointerCapture(e.pointerId)});
  grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;const p=dockPosition({x:drag.left+dx,y:drag.top+dy},node.offsetWidth,node.offsetHeight,viewport());node.style.left=p.x+'px';node.style.top=p.y+'px'});
  function end(e){
   if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;if(!moved)return;suppress=e.type==='pointerup';
   let rect=node.getBoundingClientRect();const v=viewport(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
   if(name!=='toggle'){prefs[name].vertical=Math.min(cx-v.left,v.left+v.width-cx)<Math.min(cy-v.top,v.top+v.height-cy);node.classList.toggle('player-bar-vertical',prefs[name].vertical);}
   const p=dockPosition({x:cx-node.offsetWidth/2,y:cy-node.offsetHeight/2},node.offsetWidth,node.offsetHeight,v);Object.assign(prefs[name],normalized(node,p.x,p.y));paint();save();
  }
  grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
  grip.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false}},true);
  grip.addEventListener('keydown',e=>{const shifts={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]},shift=shifts[e.key];if(!shift)return;e.preventDefault();const r=node.getBoundingClientRect(),p=dockPosition({x:r.x+shift[0],y:r.y+shift[1]},r.width,r.height,viewport());Object.assign(prefs[name],normalized(node,p.x,p.y));paint();save()});
 }
 movable(toggle,toggle,'toggle');
 function decorate(control,caption,menuItem=false){
  if(!originals.has(control)){const marker=document.createComment('player-toolbar-position');control.before(marker);originals.set(control,{marker,label:null})}
  const record=originals.get(control);if(!record.label){record.label=el('span',menuItem?'player-menu-caption':'player-action-caption',caption);control.append(record.label)}
  control.classList.add(menuItem?'player-menu-command':'player-command');
 }
 function move(id,destination,caption,menuItem=false){const control=document.getElementById(id);if(!control)return;decorate(control,caption,menuItem);destination.append(control)}
 function reconcile(){
  queued=false;const next=player();
  if(!next){if(active){active=false;arranging=false;root.hidden=true;menu.close();document.body.classList.remove('archives-player-ui','player-arrange-cells','player-icons-hidden');for(const [control,record]of originals){record.label?.remove();control.classList.remove('player-command','player-menu-command');if(record.marker.isConnected)record.marker.replaceWith(control)}originals.clear()}return}
  active=true;root.hidden=false;document.body.classList.add('archives-player-ui');load();
  move('archives-dossier-open',reading.actions,'Dossier');move('quick-player-journal',reading.actions,'Journal');move('quick-player-notes',reading.actions,'Notes');
  owlControl=document.querySelector('#canvas-integrations-dock .canvas-integration-item:first-child button')||owlControl;if(owlControl?.isConnected&&!owlControl.disabled){decorate(owlControl,'Carte');reading.actions.append(owlControl)}
  if(!api.getState().strictReadOnly)move('quick-mode-switch',reading.actions,'Mode MJ');
  reading.actions.append(more);
  move('quick-player-center-cell',menuActions,'Recentrer la cellule sélectionnée',true);move('quick-grid-toggle',menuActions,'Afficher ou masquer la grille',true);move('quick-player-layout',menuActions,'Réorganiser mes cellules',true);move('quick-player-undo',menuActions,'Annuler mon déplacement',true);
  refreshScenes();paint();updateZoom();
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(reconcile)}}
 function updateZoom(){if(!active)return;const value=Math.round(camera().zoom*100);if(percent.textContent!==value+' %')percent.textContent=value+' %';slider.value=String(value);zoomValue.value=value+' %';}
 function refreshScenes(){
  const tabs=Array.from(document.querySelectorAll('#tabs-bar .tab-btn'));sceneSection.hidden=tabs.length<2;scenes.replaceChildren(...tabs.map((tab,i)=>{const b=button('Afficher la scène '+(i+1),'Scène '+(i+1),()=>{tab.click();menu.close();api.resetView()});b.setAttribute('aria-pressed',String(tab.classList.contains('active')));return b}));
 }
 function setArrange(value){arranging=value===true;document.body.classList.toggle('player-arrange-cells',arranging);arrange.setAttribute('aria-pressed',String(arranging));arrange.textContent=arranging?'Déplacement des cellules activé':'Déplacer mes cellules';menu.close()}
 function openMenu(focusZoom=false){if(!active)return;updateZoom();refreshScenes();if(!menu.open)menu.showModal();if(focusZoom)slider.focus()}
 menuActions.addEventListener('click',()=>menu.close());
 window.ArchivesPlayerUI={get arranging(){return arranging},setArrange,
  insets(){const v=viewport(),result={left:18,right:18,top:18,bottom:18};if(!active||prefs.hidden)return result;for(const bar of [reading.node,zoom.node]){const r=bar.getBoundingClientRect();if(r.top<v.top+24)result.top=Math.max(result.top,r.bottom-v.top+16);if(r.bottom>v.top+v.height-24)result.bottom=Math.max(result.bottom,v.top+v.height-r.top+16);if(r.left<v.left+24&&r.height>r.width)result.left=Math.max(result.left,r.right-v.left+16);if(r.right>v.left+v.width-24&&r.height>r.width)result.right=Math.max(result.right,v.left+v.width-r.left+16)}return result}
 };
 for(const id of ['top-hud','quick-icon-dock','canvas-integrations-dock']){const target=document.getElementById(id);if(target)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']})}
 new MutationObserver(()=>{if(player()!==active)schedule()}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('archives:camera',updateZoom);window.addEventListener('archives:player-scope',schedule);window.addEventListener('archives:public-view',schedule);
 window.addEventListener('message',event=>{if(event.source===window.parent&&event.origin===location.origin&&isPacket(event.data)&&event.data.type==='owl-player-identity')schedule()});
 const resized=()=>{if(!active)return;load();paint()};window.addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);window.visualViewport?.addEventListener('scroll',resized);
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
