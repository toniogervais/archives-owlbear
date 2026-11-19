import {normalize} from './model.mjs?v=122';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function headingPattern(title){
 const words=String(title).trim().replace(/\s*\([IL]\)$/i,'').split(/\s+/).filter(Boolean).map(escape);
 return new RegExp('(?:^|\\n)[ \\t]*'+words.join('\\s+')+'(?:\\s*\\([IL]\\))?[ \\t]*(?:\\n|$)','giu');
}
const comparable=s=>normalize(s).replace(/\s*\([il]\)$/,'');
export function sectionExcerpt(entry,book,index){
 if(!book?.pages)return null;
 const wanted=comparable(entry.originalTitle||entry.title||entry.name);
 let ref=index.find(e=>e.id===entry.id)||index.find(e=>(entry.referenceIds||[]).includes(e.id));
 if(!ref)ref=index.find(e=>e.source===entry.source&&comparable(e.originalTitle||e.title)===wanted&&Math.abs(e.page-entry.page)<=5);
 let page=ref?.page||entry.page;
 const heading=ref?.originalTitle||ref?.title||entry.originalTitle||entry.title||entry.name;
 let pattern=headingPattern(heading);
 let match=pattern.exec(book.pages[page-1]?.text||'');
 if(!match&&!ref){
  // Some gear is indexed only in a recap table. Prefer its real description,
  // if its own heading can be found elsewhere in this same local book.
  const candidates=[];
  for(const p of book.pages){if(p.number<8)continue;pattern.lastIndex=0;const m=pattern.exec(p.text);if(m)candidates.push({page:p.number,match:m});}
  const best=candidates.sort((a,b)=>Math.abs(a.page-entry.page)-Math.abs(b.page-entry.page))[0];
  if(best){page=best.page;match=best.match;}
 }
 const last=Math.min(ref?.endPage||page+1,page+32,book.pageCount);
 const text=book.pages.slice(page-1,last).map(p=>p.text).join('\n');
 if(!match){pattern.lastIndex=0;match=pattern.exec(text);}
 if(!match)return null;
 const start=match.index+match[0].length;let end=text.length;
 for(const other of index){
  if(other.source!==entry.source||other.id===ref?.id||other.page<page||other.page>last||ref&&other.level>ref.level)continue;
  const re=headingPattern(other.originalTitle||other.title);re.lastIndex=start;const next=re.exec(text);
  if(next&&next.index<end)end=next.index;
 }
 const body=text.slice(start,end).trim();if(body.length<30)return null;
 return {title:heading,text:body,page,endPage:last};
}
