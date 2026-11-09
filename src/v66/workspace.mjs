/* V4.26 : barres déplaçables + plein écran du canevas, sans altérer les cellules. */
import {isGM,notice} from '../v63/ui.mjs';
const storagePrefix='archives:dock-location:v426:';
function limit(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
function moveBar(id,caption){
  const dock=document.getElementById(id);if(!dock)return;
  const handle=document.createElement('button');
  handle.type='button';handle.className='archives-dock-move';
  handle.title='Déplacer '+caption+' · double-clic : réinitialiser la position';
  handle.setAttribute('aria-label','Déplacer '+caption);
  handle.textContent='⠿';
  // Owlbear's map button selector depends on its integration remaining the first child.
  if(id==='canvas-integrations-dock')dock.append(handle);else dock.prepend(handle);
  const key=storagePrefix+id;
  const apply=pos=>{
    if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return;
    dock.classList.add('archives-dock-moved');
    dock.style.position='fixed';
    dock.style.transform='none';
    dock.style.right='auto';dock.style.bottom='auto';
    dock.style.left=limit(pos.x,2,innerWidth-55)+'px';
    dock.style.top=limit(pos.y,2,innerHeight-40)+'px';
  };
  try{apply(JSON.parse(localStorage.getItem(key)));}catch{}
  handle.ondblclick=()=>{
    dock.classList.remove('archives-dock-moved');
    dock.style.removeProperty('position');dock.style.removeProperty('transform');
    dock.style.removeProperty('right');dock.style.removeProperty('bottom');
    dock.style.removeProperty('top');dock.style.removeProperty('left');
    try{localStorage.removeItem(key);}catch{}
  };
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||!isGM())return;
    event.preventDefault();event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    const original=dock.getBoundingClientRect(),x=event.clientX,y=event.clientY;
    const move=ev=>apply({x:original.left+ev.clientX-x,y:original.top+ev.clientY-y});
    const finish=()=>{
      handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);
      handle.removeEventListener('pointercancel',finish);
      if(dock.classList.contains('archives-dock-moved'))
        try{localStorage.setItem(key,JSON.stringify({x:parseFloat(dock.style.left),y:parseFloat(dock.style.top)}));}catch{}
    };
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  });
}
const css=document.createElement('style');css.id='archives-v426-movable';
css.textContent=`
#canvas-integrations-dock .archives-dock-move,
#top-hud .archives-dock-move{min-width:27px;min-height:27px;background:#25212c;border:1px solid #d7b87b66;color:#f4dfb4;border-radius:8px;font-size:14px;touch-action:none;cursor:grab;pointer-events:auto;flex:none}
#canvas-integrations-dock .archives-dock-move:active,#top-hud .archives-dock-move:active{cursor:grabbing}
#canvas-integrations-dock.archives-dock-moved{z-index:240;max-width:calc(100vw - 10px)}
#top-hud.archives-dock-moved{z-index:230;pointer-events:none;max-width:calc(100vw - 12px);width:max-content;max-height:calc(100vh - 50px);overflow:auto;background:rgba(12,10,18,.78);border:1px solid #d7b87b55;padding:5px;border-radius:10px}
#top-hud .archives-dock-move{align-self:start}
body.player-mode #canvas-integrations-dock .archives-dock-move,
body.strict-readonly #canvas-integrations-dock .archives-dock-move{display:none}
#archives-fullscreen-toggle[aria-pressed=true]{background:#4c5734!important;color:#e3edc0!important}
@media print{#canvas-integrations-dock .archives-dock-move,#top-hud .archives-dock-move{display:none!important}}
`;
document.head.append(css);
moveBar('canvas-integrations-dock','la barre d’intégrations');
moveBar('top-hud','la barre de commandes');
const fullscreen=document.getElementById('archives-fullscreen-toggle');
function setFullState(){
  if(!fullscreen)return;
  const active=!!document.fullscreenElement;
  fullscreen.setAttribute('aria-pressed',String(active));
  fullscreen.setAttribute('aria-label',active?'Quitter le plein écran':'Passer en plein écran');
  fullscreen.title=active?'Quitter le plein écran':'Plein écran';
}
document.addEventListener('fullscreenchange',setFullState);setFullState();
async function toggleFullscreen(){
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
    else notice('Le navigateur ne prend pas en charge le plein écran. Utilise F11 dans Chrome.');
  }catch{
    notice('Owlbear ou le navigateur bloque le plein écran de cette fenêtre. Appuie sur F11 pour afficher le navigateur en plein écran.');
  }finally{setFullState();}
}
window.ArchivesLayout={toggleFullscreen,resetBars(){
  for(const id of ['canvas-integrations-dock','top-hud'])document.querySelector('#'+id+' .archives-dock-move')?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
}};
