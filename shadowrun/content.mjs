import {normalize} from './model.mjs?v=138';

const key=e=>normalize(e.originalTitle||e.title||e.name).replace(/\s*\([il]\)\s*$/,'');
export function assembleEntries({rules,profiles,equipment,index}){
 const replacements=new Map();
 for(const r of rules)for(const id of r.referenceIds||[])replacements.set(id,r.id);
 const entries=[...rules,...profiles,...equipment.map(e=>({...e,title:e.name,kind:'equipment',topic:'equipement'}))];
 const byName=new Map();
 for(const e of entries){const k=e.source+':'+key(e);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(e);}
 const seenIndex=new Map();
 const compatible=(ref,e)=>{
  if(e.kind==='equipment')return ref.topic==='equipement';
  if(e.kind==='npc')return ref.topic==='pnj'||ref.topic==='mj';
  if(e.kind==='creature')return ref.topic==='creatures';
  return !['equipement','creatures','pnj'].includes(ref.topic);
 };
 for(const ref of index){
  // Same name in another chapter is intentional; only identical index locations are duplicates.
  const signature=[ref.source,key(ref),ref.page,ref.level,(ref.path||[]).map(normalize).join('/')].join('|');
  if(seenIndex.has(signature)){replacements.set(ref.id,seenIndex.get(signature));continue;}
  if(replacements.has(ref.id)){seenIndex.set(signature,replacements.get(ref.id));continue;}
  if(ref.isStructural){entries.push({...ref,kind:'rule',sourceOnly:true});seenIndex.set(signature,ref.id);continue;}
  const matches=(byName.get(ref.source+':'+key(ref))||[]).filter(e=>
   compatible(ref,e)&&Math.min(Math.abs(e.page-ref.page),Math.abs((e.descriptionPage||e.page)-ref.page))<=1
  );
  if(matches.length===1){replacements.set(ref.id,matches[0].id);seenIndex.set(signature,matches[0].id);continue;}
  const near=profiles.filter(p=>p.source===ref.source&&Math.abs(p.page-ref.page)<=1&&(key(p).includes(key(ref))||key(ref).includes(key(p))));
  entries.push({...ref,kind:ref.kind||'rule',linkedProfiles:near.map(p=>p.id),sourceOnly:true});
  seenIndex.set(signature,ref.id);
 }
 return {entries,replacements};
}

function cleanParagraphs(text){
 return String(text).replace(/\r/g,'').replace(/([\p{L}])-\n(?=[\p{L}])/gu,'$1').split(/\n\s*\n/).map(p=>p.replace(/\s+/g,' ').trim()).filter(p=>p.length>45&&!/^(?:SHADOWRUN|\d+\s*$|EXEMPLE\b)/i.test(p));
}
// These are extracts from the user's local book, not generated rule claims.
// Keep them separate from authored French summaries and never publish them.
export function localKeyPoints(text,language='fr'){
 if(language!=='fr')return [];
 const paragraphs=cleanParagraphs(text),candidates=[];
 for(const p of paragraphs){
  for(const sentence of p.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[]){
   const s=sentence.trim();if(s.length<45||s.length>600)continue;
   const score=(/\btest\b|\bjet\b|\bsuccès\b|\bseuil\b|\bréserve\b/i.test(s)?4:0)+(s.includes('+')?3:0)+(/\d/.test(s)?2:0)+(/\baction\b|\bbonus\b|\bmalus\b|\bdommages\b/i.test(s)?2:0)-(/\bexemple\b|\bvoir p\.|\breportez/i.test(s)?4:0);
   candidates.push({text:s,score,order:candidates.length});
  }
 }
 let selected=candidates.filter(x=>x.score>=2).sort((a,b)=>b.score-a.score||a.order-b.order).slice(0,4);
 if(!selected.length)selected=candidates.slice(0,2);
 return selected.sort((a,b)=>a.order-b.order).map(x=>x.text);
}

export function suggestedRules(entry,rules){
 if(entry.kind!=='equipment')return [];
 const n=normalize([entry.name,entry.category,...(entry.path||[])].join(' '));let wanted=[];
 if(/medikit|premiers soins/.test(n))wanted=['Administrer les premiers soins','Soigner avec un médikit'];
 else if(/munitions|armes a feu|pistolet|fusil|mitraill|shotgun|taser/.test(n))wanted=['Tirer avec une arme à feu','Choisir un mode de tir','Recharger une arme sans smartlink'];
 else if(/armes de melee|couteau|epee|matraque/.test(n))wanted=['Frapper au corps à corps','Bloquer une attaque de mêlée'];
 else if(/cyberdeck|cyberjack|commlink|programme/.test(n))wanted=['Hacker','Percevoir la Matrice','Forcer l’accès','Sonder l’accès'];
 else if(/escalade|grappin/.test(n))wanted=['Escalader un mur'];
 else if(/drone|vehicule|voiture|moto/.test(n))wanted=['Donner un ordre à un drone','Piloter dans une situation difficile','Course-poursuite : procédure'];
 else if(/armure|casque|bouclier/.test(n))wanted=['Armure, SO et SD','Se mettre à couvert'];
 return rules.filter(r=>wanted.includes(r.title)).map(r=>r.id);
}

export const SITUATIONS=[
 {label:'Tirer sur une cible',title:'Tirer avec une arme à feu',group:'Combat'},
 {label:'Se défendre',title:'Esquiver une attaque',group:'Combat'},
 {label:'Frapper au contact',title:'Frapper au corps à corps',group:'Combat'},
 {label:'Recharger',title:'Recharger une arme sans smartlink',group:'Combat'},
 {label:'Soigner un blessé',title:'Administrer les premiers soins',group:'Soins'},
 {label:'Utiliser un médikit',title:'Soigner avec un médikit',group:'Soins'},
 {label:'Passer discrètement',title:'Se déplacer sans être repéré',group:'Infiltration'},
 {label:'Crocheter une serrure',title:'Crocheter une serrure',group:'Infiltration'},
 {label:'Repérer un indice',title:'Remarquer un détail',group:'Infiltration'},
 {label:'Négocier ou intimider',title:'Négocier, intimider ou convaincre',group:'Social'},
 {label:'Lancer un sort',title:'Lancer un sort',group:'Magie'},
 {label:'Invoquer un esprit',title:'Invoquer un esprit',group:'Magie'},
 {label:'Pirater rapidement',title:'Forcer l’accès',group:'Matrice'},
 {label:'Pirater discrètement',title:'Sonder l’accès',group:'Matrice'},
 {label:'Commander un drone',title:'Donner un ordre à un drone',group:'Rigging'},
 {label:'Poursuivre un véhicule',title:'Course-poursuite : procédure',group:'Rigging'}
];
