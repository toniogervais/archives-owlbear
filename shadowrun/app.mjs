import {VERSION,validateLibrary,parseLibraryText,parseLibraryFileText,normalize,literalPrice,quantity,safeCart,inventoryText} from './model.mjs?v=144';
import {prepareEntries,searchEntries,makeAliases,libraryPages,profileText,profileRolls} from './search.mjs?v=144';
import {getStored,putStored,deleteStored} from './storage.mjs?v=144';
import {bridge,ready,OBR} from './bridge.mjs?v=144';
import {sectionExcerpt} from './reader.mjs?v=144';
import {conciseSourceDescription,sourceContext} from './source-descriptions.mjs?v=144';
import {assembleEntries,localKeyPoints,suggestedRules,SITUATIONS} from './content.mjs?v=144';
import {readBookPdf} from './pdf-import.mjs?v=144';

import {THEMES, topicOf, topicsOf, hasRoll, mergeTableRules} from './themes.mjs?v=144';
import {hasTable, tableShelf, startTable, fetchBook, selectPlates, fetchPlate} from './table-books.mjs?v=144';
import {observePanel} from './panel-size.mjs?v=144';
import {quickCatalogHierarchy,classifyEntry,KIND_NAMES} from './catalog.mjs?v=144';
import {profileSkillPools,profileChoicePools,skillGuideEntries} from './profile-pools.mjs?v=144';
import {actionType} from './action-types.mjs?v=144';
import {canTranslateLocally,translatePassage} from './translation.mjs?v=144';
import {profileSectionRows} from './profile-sections.mjs?v=144';
import {EDGE_ENTRIES,EDGE_CATEGORIES,EDGE_COUNTS} from './edge-catalog.mjs?v=144';
import {installWindowControls} from './window-controls.mjs?v=144';
import {sendToArchives} from './archive-transfer.mjs?v=144';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={rule:'Règle',action:'Action',edgeaction:'Action d’Atout',edgeboost:'Bonus d’Atout',equipment:'Équipement',npc:'PNJ',creature:'Bestiaire',page:'Texte du livre',reference:'Référence',roll:'Passage sur un jet',skillguide:'Compétence'};
const topics=Object.fromEntries(Object.entries(THEMES).map(([k,v])=>[k,v[0]]));
const state={entries:[],books:[],equipment:[],profiles:[],rules:[],coverage:{},terms:{},favorites:new Set(),notes:{},library:null,kind:'',selected:null,query:'',topic:'',source:'',offset:0,cart:[],seq:0,worker:null,bridge:null,isGm:false,trail:[],trailAt:-1,browse:{family:'',sub:''},workerReady:false};
let toastTimer,searchTimer;
const onlineBooks=new Map(), pendingBooks=new Map();
let selectedArtUrls=[];
let allBooksRequest;
const sourceSummaryJobs=new Map();
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function fail(e){toast(e.message||String(e));}
function sourceBook(id){return state.books.find(b=>b.id===id);}
function sourceName(id){const b=sourceBook(id);return b?.displayTitle||b?.title||id;}
function resolveEntry(id){const known=state.byId?.get(id);if(known)return known;const m=/^page:([a-z]+):(\d+)$/.exec(String(id));if(!m)return null;const b=sourceBook(m[1]),page=Number(m[2]);if(!b||page<1||page>b.pageCount)return null;const printed=page-b.printedOffset;return {id,title:`${sourceName(b.id)} · ${printed>0?'p. '+printed:'PDF '+page}`,source:b.id,page,printedPage:printed,kind:'page'};}
function sourceLabel(e){return `${sourceName(e.source)} · ${e.printedPage>0?'p. '+e.printedPage:'PDF '+e.page}`;}
function fmt(n){return n.toLocaleString('fr-FR');}
function title(e){return e.title||e.name;}
async function savePreferences(){const r=await putStored('preferences',{favorites:[...state.favorites],notes:state.notes});if(!r.persistent)toast('Les préférences ne sont pas conservées : '+r.message);}
function setKind(kind,{keepQuery=false}={}){
 if(kind==='mj'){void showNpcInventory();return;}
 state.kind=kind;state.browse={family:'',sub:''};state.selected=null;
 if(!keepQuery)$('#search').value='';
 $('#topic').value='';$('#category').value='';$('#edgeCost').value='';
 $('#tabs').querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});
 updateCategoryFilter();
 $('#quick').hidden=Boolean(kind);$('#homeButton').setAttribute('aria-pressed','false');
 $('.workspace').classList.remove('show-detail','browse-catalog');runSearch();
 if(keepQuery&&$('#search').value.trim())showBrowseHint('Résultats de recherche');
 else if(kind&&kind!=='favorites')renderCategoryLanding();
 else if(kind==='favorites')showBrowseHint('Mes favoris');
 else welcome();
}
function updateCategoryFilter(){
 const select=$('#category');select.replaceChildren();select.append(new Option('Toutes les catégories',''));
 for(const g of currentHierarchy())select.append(new Option(g.name,g.name));
 select.value=state.browse.family;
 // Compact chips replace the duplicated category dropdown.
 select.hidden=true;
 $('#edgeCost').hidden=!['edgeaction','edgeboost'].includes(state.kind);
}
function searchOptions(){return {query:$('#search').value,kind:state.kind==='favorites'?'':state.kind,topic:$('#topic').value,source:$('#source').value,edgeCost:$('#edgeCost').value,favorites:state.kind==='favorites'?[...state.favorites]:null,family:state.browse.family,subcategory:state.browse.sub,offset:0,limit:state.offset+75,practicalOnly:$('#practicalOnly').checked,category:''};}
function runSearch(append=false){
 if(!state.prepared)return;
 if(!append)state.offset=0;const seq=++state.seq;const options=searchOptions();state.query=options.query;
 const fulltext=(Boolean(options.query.trim())&&$('#fulltext').checked)||Boolean((state.library||hasTable())&&state.kind==='favorites');
 if(fulltext&&hasTable())void prepareAllBooks();
 const references=state.kind==='favorites'?[...state.favorites].map(resolveEntry).filter(e=>e?.kind==='page'):[];
 // The catalog answers immediately; full-book results enrich it in the worker.
 const local=searchEntries([...state.prepared,...prepareEntries(references),...(!state.worker&&fulltext?state.fullPages||[]:[])],{...options,favorites:options.favorites?new Set(options.favorites):null},state.aliases);
 renderResults({...local,seq});
 if(state.worker&&state.workerReady&&fulltext)state.worker.postMessage({type:'search',seq,options,fulltext,references});
}
function renderResults(r){
 if(r.seq!==state.seq)return;
 const root=$('#results');root.replaceChildren();
 $('#resultCount').textContent=`${fmt(r.total)} ${r.total===1?'résultat':'résultats'}${r.corrected?' · orthographe approchée':''}${r.items.length<r.total?' · '+fmt(r.items.length)+' affichés':''}`;
 $('#more').hidden=r.items.length>=r.total;
 if(!r.total){state.pendingAction=null;root.innerHTML='<div class="empty">Aucun résultat. Essaie un terme plus court ou un autre ouvrage.</div>';return;}
 const frag=document.createDocumentFragment(),shown=new Set();
 for(const e of r.items){
  const groupKey=e.kind==='equipment'?normalize(title(e))+'|'+normalize(e.category||''):e.id;
  if(shown.has(groupKey))continue;
  shown.add(groupKey);
  const button=document.createElement('button');button.className='result'+(state.selected?.id===e.id?' active':'');button.dataset.id=e.id;
  const folder=classifyEntry(e);
   const timing=actionType(e);
  const folderText=e.kind==='equipment'?folder.family+' › '+folder.subcategory:e.kind==='creature'?folder.family:folder.subcategory;
   const editions=e.kind==='equipment'?(state.equipmentGroups?.get(groupKey)?.length||1):1;
  button.innerHTML=`<span class="name">${state.favorites.has(e.id)?'★ ':''}${esc(title(e))}</span><span class="meta"><span class="type">${esc(labels[e.kind]||'Référence')}</span><span class="result-folder">${esc(folderText)}</span><span>${esc(sourceLabel(e))}</span>${editions>1?'<span class="editions">'+editions+' ouvrages / variantes</span>':''}${e.optional?'<span>Optionnelle</span>':''}</span>${e.procedure?.test||e.pools?.length?`<span class="result-roll">${esc(e.procedure?.test||e.pools.join(' · '))}</span>`:''}${e.edgeCost?`<span class="result-action">⚡ ${esc(e.edgeCost)} Atout · ${esc(e.edgeTiming)} · ${esc(e.edgeAction)}</span>`:''}${timing?`<span class="result-action">Type d’action : ${esc(timing.label)}</span>`:''}${e.summary?`<span class="excerpt">${esc(e.summary)}</span>`:''}`;
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
function headerHtml(e){return `<div class="topline"><button class="subtle back-mobile" id="backResults">Résultats</button><span class="breadcrumb">${esc(topics[topicOf(e)]||e.habitat||e.category||'Compendium')}</span><button id="favorite" class="iconbutton" aria-label="${state.favorites.has(e.id)?'Retirer des favoris':'Ajouter aux favoris'}" aria-pressed="${state.favorites.has(e.id)}">${state.favorites.has(e.id)?'★':'☆'}</button></div><div class="badges"><span class="badge">${esc(labels[e.kind]||'Référence')}</span>${e.summary&&e.kind!=='page'?'<span class="badge summary">'+(e.sourceSummary?'Description issue de la source':'Rappel en français')+'</span>':''}${e.optional?'<span class="badge optional">Règle optionnelle</span>':''}${e.verification==='a-verifier'?'<span class="badge optional">Extraction à vérifier dans la source</span>':''}</div><h2>${esc(title(e))}</h2>${e.originalTitle&&e.originalTitle!==title(e)&&!['wild','companion'].includes(e.source)?`<p class="original-title">${esc(e.originalTitle)}</p>`:''}`;}
function renderEquipmentAlternatives(entry,root){
 const key=normalize(title(entry))+'|'+normalize(entry.category||'');
 const options=state.equipmentGroups?.get(key)||[];
 if(options.length<=1)return;
 const section=document.createElement('section');section.className='source-alternatives';
 section.innerHTML='<h3>Autres ouvrages / variantes</h3><p class="small">Même désignation dans plusieurs livres : caractéristiques conservées séparément pour éviter de confondre les éditions.</p>';
 for(const variant of options.filter(x=>x.id!==entry.id)){
  const button=document.createElement('button');button.className='relation';
  button.textContent=sourceLabel(variant)+(variant.fields?.length?' · '+variant.fields.length+' caractéristiques':'');
  button.onclick=()=>selectEntry(variant);
  section.append(button);
 }
 root.append(section);
}
function skillRelatedRules(e,rules){
 if(e.kind!=='skillguide')return [];
 const needle=normalize(e.title);
 return rules.filter(r=>r.procedure?.test&&normalize(r.procedure.test).includes(needle))
  .slice(0,22).map(r=>r.id);
}
function skillPoolHtml(rows){
 const tr=rows.map(s=>{
  const value=s.total===null?'Non chiffré':s.total+' D6';
  const spec=(s.specializations||[]).map(x=>'<div class="pool-variant">Spécialisation '+esc(x.name)+' : <strong>'+(x.total===null?'Non chiffré':x.total+' D6')+'</strong> si applicable</div>').join('');
  const extras=s.contextual.map(c=>'<div class="pool-variant">Pour '+esc(c.when)+' : <strong>'+(c.total===null?'Non chiffré':c.total+' D6')+'</strong></div>').join('');
  const second=s.alternateRankTotal!==null?'<div class="pool-variant">Variante de compétence : <strong>'+s.alternateRankTotal+' D6</strong> selon la situation</div>':'';
  const augmented=s.alternateAttributeTotal!==null?'<div class="pool-variant">Variante d’attribut : <strong>'+s.alternateAttributeTotal+' D6</strong> si applicable</div>':'';
  return '<tr><th scope="row">'+esc(s.name)+'</th><td><strong class="pool-total">'+value+'</strong>'+spec+extras+second+augmented+'</td></tr>';
 }).join('');
 return '<section class="skill-pools"><h3>Compétences : D6 à lancer</h3><p class="small">Les pools sont déjà calculés. Une spécialisation ou une variante ne s’applique que dans la situation correspondante.</p><div class="table-wrap"><table><thead><tr><th>Compétence</th><th>Pool final</th></tr></thead><tbody>'+tr+'</tbody></table></div><p class="small">Une compétence sans valeur exploitable n’est pas chiffrée arbitrairement.</p></section>';
}
function profileChoicesHtml(groups){
 if(!groups.length)return '';
 return '<section class="choice-pools"><h3>Compétences au choix : ensembles exclusifs</h3><p class="small">Les variantes ci-dessous ne sont pas toutes acquises. Sélectionner une seule option, conformément à la fiche du livre.</p>'+
 groups.map(g=>'<section class="choice-group"><h4>'+esc(g.title)+'</h4>'+
 '<div class="table-wrap"><table><thead><tr><th>Compétence possible</th><th>D6 à lancer</th></tr></thead><tbody>'+
 g.rows.map(r=>'<tr><th>'+esc(r.name)+'</th><td><strong>'+(r.total===null?'Non chiffré':r.total+' D6')+'</strong>'+
 (r.choiceSpecialization===null||r.choiceSpecialization===undefined?'':'<small>Avec spécialisation choisie : '+r.choiceSpecialization+' D6</small>')+'</td></tr>').join('')+
 '</tbody></table></div>'+(g.disclaimer?'<p class="small">'+esc(g.disclaimer)+'</p>':'')+'</section>').join('')+'</section>';
}
function categoryHtml(e){
 const category=e.category||e.habitat||topics[topicOf(e)]||'Système de jeu';
 const path=(e.path||[]).filter(Boolean);
 const subcategory=path.length?path.slice(-2).join(' › '):'';
 return '<div class="entry-taxonomy"><div><span>Catégorie</span><strong>'+esc(category)+'</strong></div>'+(subcategory?'<div><span>Sous-catégorie</span><strong>'+esc(subcategory)+'</strong></div>':'')+'</div>';
}
function procedureHtml(p){
 const names={test:'Jet de dés',opposition:'Opposition',threshold:'Seuil',action:'Action et timing',access:'Accès nécessaire',effect:'Résultat',limits:'À ne pas oublier',cost:'Karma',example:'Exemple'};
 return `<section class="procedure" aria-label="Procédure de jeu">${Object.entries(names).filter(([k])=>p[k]).map(([k,n])=>`<div class="procedure-row ${k==='test'?'main-roll':''}"><span>${n}</span><p>${esc(p[k])}</p></div>`).join('')}</section>`;
}
async function selectEntry(e,{mobile=true,remember=true}={}){
 if(!e)return;
 if(remember&&state.trail[state.trailAt]!==e.id){state.trail.splice(state.trailAt+1);state.trail.push(e.id);state.trailAt=state.trail.length-1;}
 releaseArt();state.selected=e;const url=new URL(location.href);url.searchParams.set('entry',e.id);history.replaceState(null,'',url.href);const root=$('#detail');delete root.dataset.inventory;root.innerHTML=headerHtml(e)+categoryHtml(e);
 root.insertAdjacentHTML('afterbegin',`<div class="detail-nav"><button id="entryPrev" class="subtle" ${state.trailAt<=0?'disabled':''}>Retour</button><button id="entryNext" class="subtle" ${state.trailAt>=state.trail.length-1?'disabled':''}>Suivant</button><button id="copyEntry" class="subtle">Copier la fiche</button></div>`);
  if(['equipment','npc','creature'].includes(e.kind)){
   root.insertAdjacentHTML('beforeend','<section class="archives-export"><div class="archives-export-title">Exporter cette fiche dans Les Archives</div><div class="archives-export-actions"><button type="button" data-sr6-export="canvas" class="primary" title="Créer une cellule masquée sur le canevas de l’acte actif">→ Canevas</button><button type="button" data-sr6-export="library" class="subtle" title="Conserver cette fiche dans la bibliothèque privée, hors du canevas">→ Réserve de cellules</button></div><p class="small">Transfert MJ · description, caractéristiques et pools D6, si présents.</p></section>');
  }
 if(e.kind==='roll'&&e.pools?.length)root.insertAdjacentHTML('beforeend',`<section class="pool-list"><h3>Réserves citées dans le passage</h3>${e.pools.map(pool=>`<p>${esc(pool)}</p>`).join('')}</section>`);
 const actionInfo=actionType(e);
 if(e.edgeCost)root.insertAdjacentHTML('beforeend',`<section class="edge-cost-panel"><div><span>Coût en Atout</span><strong>${esc(e.edgeCost)} <small>points</small></strong></div><div><span>Moment</span><strong>${esc(e.edgeTiming)}</strong></div><div><span>Action majeure ou mineure</span><strong>${esc(e.edgeAction)}</strong></div></section>`);
 if(actionInfo)root.insertAdjacentHTML('beforeend',`<section class="action-identity" aria-label="Nature de l’action"><strong>Type d’action</strong><span>${esc(actionInfo.label)}</span></section>`);
 if(e.procedure)root.insertAdjacentHTML('beforeend',procedureHtml(e.procedure));
 if(e.attributes){
  root.insertAdjacentHTML('beforeend','<h3>Caractéristiques</h3>');
  root.insertAdjacentHTML('beforeend',`<dl class="stat-grid">${Object.entries(e.attributes).map(([k,v])=>`<div class="stat"><dt title="${esc(state.terms.attributes?.find(a=>a.fr===k)?.french||k)}">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`);
   const rows=profileSkillPools(e);
   if(rows.length)root.insertAdjacentHTML('beforeend',skillPoolHtml(rows));
   const choices=profileChoicePools(e);
   if(choices.length)root.insertAdjacentHTML('beforeend',profileChoicesHtml(choices));
   else if(e.sections?.Compétences)root.insertAdjacentHTML('beforeend','<p class="warn">Cette fiche énumère des compétences sans leur attribuer de rang chiffré. Aucun pool de D6 n’est déduit automatiquement : consulter la règle spécifique de la créature ou de l’esprit.</p>');
   const rolls=profileRolls(e).filter(r=>r.label==='Défense physique'||r.label==='Résister aux dommages');
   if(rolls.length)root.insertAdjacentHTML('beforeend',`<h3>Autres tests courants</h3><div class="profile-rolls">${rolls.map(r=>`<div><span>${esc(r.label)}</span><strong>${esc(r.value)}</strong><small>Test réactif ; les options Bloquer et Esquiver sont des actions mineures distinctes.</small></div>`).join('')}</div>`);
   const allDetails=[
     ...(e.description?[{label:'Description détaillée',value:e.description}]:[]),
     ...Object.entries(e.derived||{}).map(([label,value])=>({label,value})),
     ...profileSectionRows(e.sections||{},Boolean(rows.length)),
     ...(e.fields||[])
   ].filter(f=>f.value!==null&&f.value!==undefined&&String(f.value).trim());
   if(allDetails.length)root.insertAdjacentHTML('beforeend','<h3>Caractéristiques détaillées, capacités et matériel</h3>'+tableRows(allDetails));
  if(e.sourceNotes)root.insertAdjacentHTML('beforeend',`<p class="small">${esc(e.sourceNotes)}</p>`);
  root.insertAdjacentHTML('beforeend','<div class="detail-actions"><button id="copyProfile" class="subtle">Copier la fiche</button></div>');
  if(false&&e.original&&e.source==='wild'){
   root.insertAdjacentHTML('beforeend',`<details><summary>Vérifier les valeurs anglais / français</summary><div class="table-wrap"><table><thead><tr><th>Anglais</th><th>Français</th><th>Valeur source</th><th>Valeur affichée</th></tr></thead><tbody>${(e.comparison||[]).map(c=>`<tr><td>${esc(c.en)}</td><td>${esc(c.fr)}</td><td>${esc(c.source)}</td><td>${esc(c.value)}</td></tr>`).join('')}</tbody></table></div></details>`);
  }
 }
 if(e.summary&&e.kind!=='page')root.insertAdjacentHTML('beforeend',`<div class="summary-body"><h3>${e.sourceSummary?'Description de la rubrique, issue du livre':'Description / rappel'}</h3><p>${esc(e.summary)}</p>${e.steps?.length?`<ol>${e.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}${e.warning?`<p class="warn">${esc(e.warning)}</p>`:''}</div>`);
 if(e.fields?.length&&!e.attributes&&!e.edgeCost){root.insertAdjacentHTML('beforeend','<h3>Caractéristiques</h3>');root.insertAdjacentHTML('beforeend',tableRows(e.fields));}
 if(e.kind==='equipment')root.insertAdjacentHTML('beforeend','<div class="detail-actions"><button id="addCart" class="primary">Ajouter au panier</button></div>');
  if(e.kind==='equipment')renderEquipmentAlternatives(e,root);
 root.insertAdjacentHTML('beforeend',relationHtml({...e,related:[...new Set([...(e.related||[]),...(e.linkedProfiles||[]),...suggestedRules(e,state.rules),...skillRelatedRules(e,state.rules)])]}));
 if(e.kit?.length)root.insertAdjacentHTML('beforeend',`<h3>Matériel utile</h3><div class="kit-links">${e.kit.map(q=>`<button class="relation" data-gear="${esc(q)}">${esc(q)}</button>`).join('')}</div>`);
 root.insertAdjacentHTML('beforeend',`<div class="source-line">${esc(sourceLabel(e))} · PDF ${e.page}</div>`);
 const refs=[...(e.refs||[]),...(e.kind==='equipment'&&e.descriptionPage&&e.descriptionPage!==e.page?[{source:e.source,page:e.descriptionPage}]:[])].filter(r=>r.source!==e.source||r.page!==e.page);
 if(refs.length){
  const nav=document.createElement('div');nav.className='reference-buttons';
  const label=document.createElement('span');label.textContent='Autres pages citées';nav.append(label);
  for(const ref of refs){
   const page=resolveEntry('page:'+ref.source+':'+ref.page);if(!page)continue;
   const b=document.createElement('button');b.className='relation';b.textContent=sourceLabel(page);b.onclick=()=>selectEntry(page);nav.append(b);
  }
  root.append(nav);
 }
 if(e.kind==='roll'&&e.section){
  const section=resolveEntry(e.section);
  if(section){const b=document.createElement('button');b.className='relation';b.textContent='Rubrique · '+title(section);b.onclick=()=>selectEntry(section);root.append(b);}
 }
 renderArtwork(e,root);
 renderSource(e,root);
 root.insertAdjacentHTML('beforeend',`<details class="my-notes"><summary>Mes notes de partie</summary>${noteHtml(e)}</details>`);bindDetail(e);
 root.scrollTop=0;$('#results').querySelectorAll('.result').forEach(b=>b.classList.toggle('active',b.dataset.id===e.id));
 if(mobile){$('.workspace').classList.add('show-detail');root.focus({preventScroll:true});}
}
function getPrivateBook(id){return onlineBooks.get(id)||state.library?.books.find(b=>b.id===id);}
function renderSource(e,root){
 const book=getPrivateBook(e.source);
 if(!book&&hasTable()){
  const area=document.createElement('div');area.className='remote-source';root.append(area);
  const auto=e.kind==='roll'||e.kind==='page'||e.kind==='equipment'||!(e.summary||e.attributes||e.fields?.length);
  const open=document.createElement('button');open.className='subtle';open.textContent='Lire la section du livre';area.append(open);
  const load=async()=>{
   open.disabled=true;open.textContent='Ouverture de la section…';
   try{await ensureBook(e.source);if(state.selected?.id!==e.id||!area.isConnected)return;area.replaceChildren();renderSource(e,area);const details=area.querySelector('details');if(details)details.open=true;}
   catch{if(!area.isConnected)return;open.disabled=false;open.textContent='Réessayer d’ouvrir la section';}
  };
  open.onclick=load;if(auto)void load();return;
 }
 if(!book){
  // Source-only index titles must never receive a neighbouring rule's text.
  // The user can load this exact book to get a real description and excerpt.
  const area=document.createElement('section');area.className='source-empty';root.append(area);
  const heading=document.createElement('h3');heading.textContent='Source et extrait original';area.append(heading);
  const line=document.createElement('p');line.textContent=sourceLabel(e)+(e.endPage&&e.endPage>e.page?' · section jusqu’à PDF '+e.endPage:'');area.append(line);
  const path=(e.path||[]).filter(Boolean).join(' › ');
  if(path){const topic=document.createElement('p');topic.className='small';topic.textContent='Rubrique : '+path;area.append(topic);}
  const open=document.createElement('button');open.className='subtle';open.textContent='Importer ce livre pour afficher la description et lire le passage original';open.onclick=showBooks;area.append(open);
  return;
 }
 const details=document.createElement('details');details.className='source-reader';details.open=e.kind==='roll'||e.kind==='equipment'||(!e.summary&&!e.attributes&&!e.fields?.length)||e.kind==='page';
 const sum=document.createElement('summary');sum.textContent='Lire l’extrait original du livre · PDF p. '+(e.descriptionPage||e.page)+(book.language==='en'?' · source anglaise':'');details.append(sum);
 const reader=document.createElement('div');details.append(reader);root.append(details);let rendered=false;
 const populate=()=>{
  if(rendered||!details.open)return;rendered=true;
  const readingPage=e.kind==='equipment'?(e.descriptionPage||e.page):e.page;
  const pageText=book.pages[readingPage-1]?.text||'';
  const passage=e.kind==='roll'&&book.anchors?pageText.slice(e.start,e.end):'';
  const excerpt=(passage||e.kind==='page')?null:sectionExcerpt(e,book,state.index);
  const text=passage||(e.kind==='page'?pageText:excerpt?.text||'');
  const context=sourceContext(e,book,excerpt);
  const description=conciseSourceDescription(excerpt,book.language);
  if(description&&!e.summary){
   const overview=document.createElement('section');overview.className='source-overview';
   const heading=document.createElement('h3');heading.textContent='Description de la rubrique';
   const body=document.createElement('p');body.textContent=description.text;
   const origin=document.createElement('p');origin.className='small';origin.textContent=(excerpt?.matchedBy==='two-page-continuation'?'La suite sur la deuxième page est déduite d’une phrase interrompue : vérifier les deux pages originales. ':'Description extractive de la section, à vérifier avec le passage original. ')+sourceLabel({...e,page:context.firstPage,printedPage:context.firstPage-sourceBook(e.source).printedOffset});
   overview.append(heading,body,origin);root.insertBefore(overview,details);
  }
  if(book.language!=='en'&&e.kind!=='roll'&&e.kind!=='page'&&!e.summary&&!e.attributes){const points=localKeyPoints(text,book.language);if(points.length){const section=document.createElement('section');section.className='local-points';section.innerHTML=`<h3>Points clés de la section</h3><ul>${points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`;root.insertBefore(section,details);}}
  if(text){
      const body=document.createElement('div');body.className='booktext';reader.append(body);
      if(book.language==='en'){
       const notice=document.createElement('p');notice.className='source-warning';notice.textContent='Texte original de l’ouvrage anglais. Il reste disponible même si une traduction est affichée.';body.append(notice);
       const original=document.createElement('div');original.className='source-original';body.append(original);highlightText(original,text,state.query);
       if(canTranslateLocally()){
        const translate=document.createElement('button');translate.className='primary';translate.textContent='Afficher aussi une traduction française';body.prepend(translate);
        translate.onclick=async()=>{
         translate.disabled=true;translate.textContent='Traduction locale en cours…';
         try{const fr=await translatePassage(text,(i,n)=>{translate.textContent='Traduction française : '+i+' / '+n;});
          if(body.isConnected){const translated=document.createElement('section');translated.className='source-translation';const h=document.createElement('h3');h.textContent='Traduction française automatique';translated.append(h);const content=document.createElement('div');translated.append(content);highlightText(content,fr,state.query);body.insertBefore(translated,original);translate.remove();}}
         catch(e){translate.disabled=false;translate.textContent='Réessayer la traduction';toast(e.message||'Traduction indisponible');}
        };
       }
      }else highlightText(body,text,state.query);
      const full=document.createElement('button');full.className='subtle';full.textContent='Consulter les pages PDF originales et suivantes';full.onclick=()=>renderPage(reader,e.source,excerpt?.page||readingPage);reader.append(full);
      if(excerpt?.truncated){const notice=document.createElement('p');notice.className='source-warning';notice.textContent='Cette rubrique se prolonge au-delà des deux pages présentées. Consulte la page originale pour lire la suite.';reader.append(notice);}
   }else{
    const warning=document.createElement('p');warning.className='source-warning';warning.textContent='Impossible de délimiter cette description avec certitude. Aucun texte d’une rubrique voisine n’est attribué à cette fiche.';
    const openPage=document.createElement('button');openPage.className='subtle';openPage.textContent='Consulter la page originale';openPage.onclick=()=>renderPage(reader,e.source,readingPage);
    reader.append(warning,openPage);
   }
 };
 details.addEventListener('toggle',populate);if(details.open)populate();
}

function renderPage(root,source,pno){
 const book=getPrivateBook(source);if(!book)return;const p=book.pages[pno-1];if(!p)return;
 root.innerHTML=`<div class="page-nav"><button data-prev class="subtle" ${pno<=1?'disabled':''}>Précédente</button><label class="small">Page PDF <input type="number" aria-label="Page PDF" min="1" max="${book.pageCount}" value="${pno}"></label><span class="small">${p.printed>0?'p. '+p.printed:''} / ${book.pageCount} pages</span><button data-next class="subtle" ${pno>=book.pageCount?'disabled':''}>Suivante</button></div><div class="booktext"></div>`;
 if(book.language==='en'){
  const area=root.querySelector('.booktext'),original=document.createElement('div');original.className='source-original';area.append(original);highlightText(original,p.text,state.query);
  if(canTranslateLocally()){
   const btn=document.createElement('button');btn.className='primary';btn.textContent='Afficher également cette page en français';area.prepend(btn);
   btn.onclick=async()=>{
    btn.disabled=true;btn.textContent='Traduction en cours…';
    try{const fr=await translatePassage(p.text,(i,n)=>{btn.textContent='Traduction : '+i+' / '+n;});
     if(area.isConnected){const box=document.createElement('section');box.className='source-translation';const h=document.createElement('h3');h.textContent='Traduction française automatique';box.append(h);const txt=document.createElement('div');box.append(txt);highlightText(txt,fr,state.query);area.insertBefore(box,original);btn.remove();}}
    catch(e){btn.disabled=false;btn.textContent='Réessayer la traduction';toast(e.message||'Traduction indisponible');}
   };
  }
 }else highlightText(root.querySelector('.booktext'),p.text,state.query);
 if(hasTable()&&tableShelf()?.pageImages)pagePlateButton(root,source,pno);
 root.querySelector('[data-prev]').onclick=()=>renderPage(root,source,pno-1);root.querySelector('[data-next]').onclick=()=>renderPage(root,source,pno+1);
 root.querySelector('input').onchange=event=>{const n=Number(event.target.value);if(Number.isInteger(n)&&n>=1&&n<=book.pageCount)renderPage(root,source,n);else event.target.value=pno;};
}
function highlightText(root,text,query){
 const words=query.split(/\s+/).filter(w=>w.length>2);if(!words.length){root.textContent=text;return;}
 const re=new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
 const parts=text.split(re);for(let i=0;i<parts.length;i++){if(i%2){const mark=document.createElement('mark');mark.textContent=parts[i];root.append(mark);}else root.append(document.createTextNode(parts[i]));}
}
function bindDetail(e){
 $('#detail').querySelectorAll('[data-sr6-export]').forEach(btn=>btn.onclick=()=>{
  const destination=btn.dataset.sr6Export;
  btn.disabled=true;
  try{const message=sendToArchives(e,destination);toast(message);}
  catch(error){toast(error.message||String(error));}
  finally{btn.disabled=false;}
 });
 $('#entryPrev').onclick=()=>{state.trailAt--;selectEntry(resolveEntry(state.trail[state.trailAt]),{remember:false});};
 $('#entryNext').onclick=()=>{state.trailAt++;selectEntry(resolveEntry(state.trail[state.trailAt]),{remember:false});};
 $('#copyEntry').onclick=()=>copy(profileText(e));
 $('#detail').querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>{$('#source').value='';setKind('equipment');$('#search').value=b.dataset.gear;showBrowseHint('Équipement');runSearch();});
 $('#favorite').onclick=async()=>{state.favorites.has(e.id)?state.favorites.delete(e.id):state.favorites.add(e.id);await savePreferences();counts();runSearch();selectEntry(e,{mobile:false});};
 $('#backResults')?.addEventListener('click',()=>$('.workspace').classList.remove('show-detail'));
 $('#openBooks')?.addEventListener('click',showBooks);
 $('#copyProfile')?.addEventListener('click',()=>copy(profileText(e)+'\n'+profileSkillPools(e).map(s=>s.name+' : '+s.rank+' + '+s.attr+' '+(s.attributeValue??'?')+' = '+(s.total===null?'indéterminé':s.total+' D6')+(s.specialtyTotal?' ; '+s.specialty+' : '+s.specialtyTotal+' D6':'')).join('\n')));
 $('#addCart')?.addEventListener('click',()=>addToCart(e.id));
 $('#entryNote').addEventListener('input',async ev=>{state.notes[e.id]=ev.target.value;$('#noteStatus').textContent='Enregistrement…';await savePreferences();if(state.selected?.id===e.id)$('#noteStatus').textContent='Enregistré';});
 $('#detail').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>selectEntry(state.byId.get(b.dataset.entry)));
}
function counts(){
 const c={rolls:0,indexed:0};state.entries.forEach(e=>{if(e.sourceOnly)c.indexed++;c[e.kind]=(c[e.kind]||0)+1;if(hasRoll(e))c.rolls++;if(e.kind==='skillguide'||hasRoll(e))c.dice=(c.dice||0)+1;});
 $('#tabs').querySelectorAll('[data-kind]').forEach(b=>{const span=b.querySelector('span');if(span)span.textContent=fmt(b.dataset.kind==='favorites'?state.favorites.size:b.dataset.kind?c[b.dataset.kind]||0:state.entries.length);});
}
function situations(){
 delete $('#detail').dataset.inventory;
 const groups=[...new Set(SITUATIONS.map(x=>x.group))];
 $('#detail').innerHTML=`<div class="welcome"><span class="eyebrow">AIDE DE JEU IMMÉDIATE</span><h2>Que veux-tu faire ?</h2><p class="small">Choisis une situation ou saisis ta question. Le jet, l’opposition et les effets sont réunis sur la fiche.</p>${groups.map(g=>`<h3>${esc(g)}</h3><div class="situation-buttons">${SITUATIONS.filter(x=>x.group===g).map(x=>{const e=state.rules.find(r=>r.title===x.title);return e?`<button class="situation" data-entry="${esc(e.id)}">${esc(x.label)}</button>`:'';}).join('')}</div>`).join('')}<div class="catalog-access"><button data-home="equipment">Équipements</button><button data-home="npc">PNJ</button><button data-home="creature">Bestiaire</button><button data-home="rule">Toutes les règles</button></div></div>`;
 $('#detail').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>selectEntry(resolveEntry(b.dataset.entry)));
 $('#detail').querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>setKind(b.dataset.home));
}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copié.');}catch{const d=$('#infoDialog');$('#infoTitle').textContent='Texte à copier';$('#infoBody').replaceChildren();const t=document.createElement('textarea');t.className='note';t.value=text;$('#infoBody').append(t);d.showModal();t.select();}}
function showBooks(){
 const readyIds=new Set(hasTable()?state.books.map(b=>b.id):(state.library?.books.map(b=>b.id)||[]));
 $('#libraryStatus').textContent=hasTable()?'Les six ouvrages de ta table sont accessibles en ligne.':state.library?`${readyIds.size} ouvrages consultables sur cet appareil.`:'Les index et les fiches sont disponibles. Importe le fichier de bibliothèque pour lire et rechercher dans les ouvrages.';
 $('#bookList').innerHTML=state.books.map(b=>`<div class="book-row"><div><strong>${esc(b.displayTitle||b.title)}</strong><p class="small">${b.pageCount} pages · ${b.language==='en'?'Source anglaise · fiches françaises':'Français'}</p></div><div class="book-actions"><button class="subtle" data-book="${esc(b.id)}">${readyIds.has(b.id)?'Ouvrir':'Voir les fiches'}</button><label class="subtle import-button">Ajouter son PDF<input type="file" data-pdfbook="${esc(b.id)}" accept=".pdf,application/pdf" hidden></label></div></div>`).join('');
 $('#removeLibrary').hidden=!state.library;
 $('#importLibrary').closest('label').hidden=hasTable();$('#bookList').querySelectorAll('.import-button').forEach(label=>label.hidden=hasTable());
 $('#bookList').querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>{if(!getPrivateBook(b.dataset.book)&&!hasTable()){state.kind='';$('#source').value=b.dataset.book;setKind('');$('#booksDialog').close();return;}$('#booksDialog').close();const book=sourceBook(b.dataset.book);selectEntry({id:`page:${book.id}:1`,title:book.displayTitle||book.title,kind:'page',source:book.id,page:1});});
 $('#bookList').querySelectorAll('[data-pdfbook]').forEach(input=>input.onchange=()=>importPdf(input.files[0],input.dataset.pdfbook));
 if(!$('#booksDialog').open)$('#booksDialog').showModal();
}
async function importLibrary(file){
 if(!file)return;const p=$('#importProgress');p.hidden=false;$('#importLibrary').disabled=true;$('#importStatus').textContent='Lecture et vérification…';
 try{
  if(file.size>60*1024*1024)throw Error('Le fichier dépasse 60 Mo.');
  const library=await parseLibraryFileText(await file.text());
  const saved=await putStored('library',library);state.library=library;state.worker?.postMessage({type:'library',library});for(const book of library.books)enrichSourceDescriptions(book);$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';
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
  const saved=await putStored('library',library);state.library=library;state.worker?.postMessage({type:'library',library});for(const book of library.books)enrichSourceDescriptions(book);$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';
  status.textContent=saved.persistent?'PDF ajouté. Le texte s’affiche directement dans les fiches.':'PDF ouvert pour cette session : '+saved.message;
  showBooks();runSearch();if(state.selected)selectEntry(state.selected,{mobile:false});
 }catch(error){status.textContent=error.name==='PasswordException'?'Ce PDF est protégé par mot de passe. Utilise sa copie déverrouillée.':error.message;}
 finally{progress.hidden=true;$('#bookList').querySelectorAll('input,button').forEach(x=>x.disabled=false);}
}
function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function glossary(){
 const attrs=(state.terms.attributes||[]).map(x=>({abbr:x.fr,name:x.french}));
 const terms=[...new Set(Object.values(state.terms.terms||{}).filter(x=>typeof x==='string'))].sort((a,b)=>a.localeCompare(b,'fr'));
 $('#infoTitle').textContent='Terminologie française';
 $('#infoBody').innerHTML='<p class="small">Toutes les abréviations et traductions de jeu sont présentées ici en français.</p>'+
  '<div class="table-wrap"><table><thead><tr><th>Abréviation</th><th>Caractéristique</th></tr></thead><tbody>'+
  attrs.map(x=>'<tr><td>'+esc(x.abbr)+'</td><td>'+esc(x.name)+'</td></tr>').join('')+
  '</tbody></table></div><h3>Termes de jeu en français</h3>'+
  '<div class="table-wrap"><table><tbody>'+
  terms.map(x=>'<tr><td>'+esc(x)+'</td></tr>').join('')+
  '</tbody></table></div>';
 $('#infoDialog').showModal();
}
function showCoverage(){
 const c=state.coverage;
 $('#infoTitle').textContent='Contenu intégré';$('#infoBody').innerHTML=`<p>Index de ${fmt(c.pages)} pages dans ${state.books.length} ouvrages. Chaque fiche indique sa page imprimée. Le lecteur donne également le numéro de la page PDF.</p><div class="table-wrap"><table><thead><tr><th>Ouvrage</th><th>Pages</th><th>Entrées d’index</th><th>Profils</th><th>Rappels français</th></tr></thead><tbody>${state.books.map(b=>`<tr><td>${esc(b.displayTitle||b.title)}</td><td>${b.pageCount}</td><td>${c.bySource?.[b.id]?.sections||0}</td><td>${c.bySource?.[b.id]?.profiles||0}</td><td>${state.rules.filter(r=>r.source===b.id).length}</td></tr>`).join('')}</tbody></table></div><p class="small">Le compendium contient en outre ${EDGE_COUNTS.actions} actions d’Atout et ${EDGE_COUNTS.bonus} bonus d’Atout, classés par catégorie, coût et ouvrage. Les entrées d’index donnent accès à la source ; elles ne sont pas toutes des rappels rédigés. Les valeurs des profils sont extraites des tableaux et converties en dés directement utilisables lorsqu’elles sont chiffrées. Les règles optionnelles sont signalées. Les sources en anglais nécessitent la traduction française locale lorsque le navigateur la prend en charge ; aucun texte original non traduit n’est affiché automatiquement.</p><p class="small">${tableShelf()?fmt(tableShelf().tests?.length||0)+' passages sur des jets · '+fmt(Object.values(tableShelf().art).flat().length)+' illustrations · ':''}Version ${VERSION}</p>`;$('#infoDialog').showModal();
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
 if(!await ready())return;observePanel(OBR);state.bridge=bridge(state.equipment);state.isGm=await state.bridge.role()==='GM';$('#npcTab').hidden=!state.isGm;renderCart();
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
// Enrichissement progressif et privé, uniquement quand le livre est disponible.
function enrichSourceDescriptions(book){
 if(!book?.pages?.length||book.language!=='fr'||sourceSummaryJobs.has(book.id))return;
 const candidates=state.entries.filter(e=>e.sourceOnly&&e.source===book.id&&!e.summary);
 const job=(async()=>{
  let count=0,changed=false;
  for(const entry of candidates){
   if(state.byId?.get(entry.id)!==entry)break;
   const passage=sectionExcerpt(entry,book,state.index);
   const desc=conciseSourceDescription(passage,book.language);
   if(desc&&passage&&['exact-heading','heading-and-anchor','exact-id-anchor'].includes(passage.matchedBy)){
    entry.summary=desc.text;entry.sourceSummary=true;entry.sourceSummaryPage=passage.page;changed=true;
   }
   if(++count%18===0)await new Promise(resolve=>setTimeout(resolve,1));
  }
  if(changed){
   state.prepared=prepareEntries(state.entries);
   if(state.worker)state.worker.postMessage({type:'init',entries:state.entries,terms:state.terms.terms});
   runSearch();
   if(state.kind==='indexed'&&!state.selected)showBrowseHint('Rubriques des livres');
  }
 })().finally(()=>sourceSummaryJobs.delete(book.id));
 sourceSummaryJobs.set(book.id,job);
}
async function restoreLibrary(){
 try{const library=await getStored('library');if(!library)return;state.library=validateLibrary(library);$('#fulltext').disabled=false;$('#fulltext').checked=true;$('#libraryDot').textContent='●';state.worker?.postMessage({type:'library',library:state.library});for(const book of state.library.books)enrichSourceDescriptions(book);if($('#booksDialog').open)showBooks();if(state.selected)selectEntry(state.selected,{mobile:false,remember:false});}catch{}
}
async function loadBundledJson(name){
 let lastError;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetch('data/'+name+'.json?v=144',{
    signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(attempt===1?8000:12000):undefined,
    cache:attempt===1?'default':'reload'
   });
   if(!response.ok)throw Error('HTTP '+response.status);
   return await response.json();
  }catch(error){lastError=error;}
 }
 throw Error('Données du compendium ('+name+') indisponibles : '+(lastError?.message||'problème réseau'));
}
async function init(){
 try{
  $('#resultCount').textContent='Chargement automatique du catalogue…';
  const files=['sources','index','equipment','profiles','rules','coverage','terminology'];
  const values=await Promise.all(files.map(loadBundledJson));
  const [books,index,equipment,profiles,rules,coverage,terms]=values;Object.assign(state,{books,index,equipment,profiles,rules,baseRules:rules,coverage,terms});
  buildEntries();
  const [prefs,cart]=await Promise.all([getStored('preferences',{}),getStored('cart',[])]);
  state.favorites=new Set((prefs.favorites||[]).filter(id=>typeof id==='string'));state.notes=prefs.notes&&typeof prefs.notes==='object'?prefs.notes:{};
  try{state.cart=cart.length?safeCart(cart,equipment):[];}catch{state.cart=[];}
  for(const b of books){const option=document.createElement('option');option.value=b.id;option.textContent=b.displayTitle||b.title;$('#source').append(option);}
  counts();renderCart();restoreCatalogRoute();if($('#booksDialog').open)showBooks();$('#coverage').textContent=`${books.length} ouvrages · ${fmt(coverage.pages)} pages indexées · v${VERSION}`;
  initWorker();
  runSearch();
  const selection=new URLSearchParams(location.search).get('entry');
  const e=resolveEntry(selection);if(e)selectEntry(e);
  void restoreLibrary();
  void activateTable(selection);
  void setupBridge().catch(fail);
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js?v=144').catch(()=>{});
 }catch(e){
   $('#resultCount').textContent='Chargement interrompu';
   $('#detail').innerHTML='<div class="startup-error"><h2>Le catalogue n’a pas pu s’ouvrir</h2><p id="startupErrorText"></p><button id="retryLoad" class="primary">Réessayer le chargement</button></div>';
   $('#startupErrorText').textContent=String(e?.message||e);
   $('#retryLoad').onclick=()=>location.reload();
   fail(e);
  }
}
function initWorker(){
 try{
   const w=new Worker(new URL('./search-worker.mjs?v=144',import.meta.url),{type:'module'});state.worker=w;
   w.onmessage=({data})=>{if(data.type==='results')renderResults(data);if(data.type==='ready'){state.workerReady=true;runSearch();}if(data.type==='library-ready')runSearch();if(data.type==='error')fail(Error(data.message));};
   w.onerror=()=>{w.terminate();state.worker=null;state.workerReady=false;runSearch();};w.postMessage({type:'init',entries:state.entries,terms:state.terms.terms});
  }catch{state.worker=null;}
}
$('#search').addEventListener('input',()=>{state.seq++;state.pendingAction=null;$('.workspace').classList.remove('show-detail','browse-catalog');clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(),90);});
$('#search').addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'||ev.key==='Enter'){ev.preventDefault();clearTimeout(searchTimer);state.pendingAction=ev.key==='Enter'?'open':'focus';runSearch();}});
$('#results').addEventListener('keydown',ev=>{if(!['ArrowDown','ArrowUp'].includes(ev.key))return;const buttons=[...$('#results').querySelectorAll('.result')],at=buttons.indexOf(document.activeElement);if(at<0)return;ev.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,at+(ev.key==='ArrowDown'?1:-1)))].focus();});
$('#category').onchange=()=>{$('#category').value?chooseFamily($('#category').value):(state.browse={family:'',sub:''},renderQuickBar(),runSearch());};
$('#practicalOnly').onchange=()=>{state.browse={family:'',sub:''};renderCategoryLanding();runSearch();};
$('#edgeCost').onchange=()=>runSearch();
 $('#source').onchange=()=>{state.browse={family:'',sub:''};updateCategoryFilter();renderCategoryLanding();runSearch();};$('#topic').onchange=()=>{state.browse={family:'',sub:''};updateCategoryFilter();renderCategoryLanding();runSearch();};$('#fulltext').onchange=()=>runSearch();
