export const cellTypes=[['personnage','Personnages','octagon','#d4af37'],['groupe','Groupes','rect','#d4af37'],['lieu','Lieux','rect','#60a5fa'],['objet','Objets','diamond','#c084fc'],['ressource','Ressources','rect','#4ade80'],['evenement','Événements','rect','#f59e0b']];
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const imageData=/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
function imageSource(value){
 if(!value)return '';
 if(imageData.test(value))return value;
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href.replace(/'/g,'%27')}catch{}
 throw Error('Choisis une image importée ou une adresse HTTPS.');
}
export function reserveNode(source){
 if(!source||typeof source!=='object')throw Error('Cellule invalide.');
 const n=JSON.parse(JSON.stringify(source)),type=cellTypes.find(t=>t[0]===n.category)||cellTypes[0];
 if(typeof n.title!=='string'||!n.title.trim()||n.title.length>500)throw Error('Donne un nom à la cellule (500 caractères maximum).');
 for(const key of ['id','originalId','parentId','x','y','revOrder'])delete n[key];
 Object.assign(n,{title:n.title.trim(),category:type[0],shape:n.shape||type[2],color:n.color||type[3],border:n.border||'double',w:Number(n.w)||250,h:Number(n.h)||160,desc:String(n.desc||''),revealed:false,innerZoom:1});
 n.bgImg=n.bgImg||n.image||n.imageData||'';delete n.image;delete n.imageData;
 n.bgFit=n.bgFit||'contain';
 n.bgImg=imageSource(n.bgImg);
 n.clues=(Array.isArray(n.clues)?n.clues:[]).map(q=>({...q,id:crypto.randomUUID(),text:String(q.text||''),revealed:false,revOrder:null}));
 n.gmDetails=(Array.isArray(n.gmDetails)?n.gmDetails:[]).map(q=>({id:crypto.randomUUID(),title:String(q.title||''),text:String(q.text||'')}));
 return n;
}
export function validateReserve(records){
 if(!Array.isArray(records)||records.length>10000)throw Error('Réserve de cellules invalide.');
 const ids=new Set();
 for(const r of records){
  if(!r||!uuid(r.id)||ids.has(r.id)||typeof r.node?.title!=='string'||!r.node.title.trim()||!cellTypes.some(t=>t[0]===r.node.category)||!Array.isArray(r.node.clues)||!Array.isArray(r.node.gmDetails)||(r.node.bgImg&&!/^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/.test(r.node.bgImg)))throw Error('Une cellule de la réserve est invalide.');
  ids.add(r.id);
  imageSource(r.node.bgImg);
 }
 return records;
}
export async function openCellReserve(room,owner){
 const scope=JSON.stringify([room,owner]);
 const db=await new Promise((resolve,reject)=>{
  const r=indexedDB.open('archives-imaginaire-cell-reserve',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('cells',{keyPath:['scope','id']}).createIndex('scope','scope');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Ferme les autres fenêtres de la réserve puis réessaie.'));
 });
 const run=(mode,fn)=>new Promise((resolve,reject)=>{const tx=db.transaction('cells',mode),request=fn(tx.objectStore('cells'));tx.oncomplete=()=>resolve(request?.result);tx.onabort=()=>reject(tx.error||Error('La réserve n’a pas pu être enregistrée.'));tx.onerror=()=>{}});
 const list=async()=> (await run('readonly',s=>s.index('scope').getAll(scope))).map(({scope,...r})=>r);
 return {
  list,
  async put(record){validateReserve([record]);await run('readwrite',s=>s.put({...record,scope}));return record},
  remove:id=>run('readwrite',s=>s.delete([scope,id])),
  async restore(records,replace=false){
   validateReserve(records);const previous=replace?await list():[];
   await run('readwrite',s=>{for(const r of previous)s.delete([scope,r.id]);for(const r of records)s.put({...r,scope})});
  },
  close:()=>db.close()
 };
}
