import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid} from "./math.js?v=231";
export const KEY="fr.toniogervais.calibrateur/v3/undo";
const cp=x=>JSON.parse(JSON.stringify(x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,t=.15)=>Math.abs(a-b)<=t;
const geo=i=>({id:i.id,position:cp(i.position),scale:cp(i.scale),rotation:i.rotation,imageUrl:i.image?.url,attachedTo:i.attachedTo||null});
const matches=(a,b)=>a&&a.id===b.id&&a.image?.url===b.imageUrl&&(!("attachedTo" in b)||(a.attachedTo||null)===b.attachedTo)&&dist(a.position,b.position)<.02&&dist(a.scale,b.scale)<.0001&&near(a.rotation,b.rotation,.0001);
export function affine(s,dpi,corner){if(!valid(s)||!(dpi>0)||!finite(corner))throw Error("Case ou grille invalide.");const k=dpi/s.size;if(k<.02||k>50)throw Error("Facteur de calibration hors limites.");const origin={x:s.x-s.size/2,y:s.y-s.size/2};return {k,origin,corner}}
export function project(p,t){return {x:t.corner.x+(p.x-t.origin.x)*t.k,y:t.corner.y+(p.y-t.origin.y)*t.k}}
export function transform(i,t){return {...geo(i),position:project(i.position,t),scale:{x:i.scale.x*t.k,y:i.scale.y*t.k}}}
const boundsMatch=(a,b,t)=>dist(a.min,project(b.min,t))<.5&&dist(a.max,project(b.max,t))<.5;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function nativeCorner(s,dpi,api,guard){
 const g=api.scene.grid;
 const p={x:s.x-s.size/2,y:s.y-s.size/2};
 const c=await g.snapPosition(p,1,true,false);guard();if(!finite(c))throw Error("Intersection native non disponible.");
 const test=[{x:c.x+dpi,y:c.y},{x:c.x,y:c.y+dpi},{x:c.x+dpi,y:c.y+dpi}];
 const probes=await Promise.all([g.snapPosition({x:c.x+.19*dpi,y:c.y+.21*dpi},1,true,false),...test.map(v=>g.snapPosition(v,1,true,false))]);guard();
 if(dist(probes[0],c)>.1||test.some((v,i)=>dist(v,probes[i+1])>.1))throw Error("Le SDK n’a pas confirmé les intersections de la grille carrée.");
 return c
}
const describe=i=>(i.name||"Sans nom")+" ["+i.type+" / "+i.layer+"]";
export function plan(items){
 const by=new Map(items.map(i=>[i.id,i])),roots=[];
 for(const i of items){
  if(!finite(i.position)||!finite(i.scale)||!Number.isFinite(i.rotation))throw Error("Transformation non disponible : "+describe(i));
  if(i.metadata?.["fr.toniogervais.calibrateur/v24/session/image"]||i.metadata?.["fr.toniogervais.calibrateur/v26/swap/active"])throw Error("Ancienne opération de calibrage active : "+describe(i));
  if(!i.attachedTo){roots.push(i);continue}
  let p=i;const seen=new Set();
  while(p.attachedTo){
   if(seen.has(p.id))throw Error("Attache circulaire : "+describe(i));seen.add(p.id);
   if((p.disableAttachmentBehavior||[]).some(k=>k==="POSITION"||k==="SCALE"))throw Error("Attache avec déplacement ou échelle désactivés : "+describe(p));
   p=by.get(p.attachedTo);if(!p)throw Error("Parent d’attache absent : "+describe(i));
  }
 }
 return roots;
}
async function readBounds(items,api,guard){const out={};for(let i=0;i<items.length;i+=8){const chunk=items.slice(i,i+8);const b=await Promise.all(chunk.map(x=>api.scene.items.getItemBounds([x.id])));guard();for(let j=0;j<chunk.length;j++){if(!finite(b[j]?.min)||!finite(b[j]?.max))throw Error("Limites non disponibles : "+describe(chunk[j]));out[chunk[j].id]=b[j]}}return out}
async function write(items,values,api,guard){guard();const m=new Map(values.map(v=>[v.id,v]));await api.scene.items.updateItems(items,draft=>{for(const i of draft){const v=m.get(i.id);if(v){i.position=cp(v.position);i.scale=cp(v.scale)}}});guard()}
// Reconcile a stale journal without altering any scene geometry.
export function journalState(r,items){
 if(!r||!Array.isArray(r.before)||!Array.isArray(r.after)||!r.before.length||r.before.length!==r.after.length)return "unknown";
 const by=new Map(items.map(i=>[i.id,i]));
 const before=r.before.every(v=>matches(by.get(v.id),v));
 const after=r.after.every(v=>matches(by.get(v.id),v));
 if(after)return "after";
 if(before)return "before";
 return r.before.every(v=>matches(by.get(v.id),v)||matches(by.get(v.id),r.after.find(x=>x.id===v.id)))?"mixed":"unknown";
}
// Metadata may be returned with reordered keys or omitted undefined fields.
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])]));
 return v;
}
const equivalent=(x,y)=>JSON.stringify(canonical(x))===JSON.stringify(canonical(y));
async function storeRecord(record,api,guard){
 const value=record?cp(record):null;
 for(let attempt=0;attempt<4;attempt++){
  guard();await api.scene.setMetadata({[KEY]:value});guard();
  for(let read=0;read<3;read++){
   if(read)await sleep(90*read);guard();
   const actual=(await api.scene.getMetadata())[KEY];guard();
   if(value===null?!actual:actual&&actual.pending===value.pending&&actual.tx===value.tx&&equivalent(actual.before,value.before)&&equivalent(actual.after,value.after))return;
  }
 }
 throw Error("Owlbear n’a pas confirmé l’enregistrement de l’état du calibrage.");
}
export async function recover(api=OBR,guard=()=>{}){
 guard();const r=(await api.scene.getMetadata())[KEY];guard();
 if(!r?.pending)return {record:r||null,state:"ready"};
 const items=await api.scene.items.getItems();guard();
 const state=journalState(r,items);
 if(state==="after"){
  const {previous,...saved}=r,record={...saved,pending:false};await storeRecord(record,api,guard);return {record,state:"completed"};
 }
 if(state==="before"){
  const previous=r.previous&&!r.previous.pending?r.previous:null;
  // restore any grid opacity touched before a rollback
  if(Number.isFinite(r.opacity)&&await api.scene.grid.getOpacity()!==r.opacity){guard();await api.scene.grid.setOpacity(r.opacity);guard()}
  await storeRecord(previous,api,guard);return {record:previous,state:"not-applied"};
 }
 throw Error(state==="mixed"?"Calibrage partiel : Annuler pour restaurer, ou Repartir de la scène actuelle pour conserver son état.":"Ancienne sauvegarde incompatible. Clique sur Repartir de la scène actuelle (icône de réinitialisation), puis confirme.");
}
// Only explicitly requested by the GM. Never modifies scene items or the grid.
export async function acceptCurrent(guard=()=>{},api=OBR){
 guard();const r=(await api.scene.getMetadata())[KEY];guard();
 if(!r)return false;
 await storeRecord(null,api,guard);guard();return true;
}
export async function calibrate(s,tokenId,guard=()=>{},api=OBR){
 guard();const recovered=await recover(api,guard);const [type,dpi,all,opacity]=await Promise.all([api.scene.grid.getType(),api.scene.grid.getDpi(),api.scene.items.getItems(),api.scene.grid.getOpacity()]);guard();
 if(type!=="SQUARE")throw Error("Choisis une grille carrée dans Owlbear.");
 if(!all.some(i=>i.id===tokenId&&i.type==="IMAGE"&&i.layer!=="MAP")||!all.some(i=>i.type==="IMAGE"&&i.layer==="MAP"))throw Error("Il faut une carte et un token.");
 if(all.length>150)throw Error("Scène trop chargée : "+all.length+" objets (limite 150).");
 const roots=plan(all),rootIds=roots.map(i=>i.id);
 const corner=await nativeCorner(s,dpi,api,guard);const t=affine(s,dpi,corner),bounds=await readBounds(all,api,guard);
 const before=all.map(geo),after=all.map(i=>transform(i,t));
 const fresh=await api.scene.items.getItems();guard();if(fresh.length!==before.length||!before.every(v=>matches(fresh.find(i=>i.id===v.id),v)))throw Error("La scène a changé pendant le calcul.");
 const record={before,after,opacity,pending:true,tokenId,rootIds,tx:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2),previous:recovered.record};
 await storeRecord(record,api,guard);guard();
 try{
 await write(fresh.filter(i=>rootIds.includes(i.id)),after,api,guard);
 let confirmed=false,lastFailure="";
 for(let attempt=0;attempt<5;attempt++){
  if(attempt)await sleep(160*attempt);guard();
  const current=await api.scene.items.getItems();guard();
  if(current.length!==after.length){lastFailure="Nombre d’objets modifié";continue}const mismatch=after.find(v=>!matches(current.find(i=>i.id===v.id),v));if(mismatch){lastFailure="Position ou échelle : "+describe(all.find(i=>i.id===mismatch.id));continue}
  const result=await readBounds(current,api,guard);
  const mismatchBounds=after.find(v=>!boundsMatch(result[v.id],bounds[v.id],t));if(!mismatchBounds){confirmed=true;break}lastFailure="Dimensions : "+describe(all.find(i=>i.id===mismatchBounds.id));
 }
 if(!confirmed)throw Error("Calibrage non confirmé — "+lastFailure);
 const c2=await nativeCorner({x:corner.x+dpi/2,y:corner.y+dpi/2,size:dpi},dpi,api,guard);
 if(dist(c2,corner)>.1||Math.abs(await api.scene.grid.getDpi()-dpi)>.001)throw Error("La grille a changé pendant le calibrage.");
 guard();if(opacity===0)await api.scene.grid.setOpacity(.65);guard();
 const {previous,...saved}=record;
 let journalSaved=true;try{await storeRecord({...saved,pending:false},api,guard)}catch{journalSaved=false}guard();
 return {k:t.k,corner,dpi,count:after.length,recovery:recovered.state,journalSaved};
 }catch(e){
 try{guard();const current=await api.scene.items.getItems();guard();if(!before.every(v=>{const i=current.find(x=>x.id===v.id);return matches(i,v)||matches(i,after.find(a=>a.id===v.id))}))throw Error("Modification concurrente.");await write(current.filter(i=>rootIds.includes(i.id)),before,api,guard);await api.scene.grid.setOpacity(opacity);guard();const check=await api.scene.items.getItems();guard();if(!before.every(v=>matches(check.find(i=>i.id===v.id),v)))throw Error("Restauration non confirmée.");await storeRecord(recovered.record,api,guard);guard()}catch{throw Error(e.message+" — récupération conservée : utilise Annuler dans la même scène.")}
 throw Error(e.message+" — changements annulés.");
 }
}
export async function undo(guard=()=>{},api=OBR){
 const r=(await api.scene.getMetadata())[KEY];guard();if(!r)throw Error("Aucun calibrage à annuler.");
 const current=await api.scene.items.getItems();guard();
 if(!Array.isArray(r.before)||!Array.isArray(r.after))throw Error("Sauvegarde illisible : utilise Repartir de la scène actuelle.");
 if(!r.before.every(v=>{const i=current.find(x=>x.id===v.id);return matches(i,r.after.find(a=>a.id===v.id))||(r.pending&&matches(i,v))}))throw Error("Des objets ont été déplacés ou supprimés. Pour les conserver, utilise Repartir de la scène actuelle.");
 await write(current.filter(i=>(r.rootIds||r.before.map(v=>v.id)).includes(i.id)),r.before,api,guard);
 const check=await api.scene.items.getItems();guard();if(!r.before.every(v=>matches(check.find(i=>i.id===v.id),v)))throw Error("Restauration non confirmée.");
 await api.scene.grid.setOpacity(r.opacity);guard();await storeRecord(r.pending&&r.previous&&!r.previous.pending?r.previous:null,api,guard);guard()
}
