import {normalize} from './model.mjs?v=143';

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
// A section may end without a full stop when its sentence continues on the
// next printed page. Never infer a continuation merely from a close title.
function unfinishedAtPageEnd(text){
 const tail=String(text||'').replace(/\s+/g,' ').trim();
 return tail.length>=35&&!/[.!?…»”)]$/.test(tail)&&/[\p{L}\d,;:–—-]$/u.test(tail);
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
   if(found)return {...found,matchedBy:'heading-and-anchor',fullEndPage:final};
   // The private book's explicit [start,end] anchor is keyed to this precise
   // section ID. Do not require a second occurrence of its heading, because
   // many headings start before the anchored text in the PDF's column order.
   // Do not use this fallback for titles matched by proximity or name alone.
   const anchored=part.trim();
   if(ref.id===entry.id&&anchored.length>=35){
    const maxLength=20000;
    return {title:ref.title||entry.title,text:anchored.slice(0,maxLength),page:first,endPage:last,fullEndPage:final,truncated:final>last||anchored.length>maxLength,matchedBy:'exact-id-anchor'};
   }
  }
 }
 // The equipment tables often occur dozens of pages after the descriptive prose.
 // A known descriptive page takes precedence over the table's numerical page.
 const first=entry.descriptionPage||ref?.page||entry.page;
 if(!Number.isInteger(first)||first<1||first>book.pages.length)return null;
 const firstText=book.pages[first-1]?.text||'';
 const found=firstHeading(firstText,headings);
 if(!found){
  // PDF page numbering in a section index can drift by one across columns.
  // Only accept a strictly matching heading on the immediately following
  // page; never use its text merely because the page numbers are close.
  const following=book.pages[first]?.text||'';
  if(!firstHeading(following,headings))return null;
  const next=first+1;
  return getExcerpt(following,headings,entry,ref,index,next,next,Boolean(ref?.endPage>next));
 }
 // A reliably indexed next heading ends the section, even if this page
 // happens to finish mid-sentence. In particular, never append the next
 // page after a different entry has already begun.
 const start=found.hit.index+found.hit[0].length;
 const stop=limitByHeadings(firstText,start,entry,ref,index,first,first);
 const boundedHere=stop<firstText.length;
 const declaredEnd=Math.max(first,ref?.endPage||first,entry.endPage||first);
 const explicitContinuation=declaredEnd>first;
 const inferredContinuation=!boundedHere&&unfinishedAtPageEnd(firstText.slice(start));
 const includesNext=first<book.pages.length&&!boundedHere&&(explicitContinuation||inferredContinuation);
 const last=includesNext?first+1:first;
 const raw=book.pages.slice(first-1,last).map(p=>p.text).join('\n');
 const extracted=getExcerpt(raw,headings,entry,ref,index,first,last,Boolean(declaredEnd>last));
 if(!extracted)return null;
 // A following indexed heading can be the very first line on page two.
 // In that case, the actual passage did not extend onto that page.
 const boundary=firstText.length+1;
 const otherHeading=includesNext?limitByHeadings(raw,start,entry,ref,index,first,last):raw.length;
 const actualLast=includesNext&&otherHeading>boundary?last:first;
 return {...extracted,endPage:actualLast,matchedBy:inferredContinuation&&!explicitContinuation&&actualLast>first?'two-page-continuation':'exact-heading',fullEndPage:Math.max(declaredEnd,actualLast)};
}
