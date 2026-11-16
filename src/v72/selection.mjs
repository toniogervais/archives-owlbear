import {element,button,sheet,isGM,notice} from '../v63/ui.mjs?v=4550';
let enabled=false,selected=new Set(),board='',drag=null,box,menu;
const state=()=>window.DuneApp?.getState?.();
const cells=()=>[...document.querySelectorAll('#nodes-layer .node-cell[data-id]')];
function paint() {
  if(board!==state()?.activeBoardId||!isGM()){selected.clear();board=state()?.activeBoardId;if(!isGM())enabled=false}
  for(const cell of cells())cell.classList.toggle('archives-multi-selected',selected.has(cell.dataset.id));
  document.body.classList.toggle('archives-selecting',enabled);
  const trigger=document.getElementById('archives-select-trigger');
  trigger?.setAttribute('aria-pressed',String(enabled));trigger?.classList.toggle('link-creation-active',enabled);
}
function clearMenu(){menu?.remove();menu=null}
function setMode(value){enabled=!!value&&isGM();if(!enabled)selected.clear();paint();clearMenu();if(enabled)notice('Clique sur les cellules ou trace un rectangle. Clic droit sur la sélection pour copier ou dupliquer. Échap pour quitter.')}
function copyToAct() {
  clearMenu();const s=state(),choices=s.boards.filter(b=>b.id!==s.activeBoardId);
  const view=sheet('archives-selection-copy','Copier la sélection','Cellules, groupes et flèches internes');
  if(!choices.length){view.content.append(element('p','Crée d’abord un autre acte avec « ＋ Acte ». La sélection est conservée.'));return}
  const select=element('select');select.setAttribute('aria-label','Acte de destination');
  for(const b of choices){const option=element('option',b.name||'Acte sans nom');option.value=b.id;select.append(option)}
  view.content.append(element('p','Les copies seront masquées dans l’acte choisi. Les originaux restent dans cet acte.'),select,button('Copier vers cet acte',()=>{
    try{const ids=window.DuneApp.copySelection([...selected],select.value);view.dialog.close();notice(ids.length+' cellules copiées.')}catch(error){view.status.textContent=error.message}
  },'primary'));
}
function context(event) {
  if(!enabled||!isGM()||!event.target.closest?.('#viewport'))return;
  const cell=event.target.closest('.node-cell[data-id]');
  if(cell&&!selected.has(cell.dataset.id)){selected=new Set([cell.dataset.id]);paint()}
  if(!selected.size)return;
  event.preventDefault();event.stopImmediatePropagation();clearMenu();window.DuneApp.closeContextMenus();
  menu=element('div');menu.id='archives-selection-menu';menu.setAttribute('role','menu');
  menu.append(element('strong',selected.size+' cellule(s) sélectionnée(s)'),button('Dupliquer la sélection',()=>{
    try{const ids=window.DuneApp.copySelection([...selected],state().activeBoardId);selected=new Set(ids);clearMenu();paint()}catch(error){notice(error.message)}
  }),button('Copier vers un autre acte…',copyToAct),button('Annuler la sélection',()=>{selected.clear();paint();clearMenu()}));
  document.body.append(menu);const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-r.height-8))+'px';menu.querySelector('button').focus();
}
function install() {
  const dock=document.getElementById('quick-icon-dock'),vp=document.getElementById('viewport');if(!dock||!vp)return;
  const css=element('style');css.textContent=`
  .archives-multi-selected{outline:4px solid #a8e1ff!important;outline-offset:8px;filter:drop-shadow(0 0 8px #91cfff)}
  body.archives-selecting #viewport,body.archives-selecting #viewport *{cursor:crosshair!important;touch-action:none}
  #archives-selection-box{position:fixed;pointer-events:none;background:#9bcfff26;border:1px solid #b7e3ff;z-index:9000}
  #archives-selection-menu{position:fixed;z-index:1000000;box-sizing:border-box;width:265px;max-width:calc(100vw - 16px);padding:12px;border:1px solid #bda16f;border-radius:10px;background:#221a2e;color:#fff0d5;box-shadow:0 10px 40px #000b;font:14px system-ui;display:grid;gap:7px}
  #archives-selection-menu button{font:inherit;padding:10px;text-align:left;border:1px solid #8e7658;border-radius:6px;background:#362740;color:inherit;cursor:pointer}
  `;document.head.append(css);
  const trigger=button('',()=>setMode(!enabled),'quick-icon-btn');trigger.id='archives-select-trigger';trigger.dataset.tone='blue';trigger.title='Sélectionner plusieurs cellules';trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-pressed','false');
  trigger.innerHTML='<svg class="quick-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8l4 11 2-5 5-2z" fill="none" stroke="currentColor"/></svg>';dock.append(trigger);
  // Capture phase stops the canvas's existing drag/link handlers only in selection mode.
  vp.addEventListener('pointerdown',event=>{
    if(!enabled||!isGM()||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();clearMenu();
    const cell=event.target.closest('.node-cell[data-id]');
    if(cell){if(selected.has(cell.dataset.id))selected.delete(cell.dataset.id);else selected.add(cell.dataset.id);paint();return}
    if(!event.shiftKey&&!event.ctrlKey&&!event.metaKey)selected.clear();
    drag={x:event.clientX,y:event.clientY,base:new Set(selected),pointer:event.pointerId};box=element('div');box.id='archives-selection-box';document.body.append(box);vp.setPointerCapture(event.pointerId);paint();
  },true);
  for(const name of ['mousedown','touchstart','click','dblclick'])vp.addEventListener(name,event=>{if(enabled&&isGM()){event.preventDefault();event.stopImmediatePropagation()}},{capture:true,passive:false});
  vp.addEventListener('pointermove',event=>{
    if(!drag)return;event.preventDefault();event.stopImmediatePropagation();
    const left=Math.min(drag.x,event.clientX),top=Math.min(drag.y,event.clientY),right=Math.max(drag.x,event.clientX),bottom=Math.max(drag.y,event.clientY);
    Object.assign(box.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});selected=new Set(drag.base);
    for(const cell of cells()){const r=cell.getBoundingClientRect();if(r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom)selected.add(cell.dataset.id)}paint();
  },true);
  const end=event=>{if(!drag)return;event.stopImmediatePropagation();if(vp.hasPointerCapture(drag.pointer))vp.releasePointerCapture(drag.pointer);drag=null;box?.remove();box=null};
  vp.addEventListener('pointerup',end,true);vp.addEventListener('pointercancel',end,true);
  document.addEventListener('contextmenu',context,true);
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))clearMenu()},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&enabled){event.preventDefault();setMode(false)}});
  new MutationObserver(paint).observe(document.getElementById('nodes-layer'),{childList:true});
  new MutationObserver(paint).observe(document.body,{attributes:true,attributeFilter:['class']});paint();
}
window.ArchivesSelection={setMode,get selected(){return [...selected]}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
