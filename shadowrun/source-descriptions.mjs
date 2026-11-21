// Descriptions extractives locales : les livres et leurs extraits restent
// sur la table privée de l'utilisateur ou dans sa bibliothèque importée.
// Aucune phrase du livre n'est enregistrée dans les fichiers publics GitHub.
const BAD=/^(?:shadowrun\b|\s*\d+\s*$|\w+\s*\/\/\s*\w+|illustration|table des matières|page\s*\d+|\w+@\w+\.\w+)/i;
const normalizeBreaks=t=>String(t||'')
 .replace(/\r/g,'')
 .replace(/([\p{L}])-\s*\n\s*(?=[\p{L}])/gu,'$1')
 .replace(/[\u00ad\u200b]/g,'')
 .replace(/([^\n])\n(?!\n)/g,'$1 ')
 .replace(/\s+/g,' ').trim();
const extractSentences=text=>normalizeBreaks(text).split(/(?<=[.!?])\s+(?=[«"“\p{Lu}0-9])/u)
 .map(s=>s.trim()).filter(s=>s.length>45&&s.length<700&&!BAD.test(s));
const cut=(text,n)=>text.length>n?text.slice(0,n).replace(/\s+\S*$/,'').trim()+'…':text;
export function conciseSourceDescription(passage,language='fr'){
 if(!passage?.text||language!=='fr')return null;
 const raw=passage.text;
 // Choose the first coherent statements from the exact section instead of
 // extrapolating rules from the heading or a neighbouring section.
 const sentences=extractSentences(raw),selected=[];
 for(const sentence of sentences){
  if(selected.join(' ').length>425)break;
  if(!selected.length||selected.join(' ').length<260)selected.push(sentence);
  if(selected.length>=3)break;
 }
 if(!selected.length){
  const clean=normalizeBreaks(raw);
  if(clean.length<65)return null;
  return {text:cut(clean,390),extractive:true};
 }
 return {text:cut(selected.join(' '),510),extractive:true};
}
export function sourceContext(entry,book,passage){
 const pages=[];
 const push=p=>{if(Number.isInteger(p)&&p>=1&&p<=book?.pages?.length&&!pages.includes(p))pages.push(p);};
 push(passage?.page);
 push(passage?.endPage);
 push(entry.descriptionPage||entry.page);
 push(entry.endPage);
 return {
  book:book?.displayTitle||book?.title||entry.source,
  firstPage:passage?.page||entry.descriptionPage||entry.page,
  endPage:passage?.fullEndPage||entry.endPage||passage?.endPage||entry.page,
  indexPath:(entry.path||[]).filter(Boolean),
  found:Boolean(passage),
  exact:Boolean(passage&&['exact-heading','heading-and-anchor','exact-id-anchor'].includes(passage.matchedBy)),
  availablePages:pages
 };
}
