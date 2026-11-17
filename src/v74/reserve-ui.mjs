import {isGM,nativeEditor,element as el,button,sheet,notice} from '../v63/ui.mjs?v=4580';
import {cellTypes,reserveNode,openCellReserve} from './cell-reserve.mjs?v=4580';
const state=()=>window.DuneApp?.getState?.();let records=[],sequence=0;
function scope(){
 if(!isGM())throw Error('Réserve réservée au maître de jeu.');
 if(!nativeEditor())return ['standalone','local'];
 const value=JSON.parse(window.ArchivesCampaignScope||'null');if(!Array.isArray(value)||value.length!==2)throw Error('Attends l’ouverture de la campagne.');return value;
}
async function useStore(action){const key=scope(),store=await openCellReserve(...key);try{if(JSON.stringify(scope())!==JSON.stringify(key))throw Error('La campagne a changé. Rouvre la réserve.');return await action(store)}finally{store.close()}}
const changed=()=>window.dispatchEvent(new CustomEvent('archives:reserve-changed'));
function types(select,all=false){if(all){const o=el('option','Tous les types');o.value='';select.append(o)}for(const [value,label]of cellTypes){const o=el('option',label);o.value=value;select.append(o)}}
async function refresh(){
 const current=++sequence;try{const rows=await useStore(s=>s.list());if(current!==sequence)return;records=rows.sort((a,b)=>a.node.title.localeCompare(b.node.title,'fr'));draw()}catch(e){notice(e.message)}
}
function draw(){
 const grid=document.getElementById('archives-reserve-grid');if(!grid||!isGM())return;
 const query=document.getElementById('archives-reserve-search').value.toLocaleLowerCase('fr'),type=document.getElementById('archives-reserve-type').value;
 grid.replaceChildren();
 for(const r of records.filter(r=>(!type||r.node.category===type)&&[r.node.title,r.node.desc].join(' ').toLocaleLowerCase('fr').includes(query))){
  const card=el('article',null,'reserve-card');card.dataset.reserveId=r.id;
  if(r.node.bgImg){const img=el('img');img.src=r.node.bgImg;img.alt=r.node.title;img.loading='lazy';card.append(img)}
  const desc=el('p',r.node.desc||'Aucune description.');desc.className='reserve-description';
  card.append(el('h3',r.node.title),el('small',cellTypes.find(t=>t[0]===r.node.category)?.[1]||'Cellule'),desc);
  const actions=el('div',null,'reserve-actions');actions.append(button('Modifier',()=>edit(r)),button('Ajouter à l’acte',()=>{
   if(!isGM())return;window.DuneApp.importCatalogCell(reserveNode(r.node));notice('Une copie a été ajoutée, cachée, à l’acte en cours. La réserve est conservée.');
  }),button('Supprimer',()=>{
   const ask=sheet('archives-reserve-delete','Supprimer de la réserve');ask.content.append(el('p','Supprimer « '+r.node.title+' » de la réserve ? Les copies déjà placées dans les actes sont conservées.'),button('Supprimer cette cellule',async()=>{ask.busy(true);try{await useStore(s=>s.remove(r.id));changed();ask.dialog.close();await refresh()}catch(e){ask.status.textContent=e.message;ask.busy(false)}}));
  }));card.append(actions);grid.append(card);
 }
 if(!grid.children.length)grid.append(el('p','Aucune cellule dans cette sélection. Utilise « Nouvelle cellule » pour en préparer une.'));
 document.getElementById('archives-reserve-count').textContent=records.length+' cellule(s) préparée(s) hors du canevas.';
}
function edit(record){
 if(!isGM())return;
 const original=record?.node||{title:'',category:document.getElementById('archives-reserve-type')?.value||'personnage',desc:'',clues:[],gmDetails:[]},view=sheet('archives-reserve-editor',record?'Modifier la cellule en réserve':'Préparer une cellule','Bibliothèque · hors du canevas');
 const form=el('div',null,'reserve-form');view.content.append(form);
 function field(label,node){const wrap=el('label',label);node.setAttribute('aria-label',label);wrap.append(node);form.append(wrap);return node}
 const name=field('Nom de la cellule',el('input'));name.value=original.title;name.maxLength=500;
 const type=field('Type de cellule',el('select'));types(type);type.value=original.category||'personnage';
 const description=field('Description générale',el('textarea'));description.rows=6;description.value=original.desc||'';
 const gmDescription=field('Description MJ — privée',el('textarea'));gmDescription.rows=5;gmDescription.maxLength=100000;gmDescription.value=original.gmDescription||'';
 const faction=field('Faction ou groupe',el('input'));faction.value=original.faction||'';
 let picture=original.bgImg||original.image||original.imageData||'';
 const preview=el('img');preview.className='reserve-preview';preview.alt='Illustration de la cellule en préparation';function image(value){picture=value;preview.src=value;preview.hidden=!value}image(picture);form.append(preview);
 const imageActions=el('div',null,'reserve-actions'),upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.hidden=true;upload.id='archives-reserve-image-file';
 upload.onchange=()=>{const file=upload.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>image(reader.result);reader.onerror=()=>view.status.textContent='Lecture de l’image impossible.';reader.readAsDataURL(file)};
 imageActions.append(button('Importer une image',()=>upload.click()),button('Choisir dans la bibliothèque',async()=>{
  const picker=sheet('archives-reserve-images','Choisir une image'),grid=el('div',null,'reserve-grid'),search=el('input');search.type='search';search.placeholder='Rechercher une image';search.setAttribute('aria-label','Rechercher une image');picker.content.append(search,grid);
  try{const items=await window.ArchivesImageLibrary.refresh();const render=()=>{grid.replaceChildren();for(const item of items.filter(i=>String(i.name).toLocaleLowerCase('fr').includes(search.value.toLocaleLowerCase('fr')))){const b=button(item.name,()=>{image(item.data);picker.dialog.close()}),img=el('img');img.src=item.data;img.alt=item.name;b.prepend(img);grid.append(b)}if(!grid.children.length)grid.append(el('p','Aucune image disponible.'))};search.oninput=render;render()}catch(e){picker.status.textContent=e.message}
 }),button('Retirer l’image',()=>image('')));form.append(imageActions,upload);
 const clues=el('div',null,'reserve-lines');form.append(el('h3','Indices et révélations'),clues);
 function clue(value={}){const row=el('div'),text=el('textarea');text.rows=2;text.value=value.text||'';text.setAttribute('aria-label','Texte de l’indice');row.append(text,button('Retirer cet indice',()=>row.remove()));clues.append(row)}(original.clues||[]).forEach(clue);form.append(button('Ajouter un indice',()=>clue()));
 const details=el('div',null,'reserve-lines');form.append(el('h3','Catégories de la fiche MJ'),details);
 function detail(value={}){const row=el('div'),title=el('input'),text=el('textarea');title.value=value.title||'';title.setAttribute('aria-label','Nom de la catégorie MJ');text.value=value.text||'';text.rows=3;text.setAttribute('aria-label','Informations réservées au MJ');row.append(title,text,button('Retirer cette catégorie',()=>row.remove()));details.append(row)}(original.gmDetails||[]).forEach(detail);form.append(button('Nouvelle catégorie MJ',()=>detail()));
 const save=button('Enregistrer dans la réserve',async()=>{
  view.busy(true);try{
   const node=reserveNode({...original,title:name.value,category:type.value,desc:description.value,gmDescription:gmDescription.value,faction:faction.value,bgImg:picture,
    clues:[...clues.children].map(r=>({text:r.querySelector('textarea').value})),gmDetails:[...details.children].map(r=>({title:r.querySelector('input').value,text:r.querySelector('textarea').value}))});
   if(type.value!==original.category){const t=cellTypes.find(t=>t[0]===type.value);node.shape=t[2];node.color=t[3]}
   await useStore(s=>s.put({id:record?.id||crypto.randomUUID(),node,created:record?.created||Date.now(),updated:Date.now()}));changed();view.dialog.close();await refresh();notice('Cellule enregistrée dans la réserve, sans ajout au canevas.');
  }catch(e){view.status.textContent=e.message;view.busy(false)}
 },'primary');form.append(save);name.focus();
}
async function keep(node){if(!node||!isGM())return;try{await useStore(s=>s.put({id:crypto.randomUUID(),node:reserveNode(node),created:Date.now(),updated:Date.now()}));changed();await refresh();notice('Cellule copiée dans la réserve.')}catch(e){notice(e.message)}}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function install(){
 const section=document.getElementById('catalogue-json-panel');if(!section)return;
 const style=el('style');style.textContent=`.reserve-tools,.reserve-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.reserve-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.reserve-card{padding:14px;border:1px solid #9d875a;border-radius:10px;background:#1b1424;min-width:0}.reserve-card img,.reserve-grid button img{width:100%;height:140px;object-fit:contain}.reserve-description{white-space:pre-wrap;max-height:130px;overflow:auto}.reserve-form{display:grid;gap:14px}.reserve-form label{display:grid;gap:6px}.reserve-form input,.reserve-form select,.reserve-form textarea,#catalogue-json-panel input,#catalogue-json-panel select{font:inherit;padding:10px;border:1px solid #96805a;border-radius:7px;background:#17121f;color:#ffedcd;box-sizing:border-box;max-width:100%}.reserve-form textarea{resize:vertical}.reserve-preview{max-width:100%;height:190px;object-fit:contain}.reserve-lines>div{display:grid;gap:7px;padding:12px;margin:10px 0;border:1px solid #8f755455;border-radius:8px}.reserve-lines input,.reserve-lines textarea{width:100%}#catalogue-json-panel button{font:inherit;padding:9px 12px;border:1px solid #a38a56;border-radius:8px;background:#33243d;color:#ffedcd;cursor:pointer}`;document.head.append(style);
 style.textContent+=' .reserve-tools>input{flex:1;min-width:200px}.reserve-tools>select{width:auto!important;flex:0 1 240px}';
 section.replaceChildren(el('h2','Réserve de cellules'),el('p','Prépare tes cellules ici. Elles restent hors du canevas jusqu’à « Ajouter à l’acte ». Cette réserve privée est incluse dans les sauvegardes complètes.'));
 const actions=el('div',null,'reserve-actions'),importFile=el('input');importFile.type='file';importFile.accept='.json,application/json';importFile.hidden=true;importFile.id='archives-reserve-import-file';
 actions.append(button('Nouvelle cellule',()=>edit()),button('Conserver la cellule sélectionnée',()=>keep(state()?.nodes.find(n=>n.id===state().selectedId))),button('Importer des cellules (JSON)',()=>importFile.click()),button('Exporter la réserve',()=>download({format:'archives-reserve',nodes:records.map(r=>r.node)},'archives-reserve-cellules.json')));
 importFile.onchange=async()=>{try{const file=importFile.files?.[0];if(!file)return;const data=JSON.parse(await file.text()),nodes=data.nodes||data.cells||data.boards?.flatMap(b=>b.nodes)||[data.node||data.cell].filter(Boolean);if(!nodes?.length)throw Error('Aucune cellule dans ce fichier.');const rows=nodes.map(n=>({id:crypto.randomUUID(),node:reserveNode(n),created:Date.now(),updated:Date.now()}));await useStore(s=>s.restore(rows));changed();await refresh()}catch(e){notice(e.message)}finally{importFile.value=''}};
 const tools=el('div',null,'reserve-tools'),search=el('input'),type=el('select');search.id='archives-reserve-search';search.type='search';search.placeholder='Rechercher dans la réserve…';search.setAttribute('aria-label','Rechercher dans la réserve');type.id='archives-reserve-type';type.setAttribute('aria-label','Filtrer le type de cellule');types(type,true);tools.append(search,type);search.oninput=type.onchange=draw;
 const count=el('p');count.id='archives-reserve-count';const grid=el('div',null,'reserve-grid');grid.id='archives-reserve-grid';section.append(actions,importFile,tools,count,grid);
 const original=window.ArchivesCatalogue.libraryPanel;window.ArchivesCatalogue.libraryPanel=function(which){if(!isGM())return;original.call(this,which);const head=document.querySelector('#archives-library-popout>div>div');if(head){const switcher=button(which==='images'?'Réserve de cellules':'Bibliothèque d’images',()=>window.ArchivesCatalogue.libraryPanel(which==='images'?'cells':'images'));switcher.className='catalogue-back';head.insertBefore(switcher,head.lastElementChild)}if(which!=='images')void refresh()};
 window.ArchivesCellReserve={open:()=>window.ArchivesCatalogue.libraryPanel('cells'),refresh,keep};
 window.addEventListener('archives:campaign-restored',()=>void refresh());
 const hidePrivate=()=>{
  if(isGM())return;sequence++;records=[];grid.replaceChildren();
  for(const id of ['archives-reserve-editor','archives-reserve-images','archives-reserve-delete'])document.getElementById(id)?.close();
  const pop=document.getElementById('archives-library-popout');
  if(pop?.contains(section)){const home=document.getElementById('catalogue-json-panel-home');home?.parentNode.insertBefore(section,home.nextSibling);section.hidden=true;pop.remove()}
 };
 new MutationObserver(hidePrivate).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('archives:public-view',hidePrivate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
