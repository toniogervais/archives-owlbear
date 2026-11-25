import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid} from "./math.js?v=231";
export const KEY="fr.toniogervais.calibrateur/v3/undo";
const cp=x=>JSON.parse(JSON.stringify(x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,t=.15)=>Math.abs(a-b)<=t;
const geo=i=>({id:i.id,position:cp(i.position),scale:cp(i.scale),rotation:i.rotation,imageUrl:i.image?.url});
const matches=(a,b)=>a&&a.id===b.id&&a.image?.url===b.imageUrl&&dist(a.position,b.position)<.02&&dist(a.scale,b.scale)<.0001&&near(a.rotation,b.rotation,.0001);
export function affine(s,dpi,corner){if(!valid(s)||!(dpi>0)||!finite(corner))throw Error("Case ou grille invalide.");const k=dpi/s.size;if(k<.02||k>50)throw Error("Facteur de calibration hors limites.");const origin={x:s.x-s.size/2,y:s.y-s.size/2};return {k,origin,corner}}
export function project(p,t){return {x:t.corner.x+(p.x-t.origin.x)*t.k,y:t.corner.y+(p.y-t.origin.y)*t.k}}
export function transform(i,t){return {...geo(i),position:project(i.position,t),scale:{x:i.scale.x*t.k,y:i.scale.y*t.k}}}
const boundsMatch=(a,b,t)=>dist(a.min,project(b.min,t))<.5&&dist(a.max,project(b.max,t))<.5;
async function nativeCorner(s,dpi,api,guard){
 const g=api.scene.grid;
 const p={x:s.x-s.size/2,y:s.y-s.size/2};
 const c=await g.snapPosition(p,1,true,false);guard();if(!finite(c))throw Error("Intersection native non disponible.");
 const test=[{x:c.x+dpi,y:c.y},{x:c.x,y:c.y+dpi},{x:c.x+dpi,y:c.y+dpi}];
 const probes=await Promise.all([g.snapPosition({x:c.x+.19*dpi,y:c.y+.21*dpi},1,true,false),...test.map(v=>g.snapPosition(v,1,true,false))]);guard();
 if(dist(probes[0],c)>.1||test.some((v,i)=>dist(v,probes[i+1])>.1))throw Error("Le SDK n’a pas confirmé les intersections de la grille carrée.");
 return c
}
async function readBounds(items,api,guard){const out={};for(let i=0;i<items.length;i+=8){const chunk=items.slice(i,i+8);const b=await Promise.all(chunk.map(x=>api.scene.items.getItemBounds([x.id])));guard();for(let j=0;j<chunk.length;j++){if(!finite(b[j]?.min)||!finite(b[j]?.max))throw Error("Limites d’un objet non disponibles.");out[chunk[j].id]=b[j]}}return out}
async function write(items,values,api,guard){guard();const m=new Map(values.map(v=>[v.id,v]));await api.scene.items.updateItems(items,draft=>{for(const i of draft){const v=m.get(i.id);if(v){i.position=cp(v.position);i.scale=cp(v.scale)}}});guard()}
export async function calibrate(s,tokenId,guard=()=>{},api=OBR){
 guard();const [type,dpi,all,meta,opacity]=await Promise.all([api.scene.grid.getType(),api.scene.grid.getDpi(),api.scene.items.getItems(),api.scene.getMetadata(),api.scene.grid.getOpacity()]);guard();
 if(type!=="SQUARE")throw Error("Choisis une grille carrée dans Owlbear.");
 if(meta[KEY]?.pending)throw Error("Une opération interrompue est présente : utilise Annuler.");
 if(!all.some(i=>i.id===tokenId&&i.type==="IMAGE"&&i.layer!=="MAP")||!all.some(i=>i.type==="IMAGE"&&i.layer==="MAP"))throw Error("Il faut une carte et un token.");
 if(all.length>60)throw Error("Scène trop chargée pour cette version de test.");
 if(all.some(i=>i.type!=="IMAGE"||i.attachedTo||i.metadata?.["fr.toniogervais.calibrateur/v24/session/image"]||i.metadata?.["fr.toniogervais.calibrateur/v26/swap/active"]))throw Error("Pour cet essai, utilise une scène avec seulement des cartes et des tokens indépendants, sans dessins, brouillard découpé ni anciennes grilles.");
 const corner=await nativeCorner(s,dpi,api,guard);const t=affine(s,dpi,corner),bounds=await readBounds(all,api,guard);
 const before=all.map(geo),after=all.map(i=>transform(i,t));
 const fresh=await api.scene.items.getItems();guard();if(fresh.length!==before.length||!before.every(v=>matches(fresh.find(i=>i.id===v.id),v)))throw Error("La scène a changé pendant le calcul.");
 const record={before,after,opacity,pending:true,tokenId};
 await api.scene.setMetadata({[KEY]:record});guard();
 try{
 await write(fresh,after,api,guard);
 const current=await api.scene.items.getItems();guard();
 if(current.length!==after.length||!after.every(v=>matches(current.find(i=>i.id===v.id),v)))throw Error("Owlbear n’a pas appliqué toutes les transformations.");
 const result=await readBounds(current,api,guard);
 if(after.some(v=>!boundsMatch(result[v.id],bounds[v.id],t)))throw Error("Le rendu réel ne correspond pas à l’alignement calculé.");
 const c2=await nativeCorner({x:corner.x+dpi/2,y:corner.y+dpi/2,size:dpi},dpi,api,guard);
 if(dist(c2,corner)>.1||Math.abs(await api.scene.grid.getDpi()-dpi)>.001)throw Error("La grille a changé pendant le calibrage.");
 guard();if(opacity===0)await api.scene.grid.setOpacity(.65);guard();
 await api.scene.setMetadata({[KEY]:{...record,pending:false}});guard();
 return {k:t.k,corner,dpi,count:after.length};
 }catch(e){
 try{guard();const current=await api.scene.items.getItems();guard();if(!before.every(v=>{const i=current.find(x=>x.id===v.id);return matches(i,v)||matches(i,after.find(a=>a.id===v.id))}))throw Error("Modification concurrente.");await write(current.filter(i=>before.some(v=>v.id===i.id)),before,api,guard);await api.scene.grid.setOpacity(opacity);guard();const check=await api.scene.items.getItems();guard();if(!before.every(v=>matches(check.find(i=>i.id===v.id),v)))throw Error("Restauration non confirmée.");await api.scene.setMetadata({[KEY]:null});guard()}catch{throw Error(e.message+" — récupération conservée : utilise Annuler dans la même scène.")}
 throw Error(e.message+" — changements annulés.");
 }
}
export async function undo(guard=()=>{},api=OBR){
 const r=(await api.scene.getMetadata())[KEY];guard();if(!r)throw Error("Aucun calibrage à annuler.");
 const current=await api.scene.items.getItems();guard();
 if(!r.before.every(v=>{const i=current.find(x=>x.id===v.id);return matches(i,r.after.find(a=>a.id===v.id))||(r.pending&&matches(i,v))}))throw Error("Des objets ont été déplacés ou supprimés depuis le calibrage. Annulation automatique refusée pour les protéger.");
 await write(current.filter(i=>r.before.some(v=>v.id===i.id)),r.before,api,guard);
 const check=await api.scene.items.getItems();guard();if(!r.before.every(v=>matches(check.find(i=>i.id===v.id),v)))throw Error("Restauration non confirmée.");
 await api.scene.grid.setOpacity(r.opacity);guard();await api.scene.setMetadata({[KEY]:null});guard()
}
