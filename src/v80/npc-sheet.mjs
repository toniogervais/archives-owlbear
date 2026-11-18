/* V4.64 — Fiche Shadowrun 6 des PNJ, import non destructif réservé au MJ. */
export const ATTRIBUTES=['CON','AGI','RÉA','FOR','VOL','LOG','INT','CHA','MAG','ESS'];
export const COMBAT=['SD','I/DI','PA','ME','DÉPLACEMENT','DRAIN'];
export const SECTIONS=[
 ['competences','Compétences'],['sorts','Sorts'],['augmentations','Augmentations'],
 ['equipement','Équipement'],['armes','Armes'],['pouvoirs','Pouvoirs'],['notes','Notes MJ']
];
const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const isGM=()=>{const s=window.DuneApp?.getState?.();return !!s&&!s.playerMode&&!s.strictReadOnly&&!document.body.classList.contains('player-mode')&&!document.body.classList.contains('strict-readonly')};
const nodeOf=id=>isGM()?window.DuneApp.getState().nodes.find(n=>String(n.id)===String(id)&&n.category==='personnage'):null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+v)?Math.trunc(+v):min));
const bounded=(value,max)=>typeof value==='string'?value.slice(0,max):Number.isFinite(value)?String(value).slice(0,max):'';
export function normalizeNpcSheet(input){
 const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const attributes={},combat={},sections={};
 for(const key of ATTRIBUTES)attributes[key]=bounded(raw.attributes?.[key],32);
 for(const key of COMBAT)combat[key]=bounded(raw.combat?.[key],72);
 for(const [key]of SECTIONS)sections[key]=bounded(raw.sections?.[key],12000);
 const professionalism=raw.professionnalisme===''||raw.professionnalisme==null?null:clamp(raw.professionnalisme,0,99);
 const condition={};
 for(const key of ['physical','stun']){
  const rawTrack=raw.condition?.[key]||{};
  const total=clamp(rawTrack.total,0,60);
  condition[key]={total,damage:clamp(rawTrack.damage,0,total)};
 }
 return {professionnalisme:professionalism,attributes,combat,sections,condition};
}
function field(label,value,name,kind='text'){
 const wrapper=$('label','npc-edit-field');
 wrapper.append($('span',null,label));
 const input=$(kind==='textarea'?'textarea':'input');
 input.name=name;input.value=value==null?'':String(value);
 if(kind==='textarea'){input.rows=3;input.maxLength=12000}else{
  input.type=kind==='number'?'number':'text';
  if(kind==='number'){input.min='0';input.max=name==='npc-professionnalisme'?'99':'60';input.step='1'}
  else input.maxLength=name.startsWith('attribute:')?32:72;
 }
 wrapper.append(input);
 return wrapper;
}
let editorFocus=null;
function editor(){
 let dialog=document.getElementById('archives-npc-editor');
 if(dialog)return dialog;
 dialog=$('dialog');dialog.id='archives-npc-editor';dialog.setAttribute('aria-label','Modifier les caractéristiques du PNJ');
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{editorFocus?.focus?.();editorFocus=null});
 return dialog;
}
export function openNpcEditor(id){
 const node=nodeOf(id);if(!node)return false;
 const data=normalizeNpcSheet(node.npcSheet),dialog=editor();
 editorFocus=document.activeElement;
 const form=$('form','npc-editor-form');form.noValidate=true;
 const head=$('header','npc-editor-head');
 head.append($('div',null,''));head.firstChild.append($('span','npc-editor-eyebrow','Fiche MJ · Shadowrun 6'),$('h2',null,node.title||'Personnage'));
 const close=$('button','npc-editor-close','×');close.type='button';close.setAttribute('aria-label','Fermer sans enregistrer');close.onclick=()=>dialog.close();head.append(close);form.append(head);
 const importSection=$('section','npc-editor-section npc-import-section');
 const importRow=$('div','npc-import-row');
 const pick=$('button','npc-import-button','Importer un fichier');pick.type='button';pick.setAttribute('aria-label','Importer une fiche PNJ depuis un fichier');
 const file=$('input','npc-import-file');file.type='file';file.accept='.json,.txt,.csv,.tsv,.pdf,application/json,text/plain,text/csv,application/pdf';file.hidden=true;file.setAttribute('aria-label','Choisir un fichier de caractéristiques PNJ');
 const importNote=$('span','npc-import-help','PDF texte, TXT, CSV ou JSON');
 const importPreview=$('div','npc-import-preview');importPreview.hidden=true;
 pick.onclick=()=>file.click();
 file.onchange=async()=>{
  const selected=file.files?.[0];if(!selected)return;
  importPreview.hidden=false;importPreview.replaceChildren($('span',null,'Analyse du fichier…'));
  pick.disabled=true;
  try{
   const parser=window.ArchivesNpcImport?.readNpcFile;
   if(!parser)throw Error('Le module d’import est indisponible.');
   const result=await parser(selected);
   if(!form.isConnected||!dialog.open)return;
   const fields=result.fields,summary=[];
   if(fields.professionnalisme!==undefined)summary.push('Professionnalisme : '+fields.professionnalisme);
   for(const [group,entries] of [['attributes',ATTRIBUTES],['combat',COMBAT]]){
    for(const key of entries)if(fields[group]?.[key])summary.push(key+' : '+fields[group][key]);
   }
   for(const [key,label]of SECTIONS)if(fields.sections?.[key])summary.push(label+' : '+fields.sections[key].slice(0,85)+(fields.sections[key].length>85?'…':''));
   for(const [key,label]of [['physical','Physique'],['stun','Étourdissement']])if(fields.condition?.[key])summary.push(label+' : '+fields.condition[key].damage+'/'+fields.condition[key].total);
   importPreview.replaceChildren($('strong',null,result.count+' champs reconnus dans « '+selected.name.slice(0,120)+' »'));
   const list=$('ul','npc-import-found');for(const text of summary.slice(0,35))list.append($('li',null,text));importPreview.append(list);
   const control=$('label','npc-import-option'),replace=$('input');replace.type='checkbox';replace.setAttribute('aria-label','Remplacer les champs déjà renseignés');control.append(replace,$('span',null,'Remplacer les valeurs déjà renseignées'));importPreview.append(control);
   const apply=$('button','npc-import-apply','Compléter les champs');apply.type='button';importPreview.append(apply);
   apply.onclick=()=>{
    const write=(name,value)=>{const input=form.elements.namedItem(name);if(!input||value==null)return;if(replace.checked||!String(input.value).trim())input.value=String(value)};
    if(fields.professionnalisme!==undefined)write('npc-professionnalisme',fields.professionnalisme);
    for(const key of ATTRIBUTES)write('attribute:'+key,fields.attributes?.[key]);
    for(const key of COMBAT)write('combat:'+key,fields.combat?.[key]);
    for(const [key]of SECTIONS)write('section:'+key,fields.sections?.[key]);
    for(const key of ['physical','stun'])if(fields.condition?.[key]){
     write('track-total:'+key,fields.condition[key].total);
     if(fields.condition[key].damage)write('track-damage:'+key,fields.condition[key].damage);
    }
    apply.textContent='Champs intégrés';apply.disabled=true;
    const note=$('span','npc-import-confirm','Modifications en attente : clique sur Enregistrer pour les conserver.');importPreview.append(note);
   };
  }catch(error){if(form.isConnected&&dialog.open)importPreview.replaceChildren($('span','npc-import-error',error?.message||'Lecture du fichier impossible.'))}
  finally{pick.disabled=false;file.value=''}
 };
 importRow.append(pick,file,importNote);importSection.append(importRow,importPreview);form.append(importSection);
 const prof=$('section','npc-editor-section');prof.append($('h3',null,'Professionnalisme'),field('Professionnalisme',data.professionnalisme,'npc-professionnalisme','number'));form.append(prof);
 const attributes=$('section','npc-editor-section'),ag=$('div','npc-editor-grid npc-editor-attributes');
 attributes.append($('h3',null,'Caractéristiques'));
 for(const key of ATTRIBUTES)ag.append(field(key,data.attributes[key],'attribute:'+key));
 attributes.append(ag);form.append(attributes);
 const combat=$('section','npc-editor-section'),cg=$('div','npc-editor-grid npc-editor-combat');
 combat.append($('h3',null,'Combat et valeurs dérivées'));
 for(const key of COMBAT)cg.append(field(key,data.combat[key],'combat:'+key));
 combat.append(cg);form.append(combat);
 const life=$('section','npc-editor-section'),lg=$('div','npc-editor-grid npc-editor-health');
 life.append($('h3',null,'Moniteurs de blessures'));
 for(const [key,label] of [['physical','Dégâts physiques'],['stun','Étourdissement']]){
  const segment=$('div','npc-editor-track'),title=$('h4',null,label);
  segment.append(title,field('Cases disponibles',data.condition[key].total,'track-total:'+key,'number'),field('Cases cochées',data.condition[key].damage,'track-damage:'+key,'number'));lg.append(segment);
 }
 life.append(lg);form.append(life);
 const items=$('section','npc-editor-section');items.append($('h3',null,'Compétences et équipement'));
 for(const [key,label]of SECTIONS)items.append(field(label,data.sections[key],'section:'+key,'textarea'));
 form.append(items);
 const status=$('p','npc-editor-status');status.setAttribute('role','status');status.hidden=true;
 const foot=$('footer','npc-editor-foot'),cancel=$('button','npc-editor-cancel','Annuler'),save=$('button','npc-editor-save','Enregistrer');
 cancel.type='button';cancel.onclick=()=>dialog.close();save.type='submit';
 foot.append(cancel,save);form.append(status,foot);
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!nodeOf(id)){status.hidden=false;status.textContent='La fiche MJ n’est plus disponible.';return}
  const read=name=>form.elements.namedItem(name)?.value??'';
  const next={professionnalisme:read('npc-professionnalisme'),attributes:{},combat:{},sections:{},condition:{}};
  for(const key of ATTRIBUTES)next.attributes[key]=read('attribute:'+key);
  for(const key of COMBAT)next.combat[key]=read('combat:'+key);
  for(const [key]of SECTIONS)next.sections[key]=read('section:'+key);
  for(const key of ['physical','stun'])next.condition[key]={total:read('track-total:'+key),damage:read('track-damage:'+key)};
  try{
   if(!window.DuneApp?.setNpcSheet?.(id,next))throw Error('Enregistrement refusé.');
   dialog.close();
  }catch(error){status.hidden=false;status.textContent=error?.message||'Enregistrement impossible.'}
 });
 dialog.replaceChildren(form);
 if(!dialog.open)dialog.showModal();
 form.querySelector('[name="npc-professionnalisme"]')?.focus();
 return true;
}
function statsGrid(fields,values,cls){
 const grid=$('div','npc-stats-grid '+cls);
 for(const key of fields){
  const cell=$('div','npc-stat');
  cell.append($('span','npc-stat-label',key),$('strong','npc-stat-value',values[key]?.trim()||'—'));
  grid.append(cell);
 }
 return grid;
}
function track(nodeId,kind,label,model){
 const section=$('section','npc-track');
 const row=$('div','npc-track-head');row.append($('strong',null,label),$('span','npc-track-value',model.total?model.damage+' / '+model.total:'—'));
 section.append(row);
 if(!model.total){section.append($('span','npc-track-empty','Moniteur à renseigner'));return section}
 const boxes=$('div','npc-track-boxes');
 boxes.setAttribute('role','group');boxes.setAttribute('aria-label','Moniteur : '+label);
 for(let index=0;index<model.total;index++){
  const box=$('input','npc-track-box');box.type='checkbox';box.checked=index<model.damage;
  box.setAttribute('aria-label',label+' : case '+(index+1)+' sur '+model.total);
  box.addEventListener('change',()=>{
   const value=box.checked?index+1:index;
   if(!isGM()||!window.DuneApp?.setNpcCondition?.(nodeId,kind,value)){box.checked=!box.checked;return}
   // Update the visible track immediately, before the MJ card re-renders.
   for(const [i,item] of Array.from(boxes.children).entries())item.checked=i<value;
   row.querySelector('.npc-track-value').textContent=value+' / '+model.total;
  });
  boxes.append(box);
 }
 section.append(boxes);
 return section;
}
export function renderNpcPanel(node){
 if(!node||node.category!=='personnage'||!isGM())return null;
 const data=normalizeNpcSheet(node.npcSheet),panel=$('section','npc-sheet');
 panel.setAttribute('aria-label','Caractéristiques MJ du personnage');
 const head=$('div','npc-sheet-head'),prof=$('div','npc-professionalism');
 prof.append($('span',null,'PROFESSIONNALISME'),$('strong',null,data.professionnalisme==null?'—':data.professionnalisme));
 const edit=$('button','npc-sheet-edit','✎');edit.type='button';edit.title='Modifier les caractéristiques et équipements';
 edit.setAttribute('aria-label','Modifier la fiche PNJ : caractéristiques, équipement et moniteurs');
 edit.addEventListener('click',()=>openNpcEditor(node.id));
 head.append(prof,edit);panel.append(head);
 panel.append(statsGrid(ATTRIBUTES,data.attributes,'npc-attributes'),statsGrid(COMBAT,data.combat,'npc-combat'));
 const info=$('div','npc-sheet-info');
 for(const [key,label]of SECTIONS){
  if(!data.sections[key]?.trim())continue;
  const line=$('div','npc-info-line');
  line.append($('strong',null,label+' :'),$('span',null,data.sections[key]));info.append(line);
 }
 if(info.children.length)panel.append(info);
 const monitors=$('div','npc-monitors');
 monitors.append(track(node.id,'physical','Physique',data.condition.physical),track(node.id,'stun','Étourdissement',data.condition.stun));panel.append(monitors);
 return panel;
}
window.ArchivesNpcSheet={normalize:normalizeNpcSheet,renderNpcPanel,openNpcEditor};
window.dispatchEvent?.(new Event('archives:npc-sheet-ready'));
