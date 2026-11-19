import {VERSION,validateLibrary,parseLibraryText,parseLibraryFileText,normalize,literalPrice,quantity,safeCart,inventoryText} from './model.mjs';
import {prepareEntries,searchEntries,makeAliases,libraryPages,profileText,profileRolls} from './search.mjs';
import {getStored,putStored,deleteStored} from './storage.mjs';
import {bridge,ready,OBR} from './bridge.mjs';
import {sectionExcerpt} from './reader.mjs';
import {assembleEntries,localKeyPoints,suggestedRules,SITUATIONS} from './content.mjs';
import {readBookPdf} from './pdf-import.mjs';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={rule:'Règle',action:'Action',equipment:'Équipement',npc:'PNJ',creature:'Bestiaire',page:'Texte du livre',reference:'Référence'};
const topics={combat:'Combat',magie:'Magie',matrice:'Matrice',rigging:'Rigging',personnage:'Personnages',equipement:'Équipement',variantes:'Règle optionnelle',creatures:'Créatures',mj:'Maître de jeu',univers:'Univers'};
const state={entries:[],books:[],equipment:[],profiles:[],rules:[],coverage:{},terms:{},favorites:new Set(),notes:{},library:null,kind:'',selected:null,query:'',topic:'',source:'',offset:0,cart:[],seq:0,worker:null,bridge:null,isGm:false,trail:[],trailAt:-1,workerReady:false};
let toastTimer,searchTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function fail(e){toast(e.message||String(e));}
function sourceBook(id){return state.books.find(b=>b.id===id);}
function sourceName(id){const b=sourceBook(id);return b?.displayTitle||b?.title||id;}
function resolveEntry(id){const known=state.byId?.get(id);if(known)return known;const m=/^page:([a-z]+):(\d+)$/.exec(String(id));if(!m)return null;const b=sourceBook(m[1]),page=Number(m[2]);if(!b||page<1||page>b.pageCount)return null;const printed=page-b.printedOffset;return {id,title:`${sourceName(b.id)} · ${printed>0?'p. '+printed:'PDF '+page}`,source:b.id,page,printedPage:printed,kind:'page'};}
function sourceLabel(e){return `${sourceName(e.source)} · ${e.printedPage>0?'p. '+e.printedPage:'PDF '+e.page}`;}
function fmt(n){return n.toLocaleString('fr-FR');}
function title(e){return e.title||e.name;}
async function savePreferences(){const r=await putStored('preferences',{favorites:[...state.favorites],notes:state.notes});if(!r.persistent)toast('Les préférences ne sont pas conservées : '+r.message);}
function setKind(kind){
 if(kind==='mj'){void showNpcInventory();return;}
 state.kind=kind;$('#tabs').querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});
 updateCategoryFilter();
 $('#quick').hidden=Boolean(kind);$('.workspace').classList.remove('show-detail');runSearch();
}
function updateCategoryFilter(){
 const select=$('#category'),previous=select.value;select.replaceChildren();
 const relevant=state.kind==='equipment'||state.kind==='creature';select.hidden=!relevant;
 const first=document.createElement('option');first.value='';first.textContent=state.kind==='creature'?'Tous les habitats':'Toutes les familles';select.append(first);
 if(!relevant)return;
 const values=new Map(),freq=new Map();const entries=state.entries.filter(e=>e.kind===state.kind);
 for(const e of entries)for(const part of new Set(e.path||[])){const k=normalize(part);freq.set(k,(freq.get(k)||0)+1);}
 for(const e of entries){if(state.kind==='creature'){if(e.habitat)values.set(normalize(e.habitat),e.habitat);}else{if(e.category)values.set(normalize(e.category),e.category);for(const part of e.path||[])if(freq.get(normalize(part))>=5&&!/catalogue|arsenal|tables|boîte à outils|la vie|introduction/i.test(part))values.set(normalize(part),part);}}
 for(const value of [...values.values()].sort((a,b)=>a.localeCompare(b,'fr'))){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}select.value=[...values.values()].includes(previous)?previous:'';
}
function searchOptions(){return {query:$('#search').value,kind:state.kind==='favorites'?'':state.kind,topic:$('#topic').value,source:$('#source').value,favorites:state.kind==='favorites'?[...state.favorites]:null,offset:state.offset,limit:75,practicalOnly:$('#practicalOnly').checked,category:$('#category').value};}
function runSearch(append=false){
 if(!state.prepared)return;
 if(!append)state.offset=0;const seq=++state.seq;const options=searchOptions();state.query=options.query;
 const fulltext=$('#fulltext').checked||Boolean(state.library&&state.kind==='favorites');
 const references=state.kind==='favorites'?[...state.favorites].map(resolveEntry).filter(e=>e?.kind==='page'):[];
 // The catalog answers immediately; full-book results enrich it in the worker.
 const local=searchEntries([...state.prepared,...prepareEntries(references)],{...options,favorites:options.favorites?new Set(options.favorites):null},state.aliases);
 renderResults({...local,seq});
 if(state.worker&&state.workerReady&&fulltext)state.worker.postMessage({type:'search',seq,options,fulltext,references});
}
function renderResults(r){
 if(r.seq!==state.seq)return;
 const root=$('#results');if(state.offset===0)root.replaceChildren();
 $('#resultCount').textContent=`${fmt(r.total)} ${r.total===1?'résultat':'résultats'}${r.corrected?' · orthographe approchée':''}`;
 $('#more').hidden=state.offset+r.items.length>=r.total;
 if(!r.total){state.pendingAction=null;root.innerHTML='<div class="empty">Aucun résultat. Essaie un terme plus court ou un autre ouvrage.</div>';return;}
 const frag=document.createDocumentFragment();
 for(const e of r.items){
  const button=document.createElement('button');button.className='result'+(state.selected?.id===e.id?' active':'');button.dataset.id=e.id;
  button.innerHTML=`<span class="name">${state.favorites.has(e.id)?'★ ':''}${esc(title(e))}</span><span class="meta"><span class="type">${esc(labels[e.kind]||'Référence')}</span><span>${esc(sourceLabel(e))}</span>${e.optional?'<span>Optionnelle</span>':''}</span>${e.procedure?.test?`<span class="result-roll">${esc(e.procedure.test)}</span>`:''}${e.summary?`<span class="excerpt">${esc(e.summary)}</span>`:''}`;
  button.addEventListener('click',()=>selectEntry(e));const item=document.createElement('div');item.setAttribute('role','listitem');item.append(button);frag.append(item);
 }
 root.append(frag);
 if(state.pendingAction){const action=state.pendingAction;state.pendingAction=null;const first=root.querySelector('.result');if(first)action==='open'?first.click():first.focus();}
}
function noteHtml(e){return `<label class="note-label" for="entryNote">Ma note</label><textarea id="entryNote" class="note" maxlength="12000" placeholder="Ajouter une précision pour mes parties…">${esc(state.notes[e.id]||'')}</textarea><span id="noteStatus" class="small"></span>`;}
function tableRows(fields){return `<div class="table-wrap"><table><tbody>${fields.map(f=>`<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`).join('')}</tbody></table></div>`;}
function relationHtml(e){
 const rel=(e.related||[]).map(id=>state.byId.get(id)).filter(Boolean);
 if(!rel.length)return '';
 return `<h3>À consulter aussi</h3>${rel.map(e=>`<button class="relation" data-entry="${esc(e.id)}">${esc(title(e))}</button>`).join('')}`;
}
function headerHtml(e){return `<div class="topline"><button class="subtle back-mobile" id="backResults">Résultats</button><span class="breadcrumb">${esc(topics[e.topic]||e.habitat||e.category||'Compendium')}</span><button id="favorite" class="iconbutton" aria-label="${state.favorites.has(e.id)?'Retirer des favoris':'Ajouter aux favoris'}" aria-pressed="${state.favorites.has(e.id)}">${state.favorites.has(e.id)?'★':'☆'}</button></div><div class="badges"><span class="badge">${esc(labels[e.kind]||'Référence')}</span>${e.summary&&e.kind!=='page'?'<span class="badge summary">Rappel en français</span>':''}${e.optional?'<span class="badge optional">Règle optionnelle</span>':''}${e.verification==='a-verifier'?'<span class="badge optional">Extraction à vérifier dans la source</span>':''}</div><h2>${esc(title(e))}</h2>${e.originalTitle&&e.originalTitle!==title(e)?`<p class="original-title">${esc(e.originalTitle)}</p>`:''}`;}
function procedureHtml(p){
 const names={test:'Jet de dés',opposition:'Opposition',threshold:'Seuil',action:'Action et timing',access:'Accès nécessaire',effect:'Résultat',limits:'À ne pas oublier',cost:'Karma',example:'Exemple'};
 return `<section class="procedure" aria-label="Procédure de jeu">${Object.entries(names).filter(([k])=>p[k]).map(([k,n])=>`<div class="procedure-row ${k==='test'?'main-roll':''}"><span>${n}</span><p>${esc(p[k])}</p></div>`).join('')}</section>`;
}
async function selectEntry(e,{mobile=true,remember=true}={}){
 if(!e)return;
 if(remember&&state.trail[state.trailAt]!==e.id){state.trail.splice(state.trailAt+1);state.trail.push(e.id);state.trailAt=state.trail.length-1;}
 state.selected=e;history.replaceState(null,'',`?entry=${encodeURIComponent(e.id)}`);const root=$('#detail');delete root.dataset.inventory;root.innerHTML=headerHtml(e);
 root.insertAdjacentHTML('afterbegin',`<div class="detail-nav"><button id="entryPrev" class="subtle" ${state.trailAt<=0?'disabled':''}>Retour</button><button id="entryNext" class="subtle" ${state.trailAt>=state.trail.length-1?'disabled':''}>Suivant</button><button id="copyEntry" class="subtle">Copier la fiche</button></div>`);
 if(e.procedure)root.insertAdjacentHTML('beforeend',procedureHtml(e.procedure));
 if(e.attributes){
  root.insertAdjacentHTML('beforeend',`<dl class="stat-grid">${Object.entries(e.attributes).map(([k,v])=>`<div class="stat"><dt title="${esc(state.terms.attributes?.find(a=>a.fr===k)?.french||k)}">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="derived">${Object.entries(e.derived||{}).map(([k,v])=>`<span><b>${esc(k)}</b>${esc(v)}</span>`).join('')}</div>`);
  const rolls=profileRolls(e);if(rolls.length)root.insertAdjacentHTML('beforeend',`<h3>Jets courants</h3><div class="profile-rolls">${rolls.map(r=>`<div><span>${esc(r.label)}</span><strong>${esc(r.value)}</strong><small>${esc(r.formula)}</small></div>`).join('')}</div>`);
  for(const [k,v] of Object.entries(e.sections||{})){root.insertAdjacentHTML('beforeend',`<h3>${esc(k)}</h3><p>${esc(v)}</p>`);}
  if(e.sourceNotes)root.insertAdjacentHTML('beforeend',`<p class="small">${esc(e.sourceNotes)}</p>`);
  root.insertAdjacentHTML('beforeend','<div class="detail-actions"><button id="copyProfile" class="subtle">Copier la fiche</button></div>');
  if(e.original&&e.source==='wild'){
   root.insertAdjacentHTML('beforeend',`<details><summary>Vérifier les valeurs anglais / français</summary><div class="table-wrap"><table><thead><tr><th>Anglais</th><th>Français</th><th>Valeur source</th><th>Valeur affichée</th></tr></thead><tbody>${(e.comparison||[]).map(c=>`<tr><td>${esc(c.en)}</td><td>${esc(c.fr)}</td><td>${esc(c.source)}</td><td>${esc(c.value)}</td></tr>`).join('')}</tbody></table></div></details>`);
  }
 }
 if(e.summary&&e.kind!=='page')root.insertAdjacentHTML('beforeend',`<div class="summary-body"><p>${esc(e.summary)}</p>${e.steps?.length?`<ol>${e.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}${e.warning?`<p class="warn">${esc(e.warning)}</p>`:''}</div>`);
 if(e.fields?.length)root.insertAdjacentHTML('beforeend',tableRows(e.fields));
 if(e.kind==='equipment')root.insertAdjacentHTML('beforeend','<div class="detail-actions"><button id="addCart" class="primary">Ajouter au panier</button></div>');
 root.insertAdjacentHTML('beforeend',relationHtml({...e,related:[...new Set([...(e.related||[]),...(e.linkedProfiles||[]),...suggestedRules(e,state.rules)])]}));
 if(e.kit?.length)root.insertAdjacentHTML('beforeend',`<h3>Matériel utile</h3><div class="kit-links">${e.kit.map(q=>`<button class="relation" data-gear="${esc(q)}">${esc(q)}</button>`).join('')}</div>`);
 root.insertAdjacentHTML('beforeend',`<div class="source-line">${esc(sourceLabel(e))} · PDF ${e.page}</div>`);
 renderSource(e,root);
 root.insertAdjacentHTML('beforeend',`<details class="my-notes"><summary>Mes notes de partie</summary>${noteHtml(e)}</details>`);bindDetail(e);
 root.scrollTop=0;$('#results').querySelectorAll('.result').forEach(b=>b.classList.toggle('active',b.dataset.id===e.id));
 if(mobile){$('.workspace').classList.add('show-detail');root.focus({preventScroll:true});}
}
function getPrivateBook(id){return state.library?.books.find(b=>b.id===id);}
function renderSource(e,root){
 const book=getPrivateBook(e.source);
 if(!book){
  if(e.summary||e.attributes||e.fields?.length)root.insertAdjacentHTML('beforeend','<button id="openBooks" class="subtle source-access">Ouvrir la section complète dans mes livres</button>');
  else root.insertAdjacentHTML('beforeend','<div class="source-empty"><h3>Texte de cette section</h3><p>Ajoute le PDF de cet ouvrage dans Mes livres pour afficher ici son contenu détaillé.</p><button id="openBooks" class="primary">Ajouter mon PDF ou mon fichier personnel</button></div>');
  return;
 }
 const details=document.createElement('details');details.className='source-reader';details.open=(!e.summary&&!e.attributes&&!e.fields?.length)||e.kind==='page';
 const sum=document.createElement('summary');sum.textContent=book.language==='en'?'Section détaillée · original anglais':'Section détaillée du livre';details.append(sum);
 const reader=document.createElement('div');details.append(reader);root.append(details);let rendered=false;
 const populate=()=>{
  if(rendered||!details.open)return;rendered=true;
  const excerpt=sectionExcerpt(e,book,state.index),text=excerpt?.text||book.pages[e.page-1]?.text||'';
  if(!e.summary&&!e.attributes){const points=localKeyPoints(text,book.language);if(points.length){const section=document.createElement('section');section.className='local-points';section.innerHTML=`<h3>Points clés de la section</h3><ul>${points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`;root.insertBefore(section,details);}}
  if(text){const body=document.createElement('div');body.className='booktext';highlightText(body,text,state.query);reader.append(body);const full=document.createElement('button');full.className='subtle';full.textContent='Consulter le contexte et les pages suivantes';full.onclick=()=>renderPage(reader,e.source,e.page);reader.append(full);}else renderPage(reader,e.source,e.page);
 };
 details.addEventListener('toggle',populate);if(details.open)populate();
}

function renderPage(root,source,pno){
 const book=getPrivateBook(source);if(!book)return;const p=book.pages[pno-1];if(!p)return;
 root.innerHTML=`<div class="page-nav"><button data-prev class="subtle" ${pno<=1?'disabled':''}>Précédente</button><label class="small">Page PDF <input type="number" aria-label="Page PDF" min="1" max="${book.pageCount}" value="${pno}"></label><span class="small">${p.printed>0?'p. '+p.printed:''} / ${book.pageCount} pages</span><button data-next class="subtle" ${pno>=book.pageCount?'disabled':''}>Suivante</button></div><div class="booktext"></div>`;
 highlightText(root.querySelector('.booktext'),p.text,state.query);
 root.querySelector('[data-prev]').onclick=()=>renderPage(root,source,pno-1);root.querySelector('[data-next]').onclick=()=>renderPage(root,source,pno+1);
 root.querySelector('input').onchange=event=>{const n=Number(event.target.value);if(Number.isInteger(n)&&n>=1&&n<=book.pageCount)renderPage(root,source,n);else event.target.value=pno;};
}
function highlightText(root,text,query){
 const words=query.split(/\s+/).filter(w=>w.length>2);if(!words.length){root.textContent=text;return;}
 const re=new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
 const parts=text.split(re);for(let i=0;i<parts.length;i++){if(i%2){const mark=document.createElement('mark');mark.textContent=parts[i];root.append(mark);}else root.append(document.createTextNode(parts[i]));}
}
function bindDetail(e){
 $('#entryPrev').onclick=()=>{state.trailAt--;selectEntry(resolveEntry(state.trail[state.trailAt]),{remember:false});};
 $('#entryNext').onclick=()=>{state.trailAt++;selectEntry(resolveEntry(state.trail[state.trailAt]),{remember:false});};
 $('#copyEntry').onclick=()=>copy(profileText(e));
 $('#detail').querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>{state.kind='equipment';$('#source').value='';$('#topic').value='';$('#search').value=b.dataset.gear;setKind('equipment');});
 $('#favorite').onclick=async()=>{state.favorites.has(e.id)?state.favorites.delete(e.id):state.favorites.add(e.id);await savePreferences();counts();runSearch();selectEntry(e,{mobile:false});};
 $('#backResults')?.addEventListener('click',()=>$('.workspace').classList.remove('show-detail'));
 $('#openBooks')?.addEventListener('click',showBooks);
 $('#copyProfile')?.addEventListener('click',()=>copy(profileText(e)));
 $('#addCart')?.addEventListener('click',()=>addToCart(e.id));
 $('#entryNote').addEventListener('input',async ev=>{state.notes[e.id]=ev.target.value;$('#noteStatus').textContent='Enregistrement…';await savePreferences();if(state.selected?.id===e.id)$('#noteStatus').textContent='Enregistré';});
 $('#detail').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>selectEntry(state.byId.get(b.dataset.entry)));
}
function counts(){
 const c={};state.entries.forEach(e=>c[e.kind]=(c[e.kind]||0)+1);
 $('#tabs').querySelectorAll('[data-kind]').forEach(b=>{const span=b.querySelector('span');if(span)span.textContent=fmt(b.dataset.kind==='favorites'?state.favorites.size:b.dataset.kind?c[b.dataset.kind]||0:state.entries.length);});
}
function welcome(){
 delete $('#detail').dataset.inventory;
 const groups=[...new Set(SITUATIONS.map(x=>x.group))];
 $('#detail').innerHTML=`<div class="welcome"><span class="eyebrow">AIDE DE JEU IMMÉDIATE</span><h2>Que veux-tu faire ?</h2><p class="small">Choisis une situation ou saisis ta question. Le jet, l’opposition et les effets sont réunis sur la fiche.</p>${groups.map(g=>`<h3>${esc(g)}</h3><div class="situation-buttons">${SITUATIONS.filter(x=>x.group===g).map(x=>{const e=state.rules.find(r=>r.title===x.title);return e?`<button class="situation" data-entry="${esc(e.id)}">${esc(x.label)}</button>`:'';}).join('')}</div>`).join('')}<div class="catalog-access"><button data-home="equipment">Équipements</button><button data-home="npc">PNJ</button><button data-home="creature">Bestiaire</button><button data-home="rule">Toutes les règles</button></div></div>`;
 $('#detail').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>selectEntry(resolveEntry(b.dataset.entry)));
 $('#detail').querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>setKind(b.dataset.home));
}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copié.');}catch{const d=$('#infoDialog');$('#infoTitle').textContent='Texte à copier';$('#infoBody').replaceChildren();const t=document.createElement('textarea');t.className='note';t.value=text;$('#infoBody').append(t);d.showModal();t.select();}}
function showBooks(){
 const readyIds=new Set(state.library?.books.map(b=>b.id)||[]);
 $('#libraryStatus').textContent=state.library?`${readyIds.size} ouvrages consultables sur cet appareil.`:'Les index et les fiches sont disponibles. Importe le fichier de bibliothèque pour lire et rechercher dans les ouvrages.';
 $('#bookList').innerHTML=state.books.map(b=>`<div class="book-row"><div><strong>${esc(b.displayTitle||b.title)}</strong><p class="small">${b.pageCount} pages · ${b.language==='en'?'Source anglaise · fiches françaises':'Français'}</p></div><div class="book-actions"><button class="subtle" data-book="${esc(b.id)}">${readyIds.has(b.id)?'Ouvrir':'Voir les fiches'}</button><label class="subtle import-button">Ajouter son PDF<input type="file" data-pdfbook="${esc(b.id)}" accept=".pdf,application/pdf" hidden></label></div></div>`).join('');
 $('#removeLibrary').hidden=!state.library;
 $('#bookList').querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>{if(!getPrivateBook(b.dataset.book)){state.kind='';$('#source').value=b.dataset.book;setKind('');$('#booksDialog').close();return;}$('#booksDialog').close();const book=sourceBook(b.dataset.book);selectEntry({id:`page:${book.id}:1`,title:book.displayTitle||book.title,kind:'page',source:book.id,page:1});});
 $('#bookList').querySelectorAll('[data-pdfbook]').forEach(input=>input.onchange=()=>importPdf(input.files[0],input.dataset.pdfbook));
 if(!$('#booksDialog').open)$('#booksDialog').showModal();
}
async function importLibrary(file){
 if(!file)return;const p=$('#importProgress');p.hidden=false;$('#importLibrary').disabled=true;$('#importStatus').textContent='Lecture et vérification…';
 try{
  if(file.size>60*1024*1024)throw Error('Le fichier dépasse 60 Mo.');
  const library=await parseLibraryFileText(await file.text());
  const saved=await putStored('library',library);state.library=library;state.worker?.postMessage({type:'library',library});$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';
  $('#importStatus').textContent=saved.persistent?`${library.books.length} ouvrages importés.`:'Ouvrages ouverts pour cette session. Le navigateur n’a pas pu les conserver : '+saved.message;
  showBooks();
  runSearch();if(state.selected)selectEntry(state.selected,{mobile:false});
 }catch(e){$('#importStatus').textContent=e.message;}finally{p.hidden=true;$('#importLibrary').disabled=false;$('#importLibrary').value='';}
}
async function importPdf(file,id){
 if(!file)return;
 const meta=sourceBook(id),status=$('#importStatus'),progress=$('#importProgress');
 $('#bookList').querySelectorAll('input,button').forEach(x=>x.disabled=true);progress.hidden=false;
 try{
  status.textContent='Lecture de '+(meta.displayTitle||meta.title)+'…';
  const book=await readBookPdf(file,meta,(n,total)=>{progress.max=total;progress.value=n;status.textContent=`Lecture du PDF : ${n} / ${total}`;});
  const library=validateLibrary({schema:'fr.archives-imaginaire.sr6.library',version:2,partial:true,books:[...(state.library?.books||[]).filter(b=>b.id!==id),book]});
  const saved=await putStored('library',library);state.library=library;state.worker?.postMessage({type:'library',library});$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';
  status.textContent=saved.persistent?'PDF ajouté. Le texte s’affiche directement dans les fiches.':'PDF ouvert pour cette session : '+saved.message;
  showBooks();runSearch();if(state.selected)selectEntry(state.selected,{mobile:false});
 }catch(error){status.textContent=error.name==='PasswordException'?'Ce PDF est protégé par mot de passe. Utilise sa copie déverrouillée.':error.message;}
 finally{progress.hidden=true;$('#bookList').querySelectorAll('input,button').forEach(x=>x.disabled=false);}
}
function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function glossary(){
 $('#infoTitle').textContent='Anglais / français';$('#infoBody').innerHTML=`<p class="small">Les attributs et valeurs dérivées restent ceux du profil source. « S » désigne la Force dans les attributs et les dommages étourdissants dans une VD anglaise ; ces derniers deviennent « E » en français.</p><div class="table-wrap"><table><thead><tr><th>Anglais</th><th>Français</th><th>Caractéristique</th></tr></thead><tbody>${state.terms.attributes.map(x=>`<tr><td>${esc(x.en)}</td><td>${esc(x.fr)}</td><td>${esc(x.english)} / ${esc(x.french)}</td></tr>`).join('')}</tbody></table></div><h3>Termes de jeu</h3><div class="table-wrap"><table><tbody>${Object.entries(state.terms.terms).sort(([a],[b])=>a.localeCompare(b)).map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;$('#infoDialog').showModal();
}
function showCoverage(){
 const c=state.coverage;
 $('#infoTitle').textContent='Contenu intégré';$('#infoBody').innerHTML=`<p>Index de ${fmt(c.pages)} pages dans ${state.books.length} ouvrages. Les textes des livres importés se consultent page par page et peuvent être recherchés intégralement.</p><div class="table-wrap"><table><thead><tr><th>Ouvrage</th><th>Pages</th><th>Entrées d’index</th><th>Profils</th><th>Rappels français</th></tr></thead><tbody>${state.books.map(b=>`<tr><td>${esc(b.displayTitle||b.title)}</td><td>${b.pageCount}</td><td>${c.bySource?.[b.id]?.sections||0}</td><td>${c.bySource?.[b.id]?.profiles||0}</td><td>${c.bySource?.[b.id]?.reminders||0}</td></tr>`).join('')}</tbody></table></div><p class="small">Les entrées d’index donnent accès à la source ; elles ne sont pas toutes des rappels rédigés. Les valeurs des profils sont extraites des tableaux, avec comparaison anglais / français. Les règles optionnelles sont signalées. Les passages anglais non encore synthétisés restent proposés dans leur langue originale.</p><p class="small">Version ${VERSION}</p>`;$('#infoDialog').showModal();
}
async function addToCart(id){try{const line=state.cart.find(x=>x.id===id);if(line)line.quantity=quantity(line.quantity+1);else state.cart.push({id,quantity:1});safeCart(state.cart,state.equipment);await putStored('cart',state.cart);renderCart();toast('Équipement ajouté.');}catch(e){fail(e);}}
function renderCart(){
 $('#cartCount').textContent=state.cart.reduce((n,x)=>n+x.quantity,0);
 $('#cartLines').innerHTML=state.cart.length?state.cart.map(line=>{const e=state.byId.get(line.id);return `<div class="cart-line"><strong>${esc(title(e))}</strong><div class="line-controls"><label>Qté <input type="number" min="1" max="999" value="${line.quantity}" data-quantity="${esc(line.id)}"></label><button data-remove="${esc(line.id)}" class="subtle">Retirer</button></div></div>`;}).join(''):'<p class="small">Le panier est vide.</p>';
 let total=0,unknown=0;for(const l of state.cart){const p=literalPrice(state.byId.get(l.id));if(p===null)unknown++;else total+=p*l.quantity;}
 $('#cartTotal').textContent=`Total chiffré : ${fmt(total)} ¥${unknown?' · '+unknown+' prix variable'+(unknown>1?'s':''):''}`;
 $('#transfer').disabled=!state.isGm||!state.cart.length;$('#targetNpc').disabled=!state.isGm;$('#refreshNpc').disabled=!state.isGm;
 $('#cartLines').querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{state.cart=state.cart.filter(l=>l.id!==b.dataset.remove);await putStored('cart',state.cart);renderCart();});
 $('#cartLines').querySelectorAll('[data-quantity]').forEach(input=>input.onchange=async()=>{try{const v=quantity(input.value);state.cart.find(l=>l.id===input.dataset.quantity).quantity=v;await putStored('cart',state.cart);renderCart();}catch(e){fail(e);renderCart();}});
}
async function refreshNpcs(){
 if(!state.isGm)return;try{const tokens=await state.bridge.tokens();const selected=$('#targetNpc').value;$('#targetNpc').innerHTML='<option value="">Choisir un PNJ…</option>'+tokens.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}${t.hidden?' · masqué':''}</option>`).join('');if(tokens.some(t=>t.id===selected))$('#targetNpc').value=selected;return tokens;}catch(e){$('#transferStatus').textContent=e.message;}
}
async function setupBridge(){
 if(!await ready())return;state.bridge=bridge(state.equipment);state.isGm=await state.bridge.role()==='GM';$('#npcTab').hidden=!state.isGm;renderCart();
 if(state.isGm)await refreshNpcs();
 OBR.player.onChange(async()=>{state.isGm=await state.bridge.role()==='GM';$('#npcTab').hidden=!state.isGm;renderCart();if(!state.isGm){$('#targetNpc').replaceChildren();if($('#detail').dataset.inventory)welcome();}});
 OBR.scene.onReadyChange(()=>void refreshNpcs());
 const params=new URLSearchParams(location.search);if(params.get('tab')==='mj'&&state.isGm){$('#targetNpc').value=params.get('token')||'';await showNpcInventory();}
}
async function showNpcInventory(){
 if(!state.isGm)return;await refreshNpcs();$('#cart').hidden=false;const id=$('#targetNpc').value;
 if(!id){toast('Choisis un PNJ dans le panier.');return;}
 try{
  const record=await state.bridge.read(id);const selected=$('#targetNpc').selectedOptions[0]?.textContent||'PNJ';
  $('#detail').innerHTML=`<div class="panel-title"><h2>${esc(selected)}</h2><span class="badge">Inventaire MJ</span></div><div id="npcInventory"></div>`;$('#detail').dataset.inventory=id;$('#npcInventory').textContent=inventoryText(record.lines,state.equipment)||'Aucun équipement attribué.';$('#npcInventory').className='booktext';$('.workspace').classList.add('show-detail');
 }catch(e){fail(e);}
}
async function restoreLibrary(){
 try{const library=await getStored('library');if(!library)return;state.library=validateLibrary(library);$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';state.worker?.postMessage({type:'library',library:state.library});if($('#booksDialog').open)showBooks();if(state.selected)selectEntry(state.selected,{mobile:false,remember:false});}catch{}
}
async function init(){
 try{
  const files=['sources','index','equipment','profiles','rules','coverage','terminology'];
  const values=await Promise.all(files.map(async name=>{const r=await fetch(`data/${name}.json?v=${VERSION}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Impossible de charger '+name);return r.json();}));
  const [books,index,equipment,profiles,rules,coverage,terms]=values;Object.assign(state,{books,index,equipment,profiles,rules,coverage,terms});
  const catalog=assembleEntries({rules,profiles,equipment,index});state.entries=catalog.entries;
  state.byId=new Map(state.entries.map(e=>[e.id,e]));for(const [id,target] of catalog.replacements)state.byId.set(id,state.byId.get(target));state.prepared=prepareEntries(state.entries);state.aliases=makeAliases(terms.terms);
  const [prefs,cart]=await Promise.all([getStored('preferences',{}),getStored('cart',[])]);
  state.favorites=new Set((prefs.favorites||[]).filter(id=>resolveEntry(id)));state.notes=prefs.notes&&typeof prefs.notes==='object'?prefs.notes:{};
  try{state.cart=cart.length?safeCart(cart,equipment):[];}catch{state.cart=[];}
  for(const b of books){const option=document.createElement('option');option.value=b.id;option.textContent=b.displayTitle||b.title;$('#source').append(option);}
  counts();renderCart();welcome();if($('#booksDialog').open)showBooks();$('#coverage').textContent=`${books.length} ouvrages · ${fmt(coverage.pages)} pages indexées · v${VERSION}`;
  try{
   const w=new Worker(new URL('./search-worker.mjs',import.meta.url),{type:'module'});state.worker=w;
   w.onmessage=({data})=>{if(data.type==='results')renderResults(data);if(data.type==='ready'){state.workerReady=true;runSearch();}if(data.type==='library-ready')runSearch();if(data.type==='error')fail(Error(data.message));};
   w.onerror=()=>{w.terminate();state.worker=null;state.workerReady=false;runSearch();};w.postMessage({type:'init',entries:state.entries,terms:terms.terms});
  }catch{state.worker=null;}
  runSearch();
  const params=new URLSearchParams(location.search);const e=resolveEntry(params.get('entry'));if(e)selectEntry(e);
  void restoreLibrary();
  void setupBridge().catch(fail);
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }catch(e){$('#resultCount').textContent='Chargement interrompu';$('#detail').innerHTML='<h2>Le compendium ne s’est pas chargé.</h2><p>Le chargement a été interrompu.</p><button id="retryLoad">Réessayer</button>';$('#retryLoad').onclick=()=>location.reload();fail(e);}
}
$('#search').addEventListener('input',()=>{state.seq++;state.pendingAction=null;clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(),100);});
$('#search').addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'||ev.key==='Enter'){ev.preventDefault();clearTimeout(searchTimer);state.pendingAction=ev.key==='Enter'?'open':'focus';runSearch();}});
$('#results').addEventListener('keydown',ev=>{if(!['ArrowDown','ArrowUp'].includes(ev.key))return;const buttons=[...$('#results').querySelectorAll('.result')],at=buttons.indexOf(document.activeElement);if(at<0)return;ev.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,at+(ev.key==='ArrowDown'?1:-1)))].focus();});
$('#category').onchange=()=>runSearch();
$('#practicalOnly').onchange=()=>runSearch();
$('#source').onchange=()=>runSearch();$('#topic').onchange=()=>runSearch();$('#fulltext').onchange=()=>runSearch();
$('#tabs').querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>setKind(b.dataset.kind));
$('#quick').querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{$('#search').value=b.dataset.query;runSearch();});
$('#reset').onclick=()=>{$('#category').value='';$('#search').value='';$('#source').value='';$('#topic').value='';$('#fulltext').checked=false;$('#practicalOnly').checked=false;setKind('');welcome();};
$('#more').onclick=()=>{state.offset+=75;runSearch(true);};
$('#situationsButton').onclick=()=>{welcome();$('.workspace').classList.add('show-detail');};
$('#booksButton').onclick=showBooks;$('#importLibrary').onchange=e=>importLibrary(e.target.files[0]);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#glossaryButton').onclick=glossary;$('#coverageButton').onclick=showCoverage;
$('#cartButton').onclick=()=>{$('#cart').hidden=!$('#cart').hidden;if(!$('#cart').hidden)void refreshNpcs();};$('#closeCart').onclick=()=>$('#cart').hidden=true;
$('#refreshNpc').onclick=()=>refreshNpcs();$('#targetNpc').onchange=()=>void showNpcInventory();
$('#copyCart').onclick=()=>copy(inventoryText(state.cart,state.equipment));
$('#transfer').onclick=async()=>{const id=$('#targetNpc').value;const b=$('#transfer');b.disabled=true;try{const result=await state.bridge.transfer(id,state.cart);$('#transferStatus').textContent=`Équipement attribué${result.archives?' dans la fiche des Archives':''}.`;await showNpcInventory();}catch(e){$('#transferStatus').textContent=e.message;}finally{renderCart();}};
$('#removeLibrary').onclick=async()=>{await deleteStored('library');state.library=null;state.worker?.postMessage({type:'library',library:null});$('#fulltext').disabled=true;$('#fulltext').checked=false;$('#libraryDot').textContent='';$('#booksDialog').close();runSearch();if(state.selected)selectEntry(state.selected,{mobile:false});toast('Textes retirés de cet appareil.');};
$('#exportPreferences').onclick=()=>downloadJson({schema:'sr6.preferences',version:1,favorites:[...state.favorites],notes:state.notes},'SR6_Mes_favoris_et_notes.json');
$('#importPreferences').onchange=async ev=>{try{const f=ev.target.files[0];if(!f)return;if(f.size>5*1024*1024)throw Error('Fichier trop volumineux.');const d=JSON.parse(await f.text());if(d.schema!=='sr6.preferences'||!Array.isArray(d.favorites)||!d.notes||typeof d.notes!=='object')throw Error('Fichier de préférences invalide.');state.favorites=new Set(d.favorites.filter(id=>resolveEntry(id)));state.notes=Object.fromEntries(Object.entries(d.notes).filter(([id,v])=>resolveEntry(id)&&typeof v==='string'&&v.length<=12000));await savePreferences();counts();runSearch();toast('Favoris et notes restaurés.');}catch(e){fail(e);}finally{ev.target.value='';}};
document.addEventListener('keydown',ev=>{if(ev.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){ev.preventDefault();$('#search').focus();}if(ev.key==='Escape'&&!document.querySelector('dialog[open]'))$('.workspace').classList.remove('show-detail');});
void init();
