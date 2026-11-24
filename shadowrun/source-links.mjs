// Only references are published. The complete texts, page facsimiles and
// copyrighted illustrations remain on the private, access-controlled table.
const validPage=(page,book)=>Number.isInteger(page)&&page>=1&&page<=Number(book?.pageCount||0);
const roleNames={description:'Passage descriptif',table:'Tableau original',profile:'Profil chiffré original',reference:'Page citée',source:'Page de la rubrique'};
export function originalReferences(entry,books){
 const catalog=new Map((books||[]).map(book=>[book.id,book])),result=[],seen=new Set();
 const push=(source,page,role)=>{
  const book=catalog.get(source);if(!validPage(page,book))return;
  const key=source+':'+page;
  if(seen.has(key)){
   const existing=result.find(item=>item.source===source&&item.page===page);
   if(existing&&role==='table')existing.role=role;
   return;
  }
  seen.add(key);
  const printed=page-book.printedOffset;
  result.push({source,page,printedPage:printed,book:book.displayTitle||book.title||source,role,roleName:roleNames[role]||roleNames.reference,facsimile:role==='table'||role==='profile'});
 };
 const source=entry?.source;
 if(!catalog.has(source))return [];
 const isEquipment=entry.kind==='equipment';
 const isProfile=entry.kind==='npc'||entry.kind==='creature';
 const isTable=entry.origin==='table'||entry.tablePage||isProfile;
 const descriptionPage=entry.descriptionPage;
 if(validPage(descriptionPage,catalog.get(source)))push(source,descriptionPage,'description');
 if(isTable)push(source,entry.tablePage||entry.page,isProfile?'profile':'table');
 else push(source,entry.page,descriptionPage?'reference':'source');
 for(const ref of entry.refs||[])if(ref?.source&&ref?.page)push(ref.source,ref.page,'reference');
 for(const page of entry.alsoPages||[])if(Number.isInteger(page))push(source,page,'reference');
 const r=entry.endPage||entry.page;
 if(r>entry.page&&r-entry.page<=3){
  for(let page=entry.page+1;page<=r;page++)push(source,page,'reference');
 }
 return result;
}
export function originalSourceLabel(ref){
 return ref.book+' · '+(ref.printedPage>0?'p. '+ref.printedPage+' · ':'')+'PDF '+ref.page;
}
