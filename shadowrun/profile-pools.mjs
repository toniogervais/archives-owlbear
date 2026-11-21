import {normalize} from './model.mjs?v=138';

// Compétences actives : Shadowrun Sixième Édition, « Compétences » (p. 98–105).
// Les attributs secondaires ne remplacent l'attribut principal que pour l'action indiquée.
export const SKILLS=[
 ['Armes à feu','AGI',99,'Combat','Attaques avec armes à feu.','Défense : Réaction + Intuition.'],
 ['Armes exotiques','AGI',100,'Combat','Utiliser les armes exotiques, selon le type.','Défense : Réaction + Intuition.'],
 ['Astral','INT',100,'Magie','Perception et lecture de signatures astrales.','',{attr:'VOL',when:'Combat astral'}],
 ['Athlétisme','AGI',100,'Physique','Archerie, escalade, lancer, saut, sprint, natation, vol.','',{attr:'FOR',when:'Effort contre une résistance'}],
 ['Biotech','LOG',101,'Soins','Biotechnologie, cybertechnologie, médecine, premiers soins.','',{attr:'INT',when:'Situations atypiques'}],
 ['Combat rapproché','AGI',102,'Combat','Attaques de mêlée et à mains nues.','Défense : Réaction + Intuition.'],
 ['Conjuration','MAG',102,'Magie','Invocation et bannissement des esprits. Vérifier le Drain.'],
 ['Électronique','LOG',102,'Matrice','Utilisation légale de la Matrice, informatique, électronique.','',{attr:'INT',when:'Bidouillage'}],
 ['Enchantement','MAG',102,'Magie','Alchimie, création d’artefacts, désenchantement.'],
 ['Escroquerie','CHA',102,'Social','Comédie, déguisement, imposture, représentation.','Résistance : Intuition + Volonté.'],
 ['Furtivité','AGI',102,'Physique','Camouflage, discrétion et escamotage.','Détection : Perception + Intuition.'],
 ['Influence','CHA',103,'Social','Étiquette, enseignement, intimidation, leadership et négociation.','Résistance : Volonté + Intuition (ou Volonté + Logique pour un argument logique).',{attr:'LOG',when:'Argument logique'}],
 ['Ingénierie','LOG',103,'Technique','Armurerie, mécanique, fabrication, réparation, bricolage, crochetage.','',{attr:'INT',when:'Bricolage'},{attr:'AGI',when:'Crochetage'}],
 ['Perception','INT',103,'Enquête','Observer et déceler un détail, une présence ou des indices.','Opposition : Furtivité + Agilité.',{attr:'LOG',when:'Repérer des schémas et formes'}],
 ['Pilotage','RÉA',104,'Rigging','Conduite, manœuvres et poursuites.','Poursuite : Pilotage + Réaction contre Pilotage + Réaction.'],
 ['Piratage','LOG',104,'Matrice','Actions matricielles illégales : cybercombat, hacking, guerre électronique.'],
 ['Plein air','INT',104,'Exploration','Orientation, pistage et survie.'],
 ['Sorcellerie','MAG',105,'Magie','Sorts, contresorts et magie rituelle. Vérifier les tests de Drain.'],
 ['Technomancie','RÉS',105,'Matrice','Compilation, décompilation et inscription.']
].map(([name,attr,page,group,use,opposition,...alternate])=>({name,attr,page,group,use,opposition,alternate}));