$('#tabs').querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>setKind(b.dataset.kind));
$('#quick').querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{$('#search').value=b.dataset.query;runSearch();});
$('#reset').onclick=()=>{$('#source').value='';$('#fulltext').checked=false;$('#practicalOnly').checked=false;setKind('');};
$('#more').onclick=()=>{state.offset+=75;runSearch(true);};
$('#situationsButton').onclick=()=>{situations();$('.workspace').classList.add('show-detail');};
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
for(const [id,[name]] of Object.entries(THEMES)){const o=new Option(name,id);$('#topic').append(o);}
$('#homeButton').onclick=()=>{state.selected=null;const u=new URL(location.href);u.searchParams.delete('entry');history.replaceState(null,'',u.href);$('#source').value='';setKind('');};
welcome();
installWindowControls({OBR,ready,viewState:()=>({kind:state.kind,topic:$('#topic').value,source:$('#source').value,search:$('#search').value,family:state.browse.family,sub:state.browse.sub,entry:state.selected?.id||''})});
void init();

function buildEntries(extra,tests=[]) {
 state.rules=mergeTableRules(state.baseRules,extra);
 const pages=tableShelf()?.gearPages||{};
 const equipment=state.equipment.map(e=>pages[e.id]?{...e,descriptionPage:pages[e.id]}:e);
 const catalog=assembleEntries({rules:state.rules,index:state.index,equipment,profiles:state.profiles});
 state.entries=[...catalog.entries,...skillGuideEntries(),...EDGE_ENTRIES,...tests].map(e=>({...e,topic:topicOf(e)}));
  state.equipmentGroups=new Map();
  for(const e of state.entries.filter(e=>e.kind==='equipment')){
   const key=normalize(title(e))+'|'+normalize(e.category||'');
   if(!state.equipmentGroups.has(key))state.equipmentGroups.set(key,[]);
   state.equipmentGroups.get(key).push(e);
  }
 state.byId=new Map(state.entries.map(e=>[e.id,e]));
 for(const [id,target] of catalog.replacements)state.byId.set(id,state.byId.get(target));
 state.prepared=prepareEntries(state.entries);
 state.aliases=makeAliases(state.terms.terms);
}
async function activateTable(desired) {
 try{
  const shelf=await startTable();if(!shelf)return;
  buildEntries(shelf.extra,shelf.tests||[]);
  $('#fulltext').disabled=false;$('#fulltext').checked=true;
  $('#libraryDot').textContent='●';$('#booksButton').firstChild.textContent='Ouvrages ';
  if(state.worker)state.worker.postMessage({type:'init',entries:state.entries,terms:state.terms.terms});
  counts();runSearch();
  if($('#booksDialog').open)showBooks();
  const selected=resolveEntry(state.selected?.id||desired);
  if(selected)selectEntry(selected,{mobile:false,remember:false});
  else if(state.browse.family)chooseFamily(state.browse.family,state.browse.sub);
  else if($('#detail .theme-grid'))welcome();
 }catch(error){
  if(!hasTable())return;
  const box=document.createElement('div');box.className='table-retry';box.setAttribute('role','status');
  box.textContent='Connexion aux ouvrages interrompue. ';
  const retry=document.createElement('button');retry.className='textbutton';retry.textContent='Réessayer';retry.onclick=()=>{box.remove();void activateTable(desired);};
  box.append(retry);$('#app').prepend(box);
 }
}
function ensureBook(id){
 if(onlineBooks.has(id))return Promise.resolve(onlineBooks.get(id));
 if(!hasTable())return Promise.resolve(getPrivateBook(id));
 if(!pendingBooks.has(id)){
  const task=fetchBook(id).then(raw=>{
   const book={...sourceBook(id),...raw};
   onlineBooks.set(id,book);
   enrichSourceDescriptions(book);
   const library={books:[...onlineBooks.values(),...(state.library?.books||[]).filter(b=>!onlineBooks.has(b.id))]};
   if(state.worker)state.worker.postMessage({type:'book',book});
   else state.fullPages=libraryPages(library);
   return book;
  }).catch(err=>{pendingBooks.delete(id);throw err;});
  pendingBooks.set(id,task);
 }
 return pendingBooks.get(id);
}
function prepareAllBooks(){
 if(!allBooksRequest){
  const incomplete=state.books.filter(b=>!onlineBooks.has(b.id));
  allBooksRequest=Promise.allSettled(incomplete.map(b=>ensureBook(b.id))).then(results=>{
   if(results.some(r=>r.status==='rejected')){
    // A later query can retry a book interrupted by a connection loss.
    setTimeout(()=>{allBooksRequest=null;},2000);
   }
   if(!state.worker)runSearch();
  });
 }
 return allBooksRequest;
}
function releaseArt(){for(const url of selectedArtUrls)URL.revokeObjectURL(url);selectedArtUrls=[];}
function pagePlateButton(root,id,page){
 const b=document.createElement('button');b.type='button';b.className='subtle printed-page';b.textContent='Voir la page originale';b.onclick=()=>openPlate(id,{file:`art-${page}-999.webp`,page},true);root.append(b);
}
function renderArtwork(e,root) {
 const shelf=tableShelf();if(!shelf)return;
 const art=selectPlates(e,shelf.art);
 const wrap=document.createElement('section');wrap.className='art-section';
 if(art.length){
  const h=document.createElement('h3');h.textContent=art.every(a=>!a.label)?(art.length===1?'Illustration de la page':'Illustrations de la page'):(art.length===1?'Illustration du livre':'Illustrations du livre');wrap.append(h);
  const grid=document.createElement('div');grid.className='plate-gallery';wrap.append(grid);
  for(const a of art){
   const b=document.createElement('button');b.className='plate-thumb';b.type='button';
   const label=a.label||sourceLabel({...e,page:a.page,printedPage:a.page-sourceBook(e.source).printedOffset});
   b.setAttribute('aria-label','Agrandir · '+label);
   const im=document.createElement('img');im.alt=label;im.width=a.size[0];im.height=a.size[1];
   const caption=document.createElement('span');caption.textContent=label;b.append(im,caption);
   b.onclick=()=>openPlate(e.source,a);grid.append(b);
   fetchPlate(e.source,a.file).then(blob=>{
    if(!b.isConnected)return;const u=URL.createObjectURL(blob);selectedArtUrls.push(u);im.src=u;
   }).catch(()=>{if(b.isConnected){im.remove();caption.textContent='Ouvrir l’illustration · '+label;}});
  }
 }
 if(shelf.pageImages)pagePlateButton(wrap,e.source,e.descriptionPage||e.page);
 if(wrap.childElementCount)root.append(wrap);
}
let openImageId=0,dialogImageUrl;
async function openPlate(id,art,isPage=false) {
 const dialog=$('#infoDialog'),body=$('#infoBody'),seq=++openImageId;
 $('#infoTitle').textContent=(isPage?'Page originale':'Illustration')+' · '+sourceName(id)+' · '+(art.page>sourceBook(id).printedOffset?'p. '+(art.page-sourceBook(id).printedOffset):'PDF '+art.page);
 body.replaceChildren();body.textContent='Ouverture…';dialog.classList.add('image-reader');if(!dialog.open)dialog.showModal();
 try{
  const blob=await fetchPlate(id,art.file);
  if(!dialog.open||seq!==openImageId)return;
  if(dialogImageUrl)URL.revokeObjectURL(dialogImageUrl);
  dialogImageUrl=URL.createObjectURL(blob);
  const image=document.createElement('img');image.src=dialogImageUrl;image.alt=art.label||$('#infoTitle').textContent;
  const zoom=document.createElement('button');zoom.className='subtle zoom-page';zoom.textContent='Agrandir';
  zoom.onclick=()=>{const full=body.classList.toggle('zoomed');zoom.textContent=full?'Ajuster à la fenêtre':'Agrandir';};
  body.replaceChildren(zoom,image);
 }catch{if(seq===openImageId&&dialog.open){body.textContent='Illustration indisponible. ';const retry=document.createElement('button');retry.textContent='Réessayer';retry.onclick=()=>openPlate(id,art,isPage);body.append(retry);}}
}
$('#infoDialog').addEventListener('close',()=>{openImageId++;$('#infoDialog').classList.remove('image-reader');$('#infoBody').classList.remove('zoomed');if(dialogImageUrl){URL.revokeObjectURL(dialogImageUrl);dialogImageUrl=null;}});
function welcome() {
 const node=$('#detail');releaseArt();state.selected=null;delete node.dataset.inventory;
 $('#homeButton').setAttribute('aria-pressed','true');$('#catalogTrail').hidden=true;$('.workspace').classList.remove('browse-catalog');
 node.innerHTML='<div class="theme-home"><h2>Thèmes du compendium</h2><div class="theme-grid"></div></div>';
 const grid=node.querySelector('.theme-grid');
 for(const [id,[name,desc]] of Object.entries(THEMES)){
  const b=document.createElement('button');b.className='theme-card';b.dataset.theme=id;
  const heading=document.createElement('strong');heading.textContent=name;const hint=document.createElement('span');hint.textContent=desc;
  b.append(heading,hint);b.onclick=()=>browseTheme(id);grid.append(b);
 }
 $('.workspace').classList.add('show-detail');
}
function browseTheme(id){
 if(!THEMES[id])return;
 state.kind='';state.browse={family:'',sub:''};state.selected=null;
 $('#search').value='';$('#source').value='';$('#topic').value=id;
 $('#tabs').querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind===''));
 $('#homeButton').setAttribute('aria-pressed','false');updateCategoryFilter();
 renderCategoryLanding();runSearch();
}
function themeLanding(id){renderCategoryLanding();}


