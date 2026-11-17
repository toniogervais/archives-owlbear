import {sheet,element,button,isGM} from '../v63/ui.mjs?v=4590';
const compact=matchMedia('(max-width:1100px), (pointer:coarse)'),groups=new Set();
function tools(id,label,nodes,parent,before){
 let detail=document.getElementById(id);if(detail)return detail;
 detail=element('details',null,'archives-library-tools');detail.id=id;detail.append(element('summary',label));
 parent.insertBefore(detail,before||null);for(const node of nodes)if(node)detail.append(node);
 detail.open=!compact.matches;groups.add(detail);return detail;
}
compact.addEventListener('change',()=>{for(const d of groups)if(d.isConnected)d.open=!compact.matches});
function images(){
 const root=document.getElementById('archives-image-library'),search=document.getElementById('archives-image-library-search'),grid=document.getElementById('archives-image-library-grid');if(!root||!search||!grid)return;
 if(!root.dataset.readable){
  root.dataset.readable='true';const row=search.parentElement,searchRow=element('div',null,'archives-library-search');searchRow.append(search);search.setAttribute('aria-label','Rechercher une image');
  root.insertBefore(searchRow,document.getElementById('archives-image-type-tabs'));const selection=document.getElementById('archives-image-library-selection');
  tools('archives-image-tools','Outils de la bibliothèque',[row,selection,root.querySelector(':scope > p')],root,grid);
  new MutationObserver(imageCards).observe(grid,{childList:true});imageCards();
 }
}
function imageCards(){for(const d of groups)if(!d.isConnected)groups.delete(d);
 const grid=document.getElementById('archives-image-library-grid');if(!grid)return;
 for(const card of grid.querySelectorAll('article[data-image-card]:not([data-readable])')){
  card.dataset.readable='true';const id=card.dataset.imageCard,actions=[...card.querySelectorAll(':scope > button')];
  if(actions.length)tools('image-tools-'+id,'Actions',actions,card);
  const read=button('Agrandir l’image',()=>{if(isGM())window.ArchivesImageLibrary?.openPreview(id)},'archives-library-read');read.setAttribute('aria-label','Agrandir l’image '+(card.querySelector('strong')?.textContent||''));card.querySelector('img')?.after(read);
 }
}
function readReserve(card){
 if(!isGM())return;const name=card.querySelector('h3')?.textContent||'Cellule',view=sheet('archives-reserve-reader',name,'Réserve de cellules');
 const image=card.querySelector('img');if(image){const copy=image.cloneNode();copy.className='archives-library-reader-image';view.content.append(copy)}
 const description=element('p',card.querySelector('.reserve-description')?.textContent||'Aucune description.','archives-library-reader-text');view.content.append(description);
}
function reserves(){
 const root=document.getElementById('catalogue-json-panel'),grid=document.getElementById('archives-reserve-grid');if(!root||!grid)return;
 if(!root.dataset.readable){
  root.dataset.readable='true';const actions=root.querySelector(':scope > .reserve-actions'),buttons=[...(actions?.querySelectorAll('button')||[])];
  tools('archives-reserve-tools','Outils de la réserve',[root.querySelector(':scope > p'),...buttons.slice(1)],root,root.querySelector('.reserve-tools'));
  new MutationObserver(reserveCards).observe(grid,{childList:true});reserveCards();
 }
}
function reserveCards(){for(const d of groups)if(!d.isConnected)groups.delete(d);
 const grid=document.getElementById('archives-reserve-grid');if(!grid)return;
 for(const card of grid.querySelectorAll('article:not([data-readable])')){
  card.dataset.readable='true';const actions=card.querySelector('.reserve-actions');if(actions)tools('reserve-tools-'+card.dataset.reserveId,'Actions de la cellule',[actions],card);
  const read=button('Lire la fiche',()=>readReserve(card),'archives-library-read');card.querySelector('.reserve-description')?.before(read);
 }
}
function documents(){
 const dialog=document.getElementById('archives-file-library');if(!dialog||dialog.dataset.readable)return;
 dialog.dataset.readable='true';const row=dialog.querySelector('.tools'),add=row?.querySelector('[data-import]'),all=row?.querySelector('[data-all]');
 if(row)tools('archives-document-tools','Ajouter et gérer les fichiers',[add,all,dialog.querySelector(':scope > .hint'),dialog.querySelector('[data-library] > .hint')],row.parentElement,row);
 const library=dialog.querySelector('[data-library]');if(library)library.classList.add('archives-readable-documents');
}
function install(){images();reserves();documents();new MutationObserver(documents).observe(document.body,{childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