const UNTRAINED=new Set(['Armes à feu','Athlétisme','Combat rapproché','Électronique','Escroquerie','Furtivité','Influence','Ingénierie','Perception','Pilotage','Plein air']);
export const ATTRIBUTE_NAMES={CON:'Constitution',AGI:'Agilité','RÉA':'Réaction',FOR:'Force',VOL:'Volonté',LOG:'Logique',INT:'Intuition',CHA:'Charisme',MAG:'Magie','RÉS':'Résonance'};
const byName=new Map(SKILLS.map(s=>[normalize(s.name),s]));
const names=SKILLS.map(s=>s.name).sort((a,b)=>b.length-a.length).join('|');
const pattern=new RegExp('(?:^|[,;]\\s*|\\s+)('+names+'|Lancement de sorts)(?:\\s*\\(([^)]+)\\))?\\s+(\\d{1,2})(?:\\s*\\((\\d{1,2})\\))?(?:\\s*\\(([^)]+)\\))?','giu');
const num=x=>/^\d+$/.test(String(x??'').trim())?Number(x):null;
const attrValue=(profile,key)=>{
 const raw=String(profile.attributes?.[key]??'').trim();
 const matched=/^(\d+)(?:\s*\((\d+)\))?$/.exec(raw);
 return {raw,value:matched?Number(matched[1]):null,alternative:matched?.[2]?Number(matched[2]):null};
};
export function parseProfileSkills(value=''){
 const rows=[],seen=new Set();pattern.lastIndex=0;let m;
 while((m=pattern.exec(String(value)))){
  const name=m[1],def=byName.get(normalize(name==='Lancement de sorts'?'Sorcellerie':name));
  if(!def)continue;
  const embedded=m[2],rank=Number(m[3]),alternateRank=m[4]?Number(m[4]):null;
  const specializations=String(m[5]||'').split(/\s*[,;]\s*/).map(x=>/^(.+?)\s*\+\s*([23])\s*$/.exec(x)).filter(Boolean).map(x=>({name:x[1].trim(),bonus:Number(x[2])}));
  const specialty=specializations[0]?.name||'',bonus=specializations[0]?.bonus||0;
  const label=embedded&&!/^\d+$/.test(embedded)?name+' ('+embedded.trim()+')':name;
  const key=normalize(label)+'|'+rank+'|'+specializations.map(x=>normalize(x.name)).join('|');
  if(seen.has(key))continue;
  seen.add(key);rows.push({name:label,rank,alternateRank,specialty,bonus,specializations,definition:def});
 }
 return rows;
}
export function profileSkillPools(profile){
 const text=String(profile?.sections?.Compétences||'');
 const fixed=/\bchoisir\b/i.test(text)?text.split(/\s*;\s*choisir\b/i)[0]:text;
 return parseProfileSkills(fixed).map(s=>{
  const a=attrValue(profile,s.definition.attr);
  const total=a.value===null?null:a.value+s.rank;
  const contextual=s.definition.alternate.map(c=>{
   const v=attrValue(profile,c.attr);
   return {attr:c.attr,when:c.when,attributeValue:v.value,total:v.value===null?null:s.rank+v.value};
  });
  return {name:s.name,rank:s.rank,attr:s.definition.attr,attrName:ATTRIBUTE_NAMES[s.definition.attr],
   attributeValue:a.value,rawAttribute:a.raw,total,alternateAttributeTotal:a.alternative===null?null:s.rank+a.alternative,
   specialty:s.specialty,bonus:s.bonus,specialtyTotal:total===null||!s.bonus?null:total+s.bonus,
   specializations:s.specializations.map(x=>({...x,total:total===null?null:total+x.bonus})),
   alternateRank:s.alternateRank,alternateRankTotal:s.alternateRank===null||a.value===null?null:s.alternateRank+a.value,
   contextual};
 });
}
// Certains contacts indiquent des compétences EXCLUSIVES AU CHOIX, pas toutes simultanément.
export function profileChoicePools(profile){
 const s=String(profile?.sections?.Compétences||'');
 if(!/\bchoisir\b/i.test(s))return [];
 const sets=[];
 if(/choisir une compétence au rang 5/i.test(s)){
  const candidates=['Astral','Escroquerie','Biotech','Électronique','Ingénierie'];
  const choices=candidates.map(name=>{
   const row=profileSkillPools({...profile,sections:{...profile.sections,Compétences:name+' 5'}})[0];
   return {...row,choiceSpecialization:row?.total===null?null:row.total+2};
  }).filter(Boolean);
  sets.push({title:'Choisir une seule compétence parmi les propositions (rang 5)',rows:choices,disclaimer:'Choisir également une spécialisation pour cette compétence ; bonus conditionnel de 2 D6.'});
 }else if(/choisir un ensemble/i.test(s)){
  const groups=[
   ['Combattant','Combat rapproché 3, Armes à feu 3'],
   ['Technicien et pilote','Ingénierie 3, Pilotage 3'],
   ['Spécialiste matriciel','Piratage 3, Électronique 3'],
   ['Pratiquant de la magie','Astral 3, Conjuration 3, Sorcellerie 3']
  ];
  for(const [title,skills] of groups){
   const rows=profileSkillPools({...profile,sections:{...profile.sections,Compétences:skills}});
   sets.push({title,rows,disclaimer: title==='Pratiquant de la magie'?'Les scores de Magie ne figurent pas dans ce profil générique : aucun pool magique n’est inventé.':''});
  }
 }
 return sets;
}
export function skillGuideEntries(){
 return SKILLS.map((s,i)=>({
  id:'skill:core:'+i,source:'core',page:s.page+2,printedPage:s.page,title:s.name,kind:'skillguide',topic:'competences',
  path:['Compétences',s.group],
  tags:['jets de dés','D6','pool','réserve de dés',ATTRIBUTE_NAMES[s.attr],s.name,s.group],
  summary:s.use,
  procedure:{test:s.name+' + '+ATTRIBUTE_NAMES[s.attr],...(s.opposition?{opposition:s.opposition}:{})},
  fields:[
   {label:'Attribut principal',value:ATTRIBUTE_NAMES[s.attr]+' ('+s.attr+')'},
   {label:'Sans rang dans cette compétence',value:UNTRAINED.has(s.name)?'Test possible avec l’attribut associé −1 D6, sous réserve des autres modificateurs.':'Impossible de tenter le test en étant Inexpérimenté.'},
   {label:'Réserve de base',value:s.name+' + '+s.attr},
   ...s.alternate.map(a=>({label:'Attribut secondaire : '+a.when,value:ATTRIBUTE_NAMES[a.attr]+' ('+a.attr+')'})),
   {label:'Spécialisation / maîtrise',value:'+2 D6 si applicable ; +3 D6 avec une maîtrise. Un seul bonus de ce type par test.'},
   {label:'Source',value:'Livre de base, compétences p. '+s.page}
  ]
 }));
}
