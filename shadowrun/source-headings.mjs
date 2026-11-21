// Métadonnées de titres extraites localement du PDF personnel. Le dépôt public
// ne contient ni les paragraphes ni les illustrations des livres.
const clean=s=>String(s??'').trim().replace(/\s+/g,' ');
const key=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'‐‑–—]/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const headingLike=s=>s.length>=3&&s.length<=100&&/[\p{L}]/u.test(s)&&
 !/^(?:shadowrun\b|\d+$|table des mati[eè]res|pdf\s+\d+)/i.test(s)&&
 !/\s*\/\/\s*/.test(s)&&!s.includes('@');
export function extractHeadingLines(rows){
 const valid=(rows||[]).map(row=>({text:clean(row.text),size:Number(row.size)})).filter(row=>row.text&&Number.isFinite(row.size)&&row.size>1);
 if(!valid.length)return [];
 const counts=new Map();
 for(const row of valid){const size=Math.round(row.size*2)/2;counts.set(size,(counts.get(size)||0)+Math.min(140,row.text.length));}
 const body=[...counts].filter(([size])=>size>=7&&size<=12).sort((a,b)=>b[1]-a[1])[0]?.[0]??9.5;
 const threshold=Math.max(12.5,body+2.2);
 const result=[];
 for(const row of valid){
  if(row.size<threshold||!headingLike(row.text))continue;
  result.push({text:row.text,size:Math.round(row.size*10)/10});
 }
 return result;
}
const escape=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
function headingPattern(title){
 const words=String(title||'').trim().split(/\s+/).filter(Boolean).map(escape);
 return words.length?new RegExp('(?:^|\\n)[ \\t]*'+words.join('\\s+')+'[ \\t]*(?=\\n|$)','giu'):null;
}
const nested=(part,whole)=>{const a=key(part),b=key(whole);return !!a&&!!b&&(a===b||b.includes(a));};
function headingSize(headings,names){
 for(const name of names){const exact=(headings||[]).find(h=>key(h.text)===key(name));if(exact)return exact.size;}
 for(const name of names){const partial=(headings||[]).find(h=>key(h.text).length>=4&&nested(h.text,name));if(partial)return partial.size;}
 return null;
}
// Borne du prochain titre d'un rang typographique égal ou supérieur.
// Sans titre propre identifié, ne devine pas une limite dans le texte courant.
export function printedHeadingBoundary(raw,headsByPage,names,offset=0){
 if(!raw||!Array.isArray(headsByPage)||!headsByPage.length)return null;
 const currentNames=(names||[]).filter(Boolean);
 const ownSize=headingSize(headsByPage.flat(),currentNames);
 if(ownSize===null)return null;
 let end=raw.length;
 for(const heads of headsByPage){
  for(const h of heads||[]){
   if(!h?.text||!Number.isFinite(h.size)||h.size+0.4<ownSize)continue;
   if(currentNames.some(name=>nested(h.text,name)))continue;
   const re=headingPattern(h.text);if(!re)continue;
   re.lastIndex=offset;
   const found=re.exec(raw);
   if(found&&found.index<end)end=found.index;
  }
 }
 return end<raw.length?end:null;
}
