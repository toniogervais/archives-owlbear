import {prepareEntries,searchEntries,makeAliases,libraryPages} from './search.mjs?v=134';
let entries=[],pages=[],aliases=new Map();
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){entries=prepareEntries(data.entries);aliases=makeAliases(data.terms);self.postMessage({type:'ready'});}
  if(data.type==='library'){pages=libraryPages(data.library);self.postMessage({type:'library-ready'});}
  if(data.type==='book'){pages=pages.filter(p=>p.source!==data.book.id).concat(libraryPages({books:[data.book]}));self.postMessage({type:'library-ready'});}
  if(data.type==='search'){const list=data.fulltext?[...entries,...pages]:[...entries,...prepareEntries(data.references||[])];const opts={...data.options,favorites:data.options.favorites?new Set(data.options.favorites):null};self.postMessage({type:'results',seq:data.seq,...searchEntries(list,opts,aliases)});}
 }catch(e){self.postMessage({type:'error',seq:data.seq,message:e.message});}
};
