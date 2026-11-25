import OBR,{buildPath,Command} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,anchoredSegments,projectSegments,imageFrame,mapSignature,snapCenter,containsMap,rebasePoint,toMap,fromMap,distance} from "./math.js?v=220";
export const GRID="fr.toniogervais.calibrateur/v2/grid",MARK=GRID+"/path",ANCHOR=GRID+"/anchor";
export const getGrid=async()=> (await OBR.scene.getMetadata())[GRID]||null;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function geometry(seg,frame){return projectSegments(seg,frame).flatMap(([a,b])=>[[Command.MOVE,a.x-frame.x,a.y-frame.y],[Command.LINE,b.x-frame.x,b.y-frame.y]])}
export async function mapFrames(ids,guard=()=>{}){const all=await OBR.scene.items.getItems(ids);guard();const out=[];for(const id of ids){const i=all.find(v=>v.id===id&&v.type==="IMAGE");if(!i)throw Error("Carte introuvable.");const b=await OBR.scene.items.getItemBounds([id]);guard();out.push({id,item:i,b,frame:imageFrame(i,b)})}return out}
export function makePaths(s,frames){const out=[];let total=0;for(const {id,frame,b} of frames){const seg=anchoredSegments(s,b,frame);total+=seg.length;if(total>6400)throw Error("Grille trop dense sur l’ensemble des cartes.");for(let i=0;i<seg.length;i+=120){const local=seg.slice(i,i+120);out.push(buildPath().name("Grille calibrée · "+id.slice(0,6)).layer("DRAWING").attachedTo(id).position({x:frame.x,y:frame.y}).commands(geometry(local,frame)).strokeColor(s.color).strokeOpacity(s.opacity).strokeWidth(s.width).fillOpacity(0).locked(true).disableHit(true).disableAutoZIndex(true).disableAttachmentBehavior(["LOCKED","COPY"]).metadata({[MARK]:s.id,[ANCHOR]:{mapId:id,segments:local}}).build())}}if(!out.length)throw Error("Aucune ligne sur les cartes choisies.");return out}
export async function install(s,frames,guard=()=>{}){
 const old=await getGrid(),opacity=await OBR.scene.grid.getOpacity();guard();
 const nativeOpacity=old?.enabled?(old.nativeOpacity??.5):opacity;
 const next={...s,id:crypto.randomUUID(),enabled:true,mode:"both",anchorVersion:1,nativeOpacity,originalFrames:frames.map(f=>({id:f.id,frame:f.frame}))};
 const paths=makePaths(next,frames);next.ids=paths.map(i=>i.id);let committed=false;
 try{await OBR.scene.items.addItems(paths);guard();const now=await OBR.scene.items.getItems(next.ids);guard();if(now.length!==paths.length)throw Error("Grille non confirmée par Owlbear.");
 await OBR.scene.grid.setOpacity(nativeOpacity>0?nativeOpacity:.65);guard();await OBR.scene.setMetadata({[GRID]:next});committed=true;guard();
 }catch(e){try{guard();if(!committed){await OBR.scene.items.deleteItems(next.ids);await OBR.scene.grid.setOpacity(opacity)}}catch{}throw e}
 if(old?.ids?.length){try{guard();const oldPaths=await OBR.scene.items.getItems(old.ids);guard();await OBR.scene.items.deleteItems(oldPaths.filter(i=>i.metadata?.[MARK]===old.id).map(i=>i.id))}catch(e){console.warn("Ancienne grille",e)}}return next
}
export async function setMode(s,mode,guard=()=>{}){if(!s)throw Error("Aucune grille calibrée.");if(!["both","custom","native"].includes(mode))throw Error("Mode inconnu.");if(mode==="both"&&!s.anchorVersion)throw Error("Réapplique la calibration pour ancrer l’ancienne grille aux cartes.");
 const opacity=await OBR.scene.grid.getOpacity();guard();const found=await OBR.scene.items.getItems(s.ids);guard();if(found.length!==s.ids.length)throw Error("Grille incomplète : applique à nouveau la calibration.");
 const enabled=mode!=="native",nativeOpacity=opacity>0?opacity:(s.nativeOpacity??.65),next={...s,enabled,mode,nativeOpacity};
 try{await OBR.scene.items.updateItems(found,items=>{for(const i of items)if(i.metadata?.[MARK]===s.id)i.visible=enabled});guard();await OBR.scene.grid.setOpacity(mode==="custom"?0:(nativeOpacity>0?nativeOpacity:.65));guard();await OBR.scene.setMetadata({[GRID]:next});guard();return next}
 catch(e){try{guard();await OBR.scene.items.updateItems(s.ids,items=>{for(const i of items)if(i.metadata?.[MARK]===s.id)i.visible=s.enabled});await OBR.scene.grid.setOpacity(opacity)}catch{}throw e}
}
export async function toggle(s,enabled,guard=()=>{}){return setMode(s,enabled?"custom":"native",guard)}
// Native attachments follow position, scale and rotation during editing. Re-project
// from the stored map coordinates after committed image DPI / offset changes.
export async function syncAnchors(g,all,cache,guard=()=>{}){if(!g?.anchorVersion)return;
 const byId=new Map(all.map(i=>[i.id,i]));
 for(const id of g.mapIds||[]){const map=byId.get(id);if(!map)continue;const sig=g.id+":"+mapSignature(map);if(cache.get(id)===sig)continue;
 const paths=g.ids.map(x=>byId.get(x)).filter(i=>i?.metadata?.[MARK]===g.id&&i.metadata?.[ANCHOR]?.mapId===id);if(!paths.length)continue;
 const b=await OBR.scene.items.getItemBounds([id]);guard();const frame=imageFrame(map,b);
 const updates=new Map(paths.map(i=>[i.id,geometry(i.metadata[ANCHOR].segments,frame)]));
 await OBR.scene.items.updateItems(paths,draft=>{for(const i of draft){i.position={x:frame.x,y:frame.y};i.rotation=0;i.scale={x:1,y:1};i.commands=updates.get(i.id);i.attachedTo=id;i.locked=true;i.disableHit=true;i.visible=g.enabled&&map.visible!==false}});guard();cache.set(id,sig)
 }}
