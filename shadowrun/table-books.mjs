import {getStored, putStored} from './storage.mjs?v=143';

export const TABLE_HOST='https://compendium-sr6-table-archives.justperiwinkle5.chatgpt.site';
const valid=key=>/^[A-Za-z0-9_-]{32}$/.test(key||'');
const bookIds=['core','feu','companion','rigger','hacker','wild'];
const pending=new Map();
let key, shelf;
export function hasTable(){return valid(key);}
export function tableShelf(){return shelf;}
export async function startTable(){
 const fromLink=new URLSearchParams(location.hash.slice(1)).get('table');
 key=valid(fromLink)?fromLink:await getStored('table-access-v1');
 if(!hasTable())return null;
 if(valid(fromLink))await putStored('table-access-v1',fromLink);
 if(!shelf)shelf=await readFile('shelf.json','json');
 return shelf;
}
async function readFile(path, format){
 if(!hasTable())throw Error('Le lien personnel de la table est nécessaire.');
 const res=await fetch(TABLE_HOST+'/books/'+path,{headers:{Authorization:'Bearer '+key},credentials:'omit',cache:path==='shelf.json'?'no-store':'default',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('L’ouvrage n’a pas pu être ouvert. Réessaie dans quelques instants.');
 return format==='json'?res.json():res.blob();
}
export function fetchBook(id){
 if(!bookIds.includes(id))return Promise.reject(Error('Ouvrage inconnu.'));
 return cached(id+'/text.json','json');
}
function cached(path,format){
 if(!pending.has(path))pending.set(path,readFile(path,format).catch(err=>{pending.delete(path);throw err;}));
 return pending.get(path);
}
export async function fetchPlate(id,file){
 if(!bookIds.includes(id)||!/^art-\d+(?:-\d+)?\.webp$/.test(file))throw Error('Illustration inconnue.');
 return readFile(id+'/'+file,'blob');
}
const comparison=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[-’']/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function selectPlates(e, artwork) {
 const art=artwork?.[e.source]||[], names=[e.originalTitle,e.original?.name,e.name,e.title].filter(Boolean).map(comparison);
 const identified=art.filter(a=>a.entries?.includes(e.id));
 if(identified.length)return identified;
 const near=art.filter(a=>Math.abs(a.page-(e.descriptionPage||e.page))<=3);
 const matched=near.filter(a=>a.label&&names.some(n=>{
  const l=comparison(a.label);
  return n===l||n.length>=6&&l.length>=6&&(l.includes(n)||n.includes(l));
 }));
 if(matched.length)return matched;
 // For a stat block on a later page, an unrelated labelled animal must not
 // become its portrait. Unlabelled illustrations are explicitly page views.
 if(e.source==='wild'&&e.kind==='creature')return [];
 const target=e.descriptionPage||e.page;
 return art.filter(a=>a.page===target&&(!(e.kind==='equipment'&&a.entries?.length)));
}
