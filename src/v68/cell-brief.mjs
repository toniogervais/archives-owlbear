/* V4.39 — fiche de jeu MJ : consultation rapide des cellules et suivi des révélations. */
const DIALOG_ID='archives-cell-brief';
const BUTTON_CLASS='archives-cell-brief-trigger';
let activeNodeId=null;
const el=(tag,cls,textValue)=>{
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(textValue!==undefined)element.textContent=String(textValue);
  return element;
};
function gmState(){
  const state=window.DuneApp?.getState?.();
  if(!state||state.playerMode||state.strictReadOnly||
     document.body.classList.contains('player-mode')||
     document.body.classList.contains('strict-readonly'))return null;
  return state;
}
function currentNode(id){
  const state=gmState();
  return state?.nodes?.find(node=>String(node.id)===String(id))||null;
}
function css(){
  if(document.getElementById('archives-cell-brief-style'))return;
  const style=el('style');style.id='archives-cell-brief-style';
  style.textContent=`
  .cell-actions > .archives-cell-brief-trigger {
    border:1px solid #e0bd7c;background:#241b30;color:#ffe9bc;
    border-radius:6px;padding:3px 7px;font-size:10px;line-height:1.4;
    box-shadow:0 3px 12px #0008;white-space:nowrap;
  }
  .cell-actions > .archives-cell-brief-trigger:hover,
  .cell-actions > .archives-cell-brief-trigger:focus-visible {
    background:#6a4d29;color:#fff;outline:2px solid #e0bd7c;
    outline-offset:2px;
  }
  body.player-mode .archives-cell-brief-trigger,
  body.strict-readonly .archives-cell-brief-trigger {display:none!important}
  #archives-cell-brief {
    box-sizing:border-box;position:fixed;inset:0;margin:auto;
    width:min(1160px,96vw);height:min(850px,91dvh);max-width:96vw;max-height:94dvh;
    padding:0;border:1px solid #bca06a;border-radius:15px;
    background:#171321;color:#f6ebdc;box-shadow:0 22px 95px #000d;
    font:14px/1.55 "Segoe UI",system-ui,sans-serif;
    overflow:hidden;z-index:999999;resize:both;
  }
  #archives-cell-brief::backdrop {background:rgba(4,3,9,.82);backdrop-filter:blur(4px)}
  #archives-cell-brief * {box-sizing:border-box}
  #archives-cell-brief .brief-shell {height:100%;display:flex;flex-direction:column;min-height:0}
  #archives-cell-brief .brief-header {
    display:flex;align-items:center;gap:12px;justify-content:space-between;
    padding:12px 18px;border-bottom:1px solid #c5a76e65;
    background:linear-gradient(100deg,#2b2138,#181320);
  }
  #archives-cell-brief .brief-titles {min-width:0}
  #archives-cell-brief .brief-overline {display:block;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:1.4px;color:#e4bf78}
  #archives-cell-brief h2 {font-size:21px;color:#fff2d2;line-height:1.2;margin:4px 0 0;overflow-wrap:anywhere}
  #archives-cell-brief button {font:inherit;cursor:pointer}
  #archives-cell-brief .brief-close {
    flex:0 0 auto;width:36px;height:36px;border:1px solid #bea473;border-radius:8px;
    background:#261e32;color:#ffebc8;font-size:22px;display:grid;place-items:center;
  }
  #archives-cell-brief .brief-body {
    display:grid;grid-template-columns:minmax(225px,35%) minmax(0,1fr);
    gap:0;flex:1;min-height:0;
  }
  #archives-cell-brief .brief-portrait {
    display:flex;flex-direction:column;min-width:0;min-height:0;
    border-right:1px solid #c5a76e55;background:#0e0c14;padding:15px;
  }
  #archives-cell-brief .brief-figure {
    display:grid;place-items:center;flex:1;min-height:0;
    border:1px solid #a48b5d70;border-radius:10px;overflow:hidden;
    background:radial-gradient(circle at center,#31263c,#0d0b13);
  }
  #archives-cell-brief .brief-picture {display:block;width:100%;height:100%;object-fit:contain}
  #archives-cell-brief .brief-no-picture {padding:20px;color:#c2b4ca;text-align:center}
  #archives-cell-brief .brief-subtitle {
    flex:0 0 auto;max-width:100%;padding:10px 3px 2px;overflow-wrap:anywhere;
    color:#dbc69d;font-size:12px;
  }
  #archives-cell-brief .brief-right {display:flex;flex-direction:column;min-width:0;min-height:0}
  #archives-cell-brief .brief-desc {
    display:flex;flex-direction:column;min-height:120px;flex:1 1 46%;
    padding:18px 20px;overflow:auto;
  }
  #archives-cell-brief h3 {
    color:#edcf91;font-size:14px;letter-spacing:.4px;margin:0 0 10px;
    font-weight:750;
  }
  #archives-cell-brief .brief-description {
    color:#f7efe8;white-space:pre-wrap;overflow-wrap:anywhere;
    font-size:15px;line-height:1.65;user-select:text;
  }
  #archives-cell-brief .brief-hint {color:#b9acbd;font-size:12px}
  #archives-cell-brief .brief-clues {
    display:flex;flex-direction:column;flex:1 1 54%;min-height:155px;
    border-top:1px solid #c5a76e65;background:#211a2a;
  }
  #archives-cell-brief .brief-clues-header {
    display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;
    padding:13px 19px 7px;
  }
  #archives-cell-brief .brief-clues-header h3 {margin:0}
  #archives-cell-brief .brief-count {font-size:12px;color:#d2bd9a}
  #archives-cell-brief .brief-clue-list {
    overflow:auto;display:flex;flex-direction:column;gap:6px;
    padding:5px 16px 13px;min-height:0;
  }
  #archives-cell-brief .brief-clue-row {
    display:flex;align-items:flex-start;gap:11px;padding:10px 12px;
    border:1px solid #665674;border-radius:8px;background:#171320;
    color:#eee3df;cursor:pointer;
  }
  #archives-cell-brief .brief-clue-row[data-revealed="true"] {
    border-color:#4d9877;background:#1a302a;
  }
  #archives-cell-brief .brief-clue-checkbox {
    flex:0 0 auto;width:19px;height:19px;margin:2px 0 0;accent-color:#66cda1;cursor:pointer;
  }
  #archives-cell-brief .brief-clue-text {
    flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere;
    font-size:14px;line-height:1.5;
  }
  #archives-cell-brief .brief-status {
    flex:0 0 auto;margin-left:auto;color:#c7b5d5;
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;
  }
  #archives-cell-brief .brief-clue-row[data-revealed="true"] .brief-status {color:#95e7be}
  #archives-cell-brief .brief-footer {
    flex:0 0 auto;border-top:1px solid #8d76567b;
    padding:9px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;
    color:#ccbda2;font-size:11px;background:#211a2a;
  }
  #archives-cell-brief .brief-footer button {
    border-radius:7px;border:1px solid #c2a66d;background:#463622;color:#fff0d1;padding:6px 14px;
  }
  @media(max-width:690px) {
    #archives-cell-brief {width:96vw;height:92dvh;resize:none}
    #archives-cell-brief .brief-body {display:flex;flex-direction:column;overflow:auto}
    #archives-cell-brief .brief-portrait {
      flex:0 0 auto;min-height:190px;max-height:30vh;border-right:0;
      border-bottom:1px solid #b99d6b;padding:10px;
    }
    #archives-cell-brief .brief-figure {min-height:145px}
    #archives-cell-brief .brief-right {flex:1 0 auto;min-height:390px}
    #archives-cell-brief .brief-desc {min-height:160px;flex:1 0 auto;padding:14px}
    #archives-cell-brief .brief-clues {min-height:200px;flex:1 0 auto}
    #archives-cell-brief .brief-footer {flex-wrap:wrap}
    #archives-cell-brief .brief-status {font-size:9px}
  }
  @media(prefers-reduced-motion:reduce) {
    #archives-cell-brief::backdrop {backdrop-filter:none}
  }`;
  document.head.appendChild(style);
}
function ensureDialog(){
  let dialog=document.getElementById(DIALOG_ID);
  if(dialog)return dialog;
  dialog=el('dialog');dialog.id=DIALOG_ID;
  dialog.setAttribute('aria-label','Fiche MJ de consultation de la cellule');
  const shell=el('div','brief-shell');
  const header=el('header','brief-header');
  const titles=el('div','brief-titles');
  const overline=el('span','brief-overline','Fiche de jeu · Maître du jeu');
  const title=el('h2');title.id='archives-brief-title';
  titles.append(overline,title);
  const close=el('button','brief-close','×');close.type='button';close.title='Fermer la fiche (Échap)';
  close.onclick=()=>dialog.close();
  header.append(titles,close);
  const body=el('div','brief-body');
  const portrait=el('aside','brief-portrait');
  const figure=el('div','brief-figure');figure.id='archives-brief-figure';
  const subtitle=el('div','brief-subtitle');subtitle.id='archives-brief-category';
  portrait.append(figure,subtitle);
  const right=el('div','brief-right');
  const section=el('section','brief-desc');
  section.append(el('h3',null,'Description générale'));
  const description=el('div','brief-description');description.id='archives-brief-description';
  section.append(description);
  const clueArea=el('section','brief-clues');
  const clueHeader=el('div','brief-clues-header');
  clueHeader.append(el('h3',null,'Indices et révélations'));
  const counter=el('span','brief-count');counter.id='archives-brief-count';clueHeader.append(counter);
  const list=el('div','brief-clue-list');list.id='archives-brief-list';
  clueArea.append(clueHeader,list);
  right.append(section,clueArea);
  body.append(portrait,right);
  const footer=el('footer','brief-footer');
  const tip=el('span',null,'Cocher révèle un indice aux joueurs si la cellule leur est visible. Décocher le masque.');
  const back=el('button',null,'Fermer');back.type='button';back.onclick=()=>dialog.close();
  footer.append(tip,back);
  shell.append(header,body,footer);dialog.append(shell);
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{activeNodeId=null});
  return dialog;
}
function render(nodeId) {
  const node=currentNode(nodeId);
  if(!node)return false;
  document.getElementById('archives-brief-title').textContent=node.title||'Cellule sans titre';
  const category=[node.category||'Cellule',node.faction||'',node.revealed?'Cellule révélée':'Cellule cachée'].filter(Boolean).join(' · ');
  document.getElementById('archives-brief-category').textContent=category;
  const picture=document.getElementById('archives-brief-figure');
  picture.replaceChildren();
  const url=node.bgImg||node.image||node.imageData;
  if(typeof url==='string'&&url){
    const img=el('img','brief-picture');img.src=url;img.alt='Portrait ou illustration : '+(node.title||'cellule');
    img.onerror=()=>{picture.replaceChildren(el('span','brief-no-picture','Image indisponible'))};
    picture.append(img);
  } else picture.append(el('span','brief-no-picture','Aucun portrait ou illustration associé à cette cellule'));
  const description=document.getElementById('archives-brief-description');
  description.textContent=node.desc?.trim()||'Aucune description générale renseignée.';
  if(!node.desc?.trim())description.classList.add('brief-hint');else description.classList.remove('brief-hint');
  const list=document.getElementById('archives-brief-list');list.replaceChildren();
  const clues=Array.isArray(node.clues)?node.clues:[];
  document.getElementById('archives-brief-count').textContent=clues.filter(c=>c.revealed).length+' / '+clues.length+' révélés';
  if(!clues.length)list.append(el('div','brief-hint','Aucun indice ou révélation n’est associé à cette cellule.'));
  for(const clue of clues){
    const row=el('label','brief-clue-row');row.dataset.revealed=clue.revealed?'true':'false';
    const checkbox=el('input','brief-clue-checkbox');checkbox.type='checkbox';checkbox.checked=!!clue.revealed;
    checkbox.setAttribute('aria-label','Révéler aux joueurs : '+String(clue.text||'indice'));
    const text=el('span','brief-clue-text',clue.text||'(Indice sans texte)');
    const status=el('span','brief-status',clue.revealed?'Révélé':'Secret');
    row.append(checkbox,text,status);
    checkbox.addEventListener('change',()=>{
      if(!gmState()||!window.DuneApp?.setBriefClueRevealed?.(node.id,clue.id,checkbox.checked)){
        checkbox.checked=!checkbox.checked;return;
      }
      // Lire l’état après la sauvegarde et la synchronisation plutôt que
      // conserver une copie de l’indice dans cette fenêtre de consultation.
      render(node.id);
    });
    list.append(row);
  }
  return true;
}
function open(nodeId,event){
  event?.stopPropagation?.();
  event?.preventDefault?.();
  if(!gmState())return;
  css();
  const dialog=ensureDialog();
  if(!render(nodeId))return;
  activeNodeId=nodeId;
  if(!dialog.open)dialog.showModal();
}
function addButtons(){
  const state=gmState();
  if(!state)return;
  const layer=document.getElementById('nodes-layer');
  if(!layer)return;
  const existingIds=new Set((state.nodes||[]).map(n=>String(n.id)));
  for(const cell of layer.querySelectorAll('.node-cell[data-id]')){
    const nodeId=cell.getAttribute('data-id');
    if(!existingIds.has(nodeId))continue;
    const actions=cell.querySelector('.cell-actions');
    if(!actions||actions.querySelector('.'+BUTTON_CLASS))continue;
    const button=el('button','mini-btn gm-cell-btn '+BUTTON_CLASS,'▣ Fiche MJ');
    button.type='button';
    button.title='Ouvrir la fiche de jeu : portrait, description et toutes les révélations';
    button.setAttribute('aria-label','Ouvrir la fiche MJ de cette cellule');
    button.addEventListener('click',event=>open(nodeId,event));
    button.addEventListener('mousedown',event=>event.stopPropagation());
    button.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
    actions.insertBefore(button,actions.firstChild);
  }
}
function install(){
  css();
  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;addButtons()});
  };
  const layer=document.getElementById('nodes-layer');
  if(layer)new MutationObserver(schedule).observe(layer,{childList:true,subtree:true});
  schedule();
  window.addEventListener('archives:campaign-restored',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
}
window.ArchivesCellBrief={open,close:()=>document.getElementById(DIALOG_ID)?.close()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
