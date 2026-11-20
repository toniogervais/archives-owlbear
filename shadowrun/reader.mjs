import {normalize} from './model.mjs?v=132';

const escape=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
const comparable=s=>normalize(s).replace(/\s*\([il]\)$/,'');
function headingPattern(title){
 const words=String(title||'').trim().replace(/\s*\([IL]\)$/i,'').split(/\s+/).filter(Boolean).map(escape);
 if(!words.length)return null;
 // A heading occupies its own line. A reference in a table or paragraph is not a heading.
 return new RegExp('(?:^|\\n)[ \\t]*'+words.join('\\s+')+'(?:\\s*\\([IL]\\))?[ \\t]*(?=\\n|$)','giu');
}
function firstHeading(text,titles){
 for(const title of titles){const re=headingPattern(title);if(!re)continue;const hit=re.exec(text);if(hit)return {hit,title};}
 return null;
}
function distinct(values){return [...new Set(values.filter(Boolean))];}
function sectionReference(entry,index){
 const wanted=comparable(entry.originalTitle||entry.title||entry.name),page=entry.descriptionPage||entry.page;
 const exact=index.find(e=>e.id===entry.id);
 if(exact)return exact;
 const linked=index.find(e=>(entry.referenceIds||[]).includes(e.id));
 if(linked)return linked;
 return index.filter(e=>e.source===entry.source&&comparable(e.originalTitle||e.title)===wanted&&e.page===page)
  .sort((a,b)=>Math.abs(a.page-page)-Math.abs(b.page-page))[0]||null;
}
function limitByHeadings(raw,offset,entry,ref,index,first,last){
 let end=raw.length;
 for(const other of index){
  if(other.source!==entry.source||other.id===ref?.id||other.page<first||other.page>last)continue;
  if(ref&&Number.isFinite(ref.level)&&Number.isFinite(other.level)&&other.level>ref.level)continue;
  if(comparable(other.originalTitle||other.title)===comparable(ref?.originalTitle||ref?.title||entry.originalTitle||entry.title||entry.name))continue;
  const re=headingPattern(other.originalTitle||other.title);if(!re)continue;
  re.lastIndex=offset;const hit=re.exec(raw);
  if(hit&&hit.index<end)end=hit.index;
 }
 return end;
}
function getExcerpt(raw,headingTitles,entry,ref,index,first,last,truncated){
 const found=firstHeading(raw,headingTitles);
 if(!found)return null;
 const start=found.hit.index+found.hit[0].length;
 const end=limitByHeadings(raw,start,entry,ref,index,first,last);
 const text=raw.slice(start,end).trim();
 if(text.length<25)return null;
 return {title:found.title,text,page:first,endPage:last,truncated};
}
export function sectionExcerpt(entry,book,index=[]){
 if(!book?.pages?.length||!entry||!Array.isArray(index))return null;
 const ref=sectionReference(entry,index);
 const headings=distinct([ref?.originalTitle,ref?.title,entry.originalTitle,entry.title,entry.name]);
 const anchor=ref&&book.anchors?.[ref.id];
 if(Array.isArray(anchor)&&anchor.length===4){
  const [first,at,final,end]=anchor;
  if(Number.isInteger(first)&&Number.isInteger(final)&&Number.isInteger(at)&&Number.isInteger(end)&&first>=1&&final>=first&&final<=book.pages.length&&at>=0&&end>=0){
   const last=Math.min(final,first+1),part=book.pages.slice(first-1,last).map((p,i)=>p.text.slice(i===0?at:0,first+i===final?end:undefined)).join('\n');
   const found=getExcerpt(part,headings,entry,ref,index,first,last,final>last);
   if(found)return found;
  }
 }
 // The equipment tables often occur dozens of pages after the descriptive prose.
 // A known descriptive page takes precedence over the table's numerical page.
 const first=entry.descriptionPage||ref?.page||entry.page;
 if(!Number.isInteger(first)||first<1||first>book.pages.length)return null;
 const firstText=book.pages[first-1]?.text||'';
 const found=firstHeading(firstText,headings);
 if(!found)return null; // Never substitute the full page of a neighbouring entry.
 const likelyContinuation=Boolean(ref?.endPage>first);
 const last=likelyContinuation?Math.min(first+1,book.pages.length):first;
 const raw=book.pages.slice(first-1,last).map(p=>p.text).join('\n');
 return getExcerpt(raw,headings,entry,ref,index,first,last,Boolean(ref?.endPage>last));
}
