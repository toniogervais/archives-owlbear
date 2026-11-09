/* Validation pure des médias MJ liés aux cellules. N'envoie jamais les données aux joueurs. */
export const allowedCellMediaActions=['start','fade_in','crossfade','replace','toggle','toggle_fade'];
export function safeCellAttachments(items,catalog){
  if(!Array.isArray(items)||!Array.isArray(catalog))return [];
  const map=new Map(catalog.filter(v=>v&&['sound','video'].includes(v.kind)&&v.locked!==true).map(v=>[v.id,v]));
  const found=new Set();
  return items.filter(v=>v&&typeof v.id==='string'&&!found.has(v.id)&&map.has(v.id))
    .slice(0,16).map(v=>{found.add(v.id);const target=map.get(v.id);
      return {id:v.id,kind:target.kind,action:allowedCellMediaActions.includes(v.action)?v.action:'start'};});
}
