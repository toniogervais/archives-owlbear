/* Validation pure des médias MJ liés aux cellules. N'envoie jamais les données aux joueurs. */
export const allowedCellMediaActions=['start','fade_in','crossfade','replace','toggle','toggle_fade'];
export function safeCellAttachments(items,catalog){
  if(!Array.isArray(items)||!Array.isArray(catalog))return [];
  const map=new Map(catalog.filter(v=>v&&['sound','video'].includes(v.kind)&&v.locked!==true).map(v=>[v.id,v]));
  const found=new Set();
  const result=[];
  for(const item of items){
    if(!item||typeof item.id!=='string'||found.has(item.id)||!map.has(item.id))continue;
    found.add(item.id);
    const target=map.get(item.id);
    result.push({id:item.id,kind:target.kind,action:allowedCellMediaActions.includes(item.action)?item.action:'start'});
    if(result.length===16)break;
  }
  return result;
}