export async function activeFrames(g){if(!g?.anchorVersion)return [];const all=await OBR.scene.items.getItems(g.mapIds);const out=[];for(const {id,frame:original} of g.originalFrames){const i=all.find(x=>x.id===id);if(!i||i.visible===false)continue;const b=await OBR.scene.items.getItemBounds([id]);out.push({original,current:imageFrame(i,b)})}return out}
export function calibratedDistance(a,b,g,frames){const f=frames.find(f=>containsMap(a,f.current)&&containsMap(b,f.current));return f?distance(rebasePoint(a,f.current,f.original),rebasePoint(b,f.current,f.original),g):distance(a,b,g)}
export async function snapItems(ids,s){if(!s?.enabled||!valid(s))throw Error("Active la grille calibrée.");const frames=await activeFrames(s),items=await OBR.scene.items.getItems(ids),targets=new Map();for(const i of items){if(i.type!=="IMAGE"||!["CHARACTER","MOUNT","PROP"].includes(i.layer)||i.locked||i.attachedTo)continue;const b=await OBR.scene.items.getItemBounds([i.id]),p={x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2};const f=frames.find(f=>containsMap(p,f.current));if(s.anchorVersion&&!f)continue;const q=f?fromMap(toMap(snapCenter(rebasePoint(p,f.current,f.original),s),f.original),f.current):snapCenter(p,s);targets.set(i.id,{x:i.position.x+q.x-p.x,y:i.position.y+q.y-p.y})}if(!targets.size)throw Error("Sélectionne un token indépendant et déverrouillé sur une carte quadrillée.");await OBR.scene.items.updateItems([...targets.keys()],draft=>{for(const i of draft)i.position=targets.get(i.id)});return targets.size}