function currentHierarchy(){
 return quickCatalogHierarchy(state.entries,{kind:state.kind,topic:$('#topic').value,source:$('#source').value,
  favorites:state.kind==='favorites'?state.favorites:null,practicalOnly:$('#practicalOnly').checked});
}
function showBrowseHint(title){
 const root=$('#detail');releaseArt();
 if(state.kind==='indexed'){
  const rows=state.books.map(b=>({book:b,items:state.entries.filter(e=>e.sourceOnly&&e.source===b.id)}));
  const described=state.entries.filter(e=>e.sourceOnly&&e.sourceSummary).length;
  root.innerHTML='<section class="indexed-overview"><span class="eyebrow">INVENTAIRE INTÉGRAL</span><h2>Rubriques des livres</h2><p>Cette rubrique rassemble les entrées de l’index qui n’ont pas encore de fiche rédigée séparément. Une rubrique de chapitre peut être un simple titre et non une règle. En ouvrant une fiche, le passage précis du livre est recherché et sa description extractive peut s’afficher si l’ouvrage est accessible.</p><p class="small">Descriptions extractives produites à partir des livres disponibles : '+fmt(described)+' / '+fmt(state.entries.filter(e=>e.sourceOnly).length)+'.</p><div class="edge-category-grid">'+rows.map(r=>'<button data-index-source="'+esc(r.book.id)+'"><strong>'+esc(sourceName(r.book.id))+'</strong><small>'+fmt(r.items.length)+' rubriques</small></button>').join('')+'</div><p class="small">Un passage non délimité n’est jamais remplacé par le texte de la rubrique voisine.</p></section>';
  root.querySelectorAll('[data-index-source]').forEach(b=>b.onclick=()=>{$('#source').value=b.dataset.indexSource;state.browse={family:'',sub:''};updateCategoryFilter();renderQuickBar();runSearch();showBrowseHint('Rubriques · '+sourceName(b.dataset.indexSource));});
 }else if(state.kind==='dice'){
  const groups=[...new Set(SITUATIONS.map(x=>x.group))];
  const section=groups.map(g=>'<div class="dice-domain"><h3>'+esc(g)+'</h3><div class="dice-links">'+SITUATIONS.filter(x=>x.group===g).map(x=>{
   const e=state.rules.find(r=>r.title===x.title);return e?'<button class="relation" data-entry="'+esc(e.id)+'">'+esc(x.label)+'</button>':'';
  }).join('')+'</div></div>').join('');
  root.innerHTML='<section class="dice-overview"><span class="eyebrow">AIDE DE JEU SHADOWRUN 6</span><h2>🎲 Jets de dés</h2><p>Les 19 compétences actives et les 92 procédures répertoriées sont accessibles dans la liste. Sélectionne un domaine ci-dessus pour filtrer, ou ouvre directement un test ci-dessous.</p><p class="small">Chaque fiche précise les attributs et compétences, oppositions, seuils ou effets lorsqu’ils sont connus. Aucun dé n’est lancé automatiquement.</p><div class="dice-domains">'+section+'</div></section>';
  root.querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>selectEntry(state.byId.get(b.dataset.entry)));
 }else if(state.kind==='edgeaction'||state.kind==='edgeboost'){
   const action=state.kind==='edgeaction';
   const items=state.entries.filter(e=>e.kind===state.kind);
   const cards=EDGE_CATEGORIES.map(name=>({name,count:items.filter(e=>e.category===name).length})).filter(x=>x.count);
   root.innerHTML='<section class="edge-overview"><span class="eyebrow">AIDE DE JEU SHADOWRUN 6</span><h2>'+esc(action?'⚡ Actions d’Atout':'⚡ Bonus d’Atout')+'</h2><p>Choisir une catégorie pour voir les coûts, les conditions, le moment d’utilisation et l’action majeure ou mineure associée. Les règles spécifiques des ouvrages complètent celles du livre de base.</p><p class="small">Règle générale : une seule utilisation de l’Atout par action, réserve limitée à 7 points, gain limité à 2 points pendant le tour d’un personnage (hors variantes optionnelles). Une action d’Atout accompagne généralement une autre action sans coût supplémentaire en actions, sauf mention contraire. Certaines actions de poursuite autorisent une dépense après le jet.</p><p class="small">'+fmt(items.length)+' fiches · '+fmt(cards.length)+' domaines · aucune dépense ou jet automatique</p><div class="edge-category-grid">'+cards.map(c=>'<button data-edge-cat="'+esc(c.name)+'"><strong>'+esc(c.name)+'</strong><small>'+fmt(c.count)+' fiches</small></button>').join('')+'</div></section>';
   root.querySelectorAll('[data-edge-cat]').forEach(btn=>btn.onclick=()=>chooseFamily(btn.dataset.edgeCat));
  }else root.innerHTML='<div class="browse-hint"><h2>'+esc(title)+'</h2><p>Choisis une fiche dans la liste de gauche. Tu peux changer de catégorie sans refaire ta recherche.</p></div>';
 $('.workspace').classList.remove('browse-catalog','show-detail');
}
function renderCategoryLanding(){
 if(!state.kind&&!$('#topic').value){welcome();return;}
 state.browse={family:'',sub:''};
 updateCategoryFilter();renderQuickBar();
 showBrowseHint(state.kind?(KIND_NAMES[state.kind]||'Catalogue'):(topics[$('#topic').value]||'Thème'));
}
function renderQuickBar(){
 const groups=currentHierarchy();
 const bar=$('#catalogTrail');bar.replaceChildren();
 bar.hidden=!state.kind&&!$('#topic').value;
 if(bar.hidden)return;
 const chip=(text,active,callback)=>{
  const b=document.createElement('button');b.type='button';
  b.className='catalog-chip'+(active?' selected':'');b.textContent=text;b.onclick=callback;return b;
 };
 bar.append(chip('Tout',!state.browse.family,()=>{
  state.browse={family:'',sub:''};updateCategoryFilter();renderQuickBar();
  showBrowseHint('Toutes les fiches');runSearch();
 }));
 // Eight shortcuts for equipment; no wall of subcategories.
 const top=state.kind==='equipment'?groups:groups.slice(0,7);
 for(const group of top){
  bar.append(chip(group.name,state.browse.family===group.name,()=>chooseFamily(group.name)));
 }
 if(groups.length>top.length){
  const more=document.createElement('select');more.className='catalog-more';
  more.setAttribute('aria-label','Autres catégories');
  more.append(new Option('Autres catégories…',''));
  for(const g of groups.slice(top.length))more.append(new Option(g.name,g.name));
  if(groups.slice(top.length).some(g=>g.name===state.browse.family))more.value=state.browse.family;
  more.onchange=()=>chooseFamily(more.value);bar.append(more);
 }
 const current=groups.find(g=>g.name===state.browse.family);
 if(current&&current.children.length>1){
  const filter=document.createElement('select');filter.className='catalog-refine';
  filter.setAttribute('aria-label','Filtrer par type précis');
  filter.append(new Option('Tous les types',''));
  for(const c of current.children)filter.append(new Option(c.name+' ('+fmt(c.count)+')',c.name));
  filter.value=state.browse.sub;
  filter.hidden=!state.browse.sub;
  const show=chip(state.browse.sub?'Type : '+state.browse.sub:'Affiner ▾',Boolean(state.browse.sub),()=>{
   filter.hidden=!filter.hidden;if(!filter.hidden)filter.focus();
  });
  filter.onchange=()=>chooseFamily(current.name,filter.value);
  bar.append(show,filter);
 }
}
function chooseFamily(family,sub=''){
 const item=currentHierarchy().find(g=>g.name===family);
 if(!item){state.browse={family:'',sub:''};renderQuickBar();runSearch();return;}
 state.browse={family,sub:item.children.some(x=>x.name===sub)?sub:''};
 updateCategoryFilter();renderQuickBar();
 showBrowseHint(state.browse.sub||family);
 runSearch();
}
function restoreCatalogRoute(){
 const p=new URLSearchParams(location.search);
 const kind=p.get('kind')||'',topic=p.get('topic')||'',family=p.get('family')||'',sub=p.get('sub')||'';
 if(['rule','indexed','action','edgeaction','edgeboost','rolls','dice','equipment','npc','creature','favorites'].includes(kind))state.kind=kind;
 if(topic&&THEMES[topic])$('#topic').value=topic;
 if(p.get('search'))$('#search').value=p.get('search');
 if(p.get('source')&&state.books.some(b=>b.id===p.get('source')))$('#source').value=p.get('source');
 $('#tabs').querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind===state.kind));
 $('#quick').hidden=Boolean(state.kind);
 updateCategoryFilter();
 if(family&&currentHierarchy().some(g=>g.name===family))chooseFamily(family,sub);
 else if(p.get('search')||state.kind==='favorites'){renderQuickBar();showBrowseHint('Résultats');}
 else if(state.kind||$('#topic').value)renderCategoryLanding();
 else welcome();
}
