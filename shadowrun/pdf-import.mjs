// Book bytes are read on the device. No PDF or extracted text is uploaded.
import {extractHeadingLines} from './source-headings.mjs?v=145';
let pdfModule;
export async function readBookPdf(file,book,onProgress=()=>{}){
 if(!file||!book)throw Error('Choisis le PDF de cet ouvrage.');
 if(file.size>350*1024*1024)throw Error('Ce PDF dépasse 350 Mo.');
 const pdfjs=await (pdfModule??=import('../assets/pdfjs-4.10.38/pdf.mjs'));
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../assets/pdfjs-4.10.38/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
 task.onPassword=(_update)=>task.destroy();
 const doc=await task.promise;
 try{
  if(doc.numPages!==book.pageCount)throw Error(`Ce PDF contient ${doc.numPages} pages ; l’édition attendue de ${book.displayTitle||book.title} en comporte ${book.pageCount}.`);
  const pages=[];
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n),content=await page.getTextContent();
   const lines=[];let parts=[];
   const flush=()=>{if(parts.length){lines.push({x:Math.min(...parts.map(p=>p.x)),y:parts[0].y,parts});parts=[];}};
   const viewport=page.getViewport({scale:1}),w=viewport.width,h=viewport.height;
   for(const item of content.items){
    if(typeof item.str!=='string')continue;
    const x=item.transform[4],y=item.transform[5];
    if(Math.abs(item.transform[1])>0.5||y<32||y>h-30||x<35||x>w-35){if(item.hasEOL)flush();continue;}
    if(parts.length&&Math.abs(parts[0].y-y)>2)flush();
    if(item.str)parts.push({x,y,width:item.width||0,size:Math.abs(item.transform[0]),text:item.str});
    if(item.hasEOL)flush();
   }
   flush();
   lines.sort((a,b)=>Number(a.x>w*.5)-Number(b.x>w*.5)||b.y-a.y||a.x-b.x);
   const rows=lines.map(l=>{
    const ordered=l.parts.sort((a,b)=>a.x-b.x);let out='',right=null;
    for(const p of ordered){if(right!==null&&p.x-right>Math.max(1,p.size*.18)&&!out.endsWith(' ')&&!p.text.startsWith(' '))out+=' ';out+=p.text;right=p.x+p.width;}
    return {text:out.trim(),size:ordered.length?Math.max(...ordered.map(p=>p.size)):0};
   }).filter(row=>! /\b(?:Gervais\s+ANTOINE|Thomas\s+LANCON)\b|@(?:hotmail|techprint)|\b\d{6}\/\d{5,}\/\d{5,}/i.test(row.text));
   // The original line typography is kept only as a compact set of short
   // headings. No full page text or illustrations are sent to GitHub.
   const headingLines=extractHeadingLines(rows);
   const text=rows.map(row=>row.text).join('\n').replace(/([\p{L}])-\s*\n(?=[\p{L}])/gu,'$1');
   pages.push({number:n,printed:n-book.printedOffset,text,layout:text,headingLines});
   onProgress(n,doc.numPages);page.cleanup();
  }
  return {...book,pages};
 }finally{await doc.destroy();}
}
