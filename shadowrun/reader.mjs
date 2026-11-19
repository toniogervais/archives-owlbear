// Locate an actual heading on its source pages. If it cannot be located
// unambiguously, retain the complete page instead of inventing an excerpt.
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function headingPattern(title){
 const words=String(title).trim().split(/\s+/).filter(Boolean).map(escape);
 return new RegExp('(?:^|\\n)[ \\t]*'+words.join('\\s+')+'[ \\t]*(?:\\n|$)','giu');
}
export function sectionExcerpt(entry,book,index){
 if(!book?.pages)return null;
 const ref=index.find(e=>e.id===entry.id)||index.find(e=>(entry.referenceIds||[]).includes(e.id));
 if(!ref)return null;
 const last=Math.min(ref.endPage||ref.page,ref.page+5,book.pageCount);
 const text=book.pages.slice(ref.page-1,last).map(p=>p.text).join('\n');
 const heading=ref.originalTitle||ref.title;
 const pattern=headingPattern(heading);const match=pattern.exec(text);
 if(!match)return null;
 const start=match.index+match[0].length;let end=text.length;
 for(const other of index){
  if(other.source!==ref.source||other.id===ref.id||other.page<ref.page||other.page>last||other.level>ref.level)continue;
  const re=headingPattern(other.originalTitle||other.title);re.lastIndex=start;const next=re.exec(text);
  if(next&&next.index<end)end=next.index;
 }
 const body=text.slice(start,end).trim();if(body.length<30)return null;
 return {title:heading,text:body,page:ref.page,endPage:last};
}
