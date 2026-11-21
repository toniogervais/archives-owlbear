import {normalize} from './model.mjs?v=145';
import {printedHeadingBoundary} from './source-headings.mjs?v=145';

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
// The source index is large (thousands of entries). Only headings printed
// on the one or two requested pages need to be compared for a given fiche.
const pagesCache=new WeakMap();
function indexedPages(index){
 let pages=pagesCache.get(index);
 if(!pages){
  pages=new Map();
  for(const entry of index){
   const key=entry.source+':'+entry.page;
   if(!pages.has(key))pages.set(key,[]);
   pages.get(key).push(entry);
  }
  pagesCache.set(index,pages);
 }
 return pages;
}
function limitByHeadings(raw,offset,entry,ref,index,first,last,book){
 let end=raw.length;
 const grouped=indexedPages(index);
 const nearby=[];
 for(let page=first;page<=last;page++)nearby.push(...(grouped.get(entry.source+':'+page)||[]));
 for(const other of nearby){
  if(other.id===ref?.id)continue;
  if(ref&&Number.isFinite(ref.level)&&Number.isFinite(other.level)&&other.level>ref.level)continue;
  if(comparable(other.originalTitle||other.title)===comparable(ref?.originalTitle||ref?.title||entry.originalTitle||entry.title||entry.name))continue;
  const re=headingPattern(other.originalTitle||other.title);if(!re)continue;
  re.lastIndex=offset;const hit=re.exec(raw);
  if(hit&&hit.index<end)end=hit.index;
 }
 // A real PDF import preserves the typographic hierarchy of headings.
 // Stop before the next printed heading of equal or greater size even if
 // that heading is absent or mistranscribed in the index.
 if(book?.pages?.length){
  const headings=book.pages.slice(first-1,last).map(p=>p.headingLines||[]);
  const names=[ref?.originalTitle,ref?.title,entry.originalTitle,entry.title,entry.name].filter(Boolean);
  const typographic=printedHeadingBoundary(raw,headings,names,offset);
  if(typographic!==null)end=Math.min(end,typographic);
 }
 return end;
}
// A section may end without a full stop when its sentence continues on the
// next printed page. Never infer a continuation merely from a close title.
function unfinishedAtPageEnd(text){
 const tail=String(text||'').replace(/\s+/g,' ').trim();
 return tail.length>=18&&tail.split(/\s+/).length>=3&&!/[.!?…»”)]$/.test(tail)&&/[\p{L}\d,;:–—-]$/u.test(tail);
}
// PDF text commonly begins with a running header (chapter, folio, book).
// A continuation cannot be delimited against these page decorations.
function cleanContinuationHeader(text){
 const lines=String(text||'').split('\n');
 let i=0;
 while(i<4&&i<lines.length){
  const line=lines[i].trim();
  if(/^\d{1,3}$/.test(line)||/^shadowrun\b/i.test(line)||/^[^\n]{1,65}\s*\/\/\s*[^\n]{1,65}$/i.test(line)){i++;continue;}
  break;
 }
 return lines.slice(i).join('\n');
}
// The outline may call the next topic "Magie" while its printed heading is
// actually "Sorts". When the preceding section has no explicit end anchor,
// stop at a new short heading preceded by a completed paragraph. This is a
// safety boundary, never a claim about the heading's exact identity.
function printedBoundary(text){
 let offset=0,previous='';
 for(const line of text.split('\n')){
  const current=line.trim();
  const candidate=current.length>=3&&current.length<=48&&
   /^[\p{Lu}]/u.test(current)&&current.split(/\s+/).length<=5&&
   !/[.!?;:]$/.test(current)&&!/[\/+\d]/.test(current)&&
   !/^(?:shadowrun|table des mati[eè]res)/i.test(current)&&
   /[.!?…»]$/.test(previous);
  if(candidate)return offset;
  if(current)previous=current;
  offset+=line.length+1;
 }
 return text.length;
}
function getExcerpt(raw,headingTitles,entry,ref,index,first,last,truncated,book){
 const found=firstHeading(raw,headingTitles);
 if(!found)return null;
 const start=found.hit.index+found.hit[0].length;
 const end=limitByHeadings(raw,start,entry,ref,index,first,last,book);
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
   const found=getExcerpt(part,headings,entry,ref,index,first,last,final>last,book);
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
  const excerpt=getExcerpt(following,headings,entry,ref,index,next,next,Boolean(ref?.endPage>next),book);
  return excerpt?{...excerpt,matchedBy:'exact-heading',fullEndPage:ref?.endPage||next}:null;
 }
 // A reliably indexed next heading ends the section, even if this page
 // happens to finish mid-sentence. In particular, never append the next
 // page after a different entry has already begun.
 const start=found.hit.index+found.hit[0].length;
 const stop=limitByHeadings(firstText,start,entry,ref,index,first,first,book);
 const boundedHere=stop<firstText.length;
 const declaredEnd=Math.max(first,ref?.endPage||first,entry.endPage||first);
 const explicitContinuation=declaredEnd>first;
 const inferredContinuation=!boundedHere&&unfinishedAtPageEnd(firstText.slice(start));
 const includesNext=first<book.pages.length&&!boundedHere&&(explicitContinuation||inferredContinuation);
 const last=includesNext?first+1:first;
 const nextText=includesNext?cleanContinuationHeader(book.pages[first]?.text):'';
 // Only infer printed headings when this page extension was not established by
 // an explicit source boundary. Never let a neighbouring section join the text.
 const hasTypography=Boolean(book.pages[first-1]?.headingLines?.length||book.pages[first]?.headingLines?.length);
 const safeNext=includesNext&&!explicitContinuation&&!hasTypography?nextText.slice(0,printedBoundary(nextText)):nextText;
 const raw=includesNext?firstText+'\n'+safeNext:firstText;
 const extracted=getExcerpt(raw,headings,entry,ref,index,first,last,Boolean(declaredEnd>last),book);
 if(!extracted)return null;
 // A following indexed heading can be the very first line on page two.
 // In that case, the actual passage did not extend onto that page.
 const boundary=firstText.length+1;
 const otherHeading=includesNext?limitByHeadings(raw,start,entry,ref,index,first,last,book):raw.length;
 const actualLast=includesNext&&otherHeading>boundary?last:first;
 return {...extracted,endPage:actualLast,matchedBy:inferredContinuation&&!explicitContinuation&&actualLast>first?'two-page-continuation':'exact-heading',fullEndPage:Math.max(declaredEnd,actualLast)};
}
