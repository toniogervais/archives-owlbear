/* V4.42 — jusqu’à quatre fiches MJ, indépendantes et consultables côte à côte. */
const DIALOG_ID='archives-cell-brief';
const BUTTON_CLASS='archives-cell-brief-trigger';
let activeNodeIds=[];
let fitFrame=0;
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
  #archives-cell-brief .brief-share-image {flex:0 0 auto;padding:7px 9px;margin:6px 0;border:1px solid #bca06a80;border-radius:7px;background:#2a2034;color:#f2d9a5;font-size:12px}
  #archives-cell-brief .brief-share-image:hover {background:#49334f}
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
  #archives-cell-brief[data-count]:not([data-count="1"]) {width:98vw;max-width:98vw}
  #archives-cell-brief .brief-toolbar {display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
  #archives-cell-brief .brief-toolbar select {min-width:0;max-width:240px;background:#181320;color:#f6ebdc;border:1px solid #82704e;border-radius:7px;padding:8px;font:inherit}
  #archives-cell-brief .brief-add {border:1px solid #c2a66d;background:#463622;color:#fff0d1;border-radius:7px;padding:8px}
  #archives-cell-brief button:disabled,#archives-cell-brief select:disabled {opacity:.5;cursor:default}
  #archives-cell-brief .brief-deck {display:grid;grid-template-columns:repeat(var(--brief-count,1),minmax(280px,1fr));gap:12px;flex:1;min-height:0;overflow-x:auto;padding:12px}
  #archives-cell-brief .brief-card {display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid #8d76567b;border-radius:10px;overflow:hidden}
  #archives-cell-brief .brief-card-header {display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#2b2138}
  #archives-cell-brief .brief-card-header h2 {font-size:18px;margin:0}
  #archives-cell-brief .brief-card-header button {width:28px;height:28px;font-size:18px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-body {display:flex;flex-direction:column;overflow:hidden}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-portrait {flex:0 0 150px;min-height:0;padding:8px;border-right:0;border-bottom:1px solid #c5a76e55}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-figure {min-height:0}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-subtitle {font-size:10px;padding-top:4px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-right {flex:1;min-height:0}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-desc {padding:12px;min-height:90px;flex:1 1 40%}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-description {font-size:13px;line-height:1.5}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clues {min-height:120px;flex:1 1 60%}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clues-header {padding:10px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clue-list {padding:5px 8px 10px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clue-row {padding:8px;gap:7px;flex-wrap:wrap}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clue-text {font-size:13px}
  @media(max-width:690px) {
    #archives-cell-brief .brief-header {padding:10px;flex-wrap:wrap}
    #archives-cell-brief .brief-header > .brief-close {position:absolute;right:10px;top:10px}
    #archives-cell-brief .brief-toolbar {width:100%;padding-right:0}
    #archives-cell-brief .brief-toolbar select {flex:1}
    #archives-cell-brief .brief-deck {grid-template-columns:repeat(var(--brief-count,1),minmax(280px,1fr));padding:8px;gap:8px}
  }
  #archives-cell-brief .brief-portrait{overflow:auto;display:block}
  #archives-cell-brief .brief-figure{position:relative;display:flex;flex-direction:column;flex:none;height:250px;min-height:180px}
  #archives-cell-brief .brief-figure h2{flex:none;margin:0;padding:8px 35px;width:100%;text-align:center;font-size:17px;background:#2b2138}
  #archives-cell-brief .brief-figure>.brief-close{position:absolute;right:4px;top:4px;width:28px;height:28px;font-size:18px;z-index:1}
  #archives-cell-brief .brief-photo{flex:1;min-height:0;width:100%;display:grid;place-items:center;overflow:hidden}
  #archives-cell-brief .brief-gm-field{margin-top:14px;padding-top:12px;border-top:1px solid #c5a76e55}
  #archives-cell-brief .brief-gm-field h3{margin-bottom:5px}
  #archives-cell-brief .brief-gm-text{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;font-size:13px;line-height:1.55}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-portrait{flex:0 1 40%;min-height:180px;overflow:auto}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-figure{height:150px;min-height:120px}
  @media(max-width:690px){#archives-cell-brief .brief-portrait{max-height:none;min-height:180px}}
  /* One compact, content-driven layout. Empty clues no longer reserve space. */
  #archives-cell-brief {min-width:min(380px,96vw);min-height:min(340px,94dvh);font-size:var(--brief-font,14px);line-height:1.4}
  #archives-cell-brief .brief-header {padding:9px 14px}
  #archives-cell-brief .brief-footer {padding:7px 22px 7px 14px}
  #archives-cell-brief .brief-right {display:grid;grid-template-rows:minmax(0,var(--desc-share,1fr)) minmax(0,var(--clue-share,1fr));overflow:hidden}
  #archives-cell-brief .brief-card[data-clues="0"] .brief-right {grid-template-rows:minmax(0,1fr)}
  #archives-cell-brief .brief-clues[hidden] {display:none!important}
  #archives-cell-brief .brief-desc {min-height:0;padding:12px 15px;gap:0}
  #archives-cell-brief .brief-description,#archives-cell-brief .brief-gm-description,#archives-cell-brief .brief-gm-text,#archives-cell-brief .brief-clue-text {font-size:inherit;line-height:1.4}
  #archives-cell-brief h3 {font-size:1em;line-height:1.3;margin:0 0 6px}
  #archives-cell-brief .brief-gm-description+h3,#archives-cell-brief .brief-description+h3 {margin-top:12px}
  #archives-cell-brief .brief-clues {min-height:0}
  #archives-cell-brief .brief-clues-header {padding:9px 12px 6px;flex:none}
  #archives-cell-brief .brief-clue-list {flex:1;gap:5px;padding:2px 10px 10px}
  #archives-cell-brief .brief-clue-row {padding:7px 9px;gap:8px;flex:none}
  #archives-cell-brief .brief-figure {height:190px;min-height:110px}
  #archives-cell-brief .brief-card[data-gm-fields="true"] .brief-figure {height:130px;min-height:90px}
  #archives-cell-brief .brief-card[data-picture="false"] .brief-figure {height:auto;min-height:0}
  #archives-cell-brief .brief-card[data-picture="false"] .brief-photo {min-height:0}
  #archives-cell-brief .brief-card[data-picture="false"] .brief-no-picture {padding:10px;font-size:11px}
  #archives-cell-brief .brief-portrait {padding:10px}
  #archives-cell-brief .brief-gm-field {margin-top:10px;padding-top:8px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-desc {min-height:0;padding:10px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-description,#archives-cell-brief[data-count]:not([data-count="1"]) .brief-clue-text {font-size:inherit;line-height:1.4}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-portrait {flex:0 1 auto;min-height:0;max-height:37%}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-figure {height:115px;min-height:90px}
  #archives-cell-brief[data-count]:not([data-count="1"]) .brief-clues {min-height:0}
  #archives-cell-brief .brief-resize-handle {position:absolute;right:0;bottom:0;width:24px;height:24px;padding:0;border:0;border-radius:0 0 12px 0;background:#35273f;color:#ebd19c;cursor:nwse-resize;touch-action:none;font-size:20px;line-height:1;z-index:2}
  @media(max-width:690px){
    #archives-cell-brief {resize:both}
    #archives-cell-brief .brief-body {overflow:hidden}
    #archives-cell-brief .brief-portrait {flex:0 1 auto;min-height:0;max-height:32%}
    #archives-cell-brief .brief-figure {height:110px;min-height:90px}
    #archives-cell-brief .brief-right {flex:1;min-height:0}
    #archives-cell-brief .brief-desc,#archives-cell-brief .brief-clues {min-height:0}
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
  dialog.setAttribute('aria-label','Fiches MJ de consultation des cellules');
  const shell=el('div','brief-shell'),header=el('header','brief-header');
  const titles=el('div','brief-titles');
  titles.append(el('span','brief-overline','Maître du jeu'),el('h2',null,'Fiches MJ'));
  const toolbar=el('div','brief-toolbar'),select=el('select');
  select.id='archives-brief-picker';select.setAttribute('aria-label','Cellule à ajouter aux fiches MJ');
  const add=el('button','brief-add','＋ Ajouter une fiche');add.type='button';add.id='archives-brief-add';
  add.onclick=()=>{if(select.value)open(select.value)};
  const count=el('span','brief-hint');count.id='archives-brief-deck-count';count.setAttribute('role','status');
  const fit=el('button','brief-add','⤢');fit.type='button';fit.title='Ajuster au contenu';fit.setAttribute('aria-label','Ajuster les fiches au contenu');fit.onclick=()=>queueFit(true);
  toolbar.append(select,add,count,fit);
  const close=el('button','brief-close','×');close.type='button';close.title='Fermer les fiches (Échap)';close.setAttribute('aria-label','Fermer les fiches MJ');close.onclick=()=>dialog.close();
  header.append(titles,toolbar,close);
  const deck=el('div','brief-deck');deck.id='archives-brief-deck';
  const footer=el('footer','brief-footer');
  footer.append(el('span',null,'Cocher révèle un indice aux joueurs si la cellule leur est visible. Décocher le masque.'));
  const back=el('button',null,'Fermer');back.type='button';back.onclick=()=>dialog.close();footer.append(back);
  shell.append(header,deck,footer);dialog.append(shell);document.body.append(dialog);
  const grip=el('button','brief-resize-handle','◢');grip.type='button';grip.title='Glisser pour redimensionner';grip.setAttribute('aria-label','Redimensionner les fiches MJ');dialog.append(grip);
  let drag;
  const size=(width,height)=>{dialog.style.width=Math.max(Math.min(380,innerWidth*.96),Math.min(width,innerWidth*.96))+'px';dialog.style.height=Math.max(Math.min(340,innerHeight*.94),Math.min(height,innerHeight*.94))+'px';queueFit(false)};
  grip.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();const box=dialog.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,width:box.width,height:box.height};grip.setPointerCapture(event.pointerId)};
  grip.onpointermove=event=>{if(drag)size(drag.width+2*(event.clientX-drag.x),drag.height+2*(event.clientY-drag.y))};
  grip.onpointerup=grip.onpointercancel=()=>{drag=null};
  grip.onkeydown=event=>{const directions={ArrowRight:[20,0],ArrowLeft:[-20,0],ArrowDown:[0,20],ArrowUp:[0,-20]},step=directions[event.key];if(step){event.preventDefault();size(dialog.offsetWidth+step[0],dialog.offsetHeight+step[1])}};
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>queueFit(false)).observe(dialog);
  window.addEventListener('resize',()=>{if(dialog.open){size(dialog.offsetWidth,dialog.offsetHeight);queueFit(false)}});
  dialog.addEventListener('close',()=>{if(dialog.open)return;activeNodeIds=[];deck.replaceChildren()});
  return dialog;
}
function renderCard(node,index){
  const card=el('article','brief-card');card.dataset.nodeId=String(node.id);
  const id=(part)=>'archives-brief-'+part+(index?'-'+index:'');
  const header=el('header','brief-card-header'),title=el('h2',null,node.title||'Cellule sans titre');title.id=id('title');
  card.setAttribute('aria-labelledby',title.id);
  const remove=el('button','brief-close','×');remove.type='button';remove.setAttribute('aria-label','Retirer la fiche '+(node.title||'sans titre'));
  remove.onclick=()=>{activeNodeIds=activeNodeIds.filter(value=>value!==String(node.id));if(!activeNodeIds.length)document.getElementById(DIALOG_ID).close();else renderDeck()};

  const body=el('div','brief-body'),portrait=el('aside','brief-portrait'),picture=el('div','brief-figure');picture.id=id('figure');
  picture.append(title,remove);
  const photo=el('div','brief-photo');picture.append(photo);
  const url=node.bgImg||node.image||node.imageData;
  card.dataset.picture=String(!!url);card.dataset.gmFields=String(!!node.gmDetails?.length);
  if(typeof url==='string'&&url){
    const img=el('img','brief-picture');img.src=url;img.alt='Portrait ou illustration : '+(node.title||'cellule');
    img.onerror=()=>photo.replaceChildren(el('span','brief-no-picture','Image indisponible'));photo.append(img);
  }else photo.append(el('span','brief-no-picture','Aucun portrait ou illustration associé à cette cellule'));
  const category=el('div','brief-subtitle',[node.category||'Cellule',node.faction||'',node.revealed?'Cellule révélée':'Cellule cachée'].filter(Boolean).join(' · '));category.id=id('category');portrait.append(picture,category);
  card.dataset.npcSheet=String(node.category==='personnage');
  if(typeof url==='string'&&url){
    const show=el('button','brief-share-image','▣ Montrer l’image aux joueurs');show.type='button';
    show.title='Présenter uniquement l’image, sans révéler la cellule ni ses indices';
    show.onclick=()=>void window.ArchivesPresentation?.presentCell(node.id);portrait.append(show);
  }
  if(node.category==='personnage'){
    const npc=window.ArchivesNpcSheet?.renderNpcPanel?.(node);
    if(npc)portrait.append(npc);
  }
  for(const field of Array.isArray(node.gmDetails)?node.gmDetails:[]){
    const section=el('section','brief-gm-field');section.append(el('h3',null,field.title),el('div','brief-gm-text',field.text||''));portrait.append(section);
  }
  const right=el('div','brief-right'),section=el('section','brief-desc');
  const description=el('div','brief-description',node.desc?.trim()||'Aucune description générale renseignée.');description.id=id('description');
  if(!node.desc?.trim())description.classList.add('brief-hint');section.append(el('h3',null,'Description générale'),description);
  if(node.gmDescription?.trim()){
    const privateDescription=el('div','brief-gm-description',node.gmDescription);privateDescription.style.whiteSpace='pre-wrap';privateDescription.style.marginTop='8px';
    section.append(el('h3',null,'Description MJ'),privateDescription);
  }
  const clues=Array.isArray(node.clues)?node.clues:[],clueArea=el('section','brief-clues'),clueHeader=el('div','brief-clues-header');
  card.dataset.clues=String(clues.length);clueArea.hidden=!clues.length;
  const counter=el('span','brief-count',clues.filter(c=>c.revealed).length+' / '+clues.length+' révélés');counter.id=id('count');
  clueHeader.append(el('h3',null,'Indices et révélations'),counter);
  const list=el('div','brief-clue-list');list.id=id('list');
  if(!clues.length)list.append(el('div','brief-hint','Aucun indice ou révélation n’est associé à cette cellule.'));
  for(const clue of clues){
    const row=el('label','brief-clue-row');row.dataset.revealed=clue.revealed?'true':'false';
    const checkbox=el('input','brief-clue-checkbox');checkbox.type='checkbox';checkbox.checked=!!clue.revealed;
    checkbox.setAttribute('aria-label','Révéler aux joueurs : '+String(clue.text||'indice'));
    row.append(checkbox,el('span','brief-clue-text',clue.text||'(Indice sans texte)'),el('span','brief-status',clue.revealed?'Révélé':'Secret'));
    checkbox.addEventListener('change',()=>{
      if(!gmState()||!window.DuneApp?.setBriefClueRevealed?.(node.id,clue.id,checkbox.checked)){checkbox.checked=!checkbox.checked;return}
      renderDeck();
    });list.append(row);
  }
  clueArea.append(clueHeader,list);right.append(section,clueArea);body.append(portrait,right);card.append(body);return card;
}
function renderDeck(){
  const dialog=document.getElementById(DIALOG_ID),state=gmState();if(!dialog)return;
  if(!state){dialog.close();return}
  activeNodeIds=activeNodeIds.filter(id=>currentNode(id));
  if(!activeNodeIds.length){dialog.close();return}
  const deck=document.getElementById('archives-brief-deck'),scroll=new Map();
  for(const card of deck.children)scroll.set(card.dataset.nodeId,[card.querySelector('.brief-desc').scrollTop,card.querySelector('.brief-clue-list').scrollTop,card.querySelector('.brief-portrait').scrollTop]);
  deck.replaceChildren(...activeNodeIds.map((id,index)=>renderCard(currentNode(id),index)));
  for(const card of deck.children){const saved=scroll.get(card.dataset.nodeId);if(saved){card.querySelector('.brief-desc').scrollTop=saved[0];card.querySelector('.brief-clue-list').scrollTop=saved[1];card.querySelector('.brief-portrait').scrollTop=saved[2]||0}}
  dialog.dataset.count=String(activeNodeIds.length);deck.style.setProperty('--brief-count',activeNodeIds.length);
  const select=document.getElementById('archives-brief-picker'),previous=select.value;
  select.replaceChildren(el('option',null,'Choisir une cellule…'));select.firstChild.value='';
  for(const node of state.nodes||[])if(!activeNodeIds.includes(String(node.id))){const option=el('option',null,node.title||'Cellule sans titre');option.value=String(node.id);select.append(option)}
  if([...select.options].some(option=>option.value===previous))select.value=previous;
  select.disabled=activeNodeIds.length>=4||select.options.length===1;
  document.getElementById('archives-brief-add').disabled=select.disabled;
  document.getElementById('archives-brief-deck-count').textContent=activeNodeIds.length+' / 4 fiches';
  queueFit(false);
}
function contentHeight(element){
  const style=getComputedStyle(element),children=Array.from(element.children);
  return (parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0)+children.reduce((height,child)=>{const css=getComputedStyle(child);return height+child.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0)},0)+Math.max(0,children.length-1)*(parseFloat(style.rowGap)||0);
}
function fitContent(resize){
  const dialog=document.getElementById(DIALOG_ID);if(!dialog?.open||!dialog.offsetHeight)return;
  if(resize){dialog.style.width=Math.min(innerWidth*.96,activeNodeIds.length===1?1240:activeNodeIds.length*460)+'px';dialog.style.height=Math.min(innerHeight*.94,900)+'px'}
  const cards=Array.from(dialog.querySelectorAll('.brief-card'));let measurements=[];
  for(const font of [14,13,12]){
    dialog.style.setProperty('--brief-font',font+'px');
    measurements=cards.map(card=>{
      const desc=contentHeight(card.querySelector('.brief-desc')),clueArea=card.querySelector('.brief-clues'),clues=clueArea.hidden?0:contentHeight(card.querySelector('.brief-clue-list'))+card.querySelector('.brief-clues-header').offsetHeight+2;
      const portrait=contentHeight(card.querySelector('.brief-portrait')),stacked=getComputedStyle(card.querySelector('.brief-body')).display==='flex';
      return {card,desc,clues,natural:stacked?desc+clues+Math.min(portrait,card.querySelector('.brief-portrait').offsetHeight):Math.max(portrait,desc+clues)};
    });
    const chrome=dialog.offsetHeight-dialog.querySelector('.brief-body').offsetHeight;
    if(measurements.every(item=>item.natural<=dialog.offsetHeight-chrome+2)||font===12){
      if(resize)dialog.style.height=Math.min(innerHeight*.94,Math.max(360,Math.max(...measurements.map(item=>item.natural))+chrome+6))+'px';break;
    }
  }
  for(const {card,desc,clues} of measurements){card.style.setProperty('--desc-share',Math.max(60,desc)+'fr');card.style.setProperty('--clue-share',Math.max(50,clues)+'fr')}
}
function queueFit(resize){
  if(resize)queueFit.resize=true;
  if(fitFrame)return;
  fitFrame=requestAnimationFrame(()=>{fitFrame=0;const resize=!!queueFit.resize;queueFit.resize=false;fitContent(resize)});
}
function open(nodeId,event){
  event?.stopPropagation?.();event?.preventDefault?.();
  if(!gmState()){document.getElementById(DIALOG_ID)?.close();return}
  if(!currentNode(nodeId))return;
  css();const dialog=ensureDialog(),id=String(nodeId);
  if(!dialog.open)activeNodeIds=[];
  if(!activeNodeIds.includes(id)){
    if(activeNodeIds.length>=4)return;
    activeNodeIds.push(id);
  }
  renderDeck();if(!dialog.open)dialog.showModal();queueFit(true);
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
    requestAnimationFrame(()=>{queued=false;addButtons();if(document.getElementById(DIALOG_ID)?.open)renderDeck()});
  };
  const layer=document.getElementById('nodes-layer');
  if(layer)new MutationObserver(schedule).observe(layer,{childList:true,subtree:true});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
  window.addEventListener('archives:campaign-restored',schedule);
  window.addEventListener('archives:gm-details',schedule);
  window.addEventListener('archives:npc-sheet',schedule);
  window.addEventListener('archives:npc-sheet-ready',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
}
window.ArchivesCellBrief={open,close:()=>document.getElementById(DIALOG_ID)?.close()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
