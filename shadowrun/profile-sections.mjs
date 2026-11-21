// Découper les détails déjà présents dans chaque fiche sans perdre les données sources.
// Ne jamais scinder à l'intérieur d'une parenthèse ou des caractéristiques d'une arme.
export function splitOutside(text,delimiters=',;') {
 const items=[];let current='',round=0,square=0;
 for(const char of String(text??'')){
  if(char==='(')round++;
  else if(char===')')round=Math.max(0,round-1);
  else if(char==='[')square++;
  else if(char===']')square=Math.max(0,square-1);
  if(delimiters.includes(char)&&round===0&&square===0){
   if(current.trim())items.push(current.trim());
   current='';
  }else current+=char;
 }
 if(current.trim())items.push(current.trim());
 return items;
}
function weapons(value){
 const matches=String(value||'').match(/[^\]]*\][ \t]*/g)||[];
 const taken=matches.join('');
 const tail=String(value||'').slice(taken.length).trim();
 return [...matches.map(s=>s.trim()),...(tail?[tail]:[])].filter(Boolean);
}
const LABELS={
 'Sorts':'Sort', 'Pouvoirs':'Pouvoir', 'Pouvoir optionnel':'Pouvoir optionnel', 'Pouvoirs d’adepte':'Pouvoir d’adepte', 'Métamagies':'Métamagie', 'Échos':'Écho',
 'Pouvoirs optionnels':'Pouvoir optionnel', 'Traits':'Trait',
 'Augmentations':'Augmentation', 'Équipement':'Équipement',
 'Connaissances':'Connaissance','Faiblesse':'Faiblesse',
 'Faiblesses':'Faiblesse','Armes':'Arme','Pouvoir d’adepte':'Pouvoir d’adepte','Métamagie':'Métamagie'
};
export function profileSectionRows(sections={},omitSkill=false){
 const rows=[];
 for(const [name,value] of Object.entries(sections)){
  if(value===undefined||value===null||!String(value).trim())continue;
  if(name==='Compétences'&&omitSkill)continue;
  const singular=LABELS[name];
  const parsed=name==='Armes'?weapons(value):singular?splitOutside(value,name==='Connaissances'?',;':','):[String(value)];
  for(const [index,text] of parsed.entries())rows.push({label:singular?singular+' '+(index+1):name,value:text});
 }
 return rows;
}
