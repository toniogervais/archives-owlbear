export const VERSION='1.2.2';
export const NAMESPACE='fr.archives-imaginaire.shadowrun';
export const TAB_LABELS={combat:'Combat',magie:'Magie',rigging:'Rigging',matrice:'Matrice',equipement:'Équipement',livres:'Livres',favoris:'Favoris',mj:'PNJ'};
export function normalize(text){return String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[’'‐‑–—]/g,' ').replace(/\s+/g,' ').trim();}
export function matches(text,query){const hay=normalize(text);return normalize(query).split(' ').filter(Boolean).every(word=>hay.includes(word));}
export function equipmentText(item){return [item.name,item.category,item.source,...(item.path||[]),...(item.fields||[]).flatMap(f=>[f.label,f.value])].join(' ');}
export function pageLabel(book,page){const printed=page-(book?.printedOffset??2);return printed>0?`p. ${printed} · PDF ${page}`:`PDF ${page}`;}
export function validateLibrary(input){
 if(!input||input.schema!=='fr.archives-imaginaire.sr6.library'||![1,2].includes(input.version)||!Array.isArray(input.books)||!(input.partial===true?input.books.length>=1&&input.books.length<=6:[5,6].includes(input.books.length)))throw Error('Ce fichier n’est pas une bibliothèque Shadowrun compatible.');
 const expected={core:322,feu:154,companion:210,rigger:186,hacker:186,wild:194};const seen=new Set();let total=0;
 for(const book of input.books){
  if(!book||seen.has(book.id)||expected[book.id]!==book.pageCount||!Array.isArray(book.pages)||book.pages.length!==book.pageCount)throw Error('Le nombre de pages d’un livre est incorrect.');
  seen.add(book.id);
  for(let i=0;i<book.pages.length;i++){
   const p=book.pages[i];if(!p||p.number!==i+1||typeof p.text!=='string'||p.text.length>120000||typeof p.layout!=='string'||p.layout.length>150000)throw Error('Une page du fichier est invalide.');total++;
  }
 }
 if(!input.partial){
  for(const id of ['core','feu','companion','rigger','hacker'])if(!seen.has(id))throw Error('Un ouvrage est absent de la bibliothèque.');
  if(total!==(seen.has('wild')?1252:1058))throw Error('Le nombre total de pages est incorrect.');
 }
 return input;
}
export function parseLibraryText(text){
 if(typeof text!=='string')throw Error('Le fichier de bibliothèque est invalide.');
 let json=text.trim();
 if(json.startsWith('<')){
  // Read the embedded JSON only; importing the standalone reader must never
  // execute its scripts or insert its HTML into the extension's document.
  const match=/<script\b[^>]*\bid\s*=\s*["']sr6-library["'][^>]*>([\s\S]*?)<\/script\s*>/i.exec(json);
  if(!match)throw Error('Ce fichier HTML ne contient pas de bibliothèque Shadowrun.');
  json=match[1];
 }
 return validateLibrary(JSON.parse(json));
}
export async function parseLibraryFileText(text){
 try{return parseLibraryText(text);}catch(error){
  if(typeof text!=='string'||!text.trim().startsWith('<'))throw error;
 }
 const script=id=>new RegExp('<script\\b[^>]*\\bid\\s*=\\s*["\']'+id+'["\'][^>]*>([\\s\\S]*?)<\\/script\\s*>','i').exec(text)?.[1];
 let data;
 const packed=script('sr6-packed');
 if(packed){
  if(typeof DecompressionStream==='undefined')throw Error('Ce navigateur ne peut pas lire ce fichier compressé. Utilise le PDF ou le fichier JSON.');
  const bytes=Uint8Array.from(atob(packed.trim()),c=>c.charCodeAt(0));
  const expanded=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  if(expanded.length>60*1024*1024)throw Error('Le contenu du fichier dépasse 60 Mo.');
  data=JSON.parse(expanded);
 }else{
  const json=script('data');if(!json)throw Error('Ce fichier HTML ne contient pas de bibliothèque compatible.');data=JSON.parse(json);
 }
 return validateLibrary({schema:'fr.archives-imaginaire.sr6.library',version:2,books:data.books});
}
export function rollResult(values,wildValue=null){
 if(!Array.isArray(values)||!values.length||values.some(v=>!Number.isInteger(v)||v<1||v>6))throw Error('Le jet doit contenir des dés à six faces.');
 if(wildValue!==null&&(!Number.isInteger(wildValue)||wildValue<1||wildValue>6))throw Error('Dé libre invalide.');
 // The wild die replaces an ordinary die: callers pass only the remaining ordinary dice.
 const all=wildValue===null?values:[...values,wildValue];
 let hits=values.filter(v=>v>=5).length;
 if(wildValue!==null){if(wildValue>=5)hits+=3;else if(wildValue===1)hits=values.filter(v=>v===6).length;}
 const ones=all.filter(v=>v===1).length;const glitch=ones>all.length/2;
 return {hits,ones,glitch,critical:glitch&&hits===0,total:all.length,values,wildValue};
}
export function randomD6(){const a=new Uint8Array(1);do{crypto.getRandomValues(a);}while(a[0]>=252);return a[0]%6+1;}
export function quantity(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>999)throw Error('La quantité doit être un entier de 1 à 999.');return n;}
export function literalPrice(item){const f=item.fields?.find(f=>/^(cout|cost)$/.test(normalize(f.label)));if(!f)return null;const s=f.value.replace(/[\s\u00a0\u202f]/g,'');return /^\d+(?:[.,]\d+)?¥$/.test(s)?Number(s.replace('¥','').replace(',','.')):null;}
export function safeCart(cart,equipment){
 if(!Array.isArray(cart)||cart.length>150)throw Error('Le panier est invalide ou dépasse 150 références.');
 const byId=new Map(equipment.map(e=>[e.id,e]));const out=[];const seen=new Set();
 for(const line of cart){const item=byId.get(line.id);if(!item||seen.has(line.id))throw Error('Une référence du panier est inconnue ou dupliquée.');seen.add(line.id);out.push({id:item.id,quantity:quantity(line.quantity)});}
 if(!out.length)throw Error('Ajoute du matériel au panier.');return out;
}
export function inventoryText(lines,equipment){const lookup=new Map(equipment.map(e=>[e.id,e]));return lines.map(line=>{const e=lookup.get(line.id);if(!e)return '';const vals=e.fields?.filter(f=>['vd','modes','mode','scores offensifs','so','score defensif','sd','essence'].includes(normalize(f.label))).map(f=>`${f.label} ${f.value}`).join(' ; ');return `${line.quantity} × ${e.name}${line.rating?' (indice '+line.rating+')':''}${vals?' — '+vals:''} [${e.source} p. ${e.printedPage}]`;}).filter(Boolean).join('\n');}
export function mergeInventory(previous,cart){
 const result=(previous||[]).map(x=>({...x}));
 for(const line of cart){const found=result.find(x=>x.id===line.id);if(found){found.quantity=quantity(found.quantity+line.quantity);}else result.push({...line});}
 if(result.length>200)throw Error('Cet inventaire dépasse 200 références.');return result;
}
export function updateNpcSheetRecord(record,inventory,equipment){
 if(!record||record.kind!=='TOKEN')throw Error('La fiche privée de ce PNJ est indisponible.');
 const next=structuredClone(record);next.npcSheet??={};next.npcSheet.sections??={};
 const title='[Équipement Shadowrun]';const existing=String(next.npcSheet.sections.equipement||'');
 const at=existing.indexOf(title);const prefix=(at>=0?existing.slice(0,at):existing).trimEnd();
 const body=inventoryText(inventory,equipment);
 const text=[prefix,body?title+'\n'+body:''].filter(Boolean).join('\n\n');
 if(text.length>12000)throw Error('L’équipement dépasse la capacité de la fiche Archives. Réduis le nombre de références.');
 next.npcSheet.sections.equipement=text;next.sr6Inventory=inventory;next.sr6UpdatedAt=new Date().toISOString();return next;
}
