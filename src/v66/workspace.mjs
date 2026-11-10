/* V4.28.1 : déplacement direct des véritables barres visibles. */
import {isGM} from '../v63/ui.mjs';
const storagePrefix='archives:dock-location:v426:';
const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(Math.max(minimum,maximum),value));

function installMovableBar(id,caption){
  const container=document.getElementById(id);
  if(!container)return;
  const isActs=id==='top-hud';
  // Le conteneur #top-hud recouvre presque toute la largeur du canevas
  // mais seule la première .top-group est visible et réellement interactive.
  const target=isActs?container.querySelector('.hud-row > .top-group:first-child'):container;
  if(!target||target.querySelector(':scope > .archives-dock-move'))return;

  const grip=document.createElement('button');
  grip.type='button';
  grip.className='archives-dock-move';
  grip.textContent='⠿';
  grip.setAttribute('aria-label','Déplacer '+caption);
  if(isActs)target.prepend(grip);
  else target.append(grip); // Owlbear garde sa première icône dans la même position.

  const key=storagePrefix+id;
  function setPosition(left,top){
    const width=target.offsetWidth||250,height=target.offsetHeight||45;
    target.classList.add('archives-dock-moved');
    target.style.position='fixed';
    target.style.transform='none';
    target.style.right='auto';
    target.style.bottom='auto';
    target.style.left=clamp(left,2,innerWidth-width-3)+'px';
    target.style.top=clamp(top,2,innerHeight-height-3)+'px';
    target.style.zIndex=isActs?'260':'240';
  }
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))setPosition(saved.x,saved.y);
  }catch{}

  let gesture=null;
  function onMove(event){
    if(!gesture||event.pointerId!==gesture.id)return;
    event.preventDefault();
    const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY;
    setPosition(gesture.left+dx,gesture.top+dy);
  }
  function end(event){
    if(!gesture||(event&&event.pointerId!==gesture.id))return;
    const moved=gesture.moved;
    gesture=null;
    window.removeEventListener('pointermove',onMove,true);
    window.removeEventListener('pointerup',end,true);
    window.removeEventListener('pointercancel',end,true);
    try{grip.releasePointerCapture?.(event.pointerId);}catch{}
    if(target.classList.contains('archives-dock-moved'))
      try{localStorage.setItem(key,JSON.stringify({x:parseFloat(target.style.left),y:parseFloat(target.style.top)}));}catch{}
  }
  grip.addEventListener('pointerdown',event=>{
    if(event.button!==0||!isGM())return;
    event.preventDefault();
    event.stopPropagation();
    const rect=target.getBoundingClientRect();
    gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top};
    // Écouter sur window plutôt que seulement sur la poignée :
    // le glissement reste actif au-delà des limites des boutons/iframes.
    window.addEventListener('pointermove',onMove,true);
    window.addEventListener('pointerup',end,true);
    window.addEventListener('pointercancel',end,true);
    try{grip.setPointerCapture?.(event.pointerId);}catch{}
  });
}

const css=document.createElement('style');
css.id='archives-v4281-movable';
css.textContent=`
#canvas-integrations-dock > .archives-dock-move,
#top-hud .top-group > .archives-dock-move{
  min-width:28px;min-height:28px;background:#25212c;border:1px solid #d7b87b66;
  color:#f4dfb4;border-radius:8px;font-size:14px;touch-action:none;cursor:grab;
  pointer-events:auto;flex:0 0 auto;position:relative;z-index:5;user-select:none
}
#canvas-integrations-dock > .archives-dock-move:active,
#top-hud .top-group > .archives-dock-move:active{cursor:grabbing}
#top-hud .top-group.archives-dock-moved{
  pointer-events:auto!important;max-width:calc(100vw - 12px)!important;
  width:max-content!important;margin:0!important;overflow:visible
}
#canvas-integrations-dock.archives-dock-moved{max-width:calc(100vw - 12px)}
body.player-mode #canvas-integrations-dock > .archives-dock-move,
body.strict-readonly #canvas-integrations-dock > .archives-dock-move,
body.player-mode #top-hud .archives-dock-move,
body.strict-readonly #top-hud .archives-dock-move{display:none!important}
@media print{.archives-dock-move{display:none!important}}
`;
document.head.append(css);
installMovableBar('canvas-integrations-dock','la barre d’intégrations');
installMovableBar('top-hud','la barre des actes');
window.ArchivesLayout={};
