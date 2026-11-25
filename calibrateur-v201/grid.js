import OBR,{buildPath,Command} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,gridSegments,snapCenter} from "./math.js?v=201";
export const GRID="fr.toniogervais.calibrateur/v2/grid",MARK=GRID+"/path";
export const getGrid=async()=> (await OBR.scene.getMetadata())[GRID]||null;
export function makePaths(s,b){const seg=gridSegments(s,b),out=[];for(let i=0;i<seg.length;i+=160){const commands=seg.slice(i,i+160).flatMap(([x,y,X,Y])=>[[Command.MOVE,x-s.x,y-s.y],[Command.LINE,X-s.x,Y-s.y]]);out.push(buildPath().name("Grille calibrée").layer("GRID").position({x:s.x,y:s.y}).commands(commands).strokeColor(s.color).strokeOpacity(s.opacity).strokeWidth(s.width).fillOpacity(0).locked(true).disableHit(true).metadata({[MARK]:s.id}).build())}return out}
export async function install(s,b,guard=()=>{}){
 const old=await getGrid(),opacity=await OBR.scene.grid.getOpacity();guard();
 const next={...s,id:crypto.randomUUID(),enabled:true,nativeOpacity:old?.enabled?old.nativeOpacity:opacity};
 const paths=makePaths(next,b);next.ids=paths.map(i=>i.id);let committed=false;
 try{await OBR.scene.items.addItems(paths);guard();const now=await OBR.scene.items.getItems(next.ids);guard();if(now.length!==paths.length)throw Error("La grille n’a pas été confirmée par Owlbear.");
 await OBR.scene.grid.setOpacity(0);guard();
 await OBR.scene.setMetadata({[GRID]:next});committed=true;guard();
 }catch(e){try{guard();if(!committed){await OBR.scene.items.deleteItems(next.ids);await OBR.scene.grid.setOpacity(opacity)}}catch{}throw e}
 if(old?.ids?.length){try{await OBR.scene.items.deleteItems(old.ids)}catch(e){console.warn("Ancienne grille",e)}}
 return next;
}
export async function toggle(s,enabled,guard=()=>{}){if(!s)throw Error("Aucune grille calibrée.");const opacity=await OBR.scene.grid.getOpacity();guard();const found=await OBR.scene.items.getItems(s.ids);guard();if(found.length!==s.ids.length)throw Error("Grille incomplète : applique à nouveau la calibration.");const next={...s,enabled,nativeOpacity:enabled&&!s.enabled?opacity:s.nativeOpacity};try{await OBR.scene.items.updateItems(s.ids,items=>{for(const i of items)if(i.metadata?.[MARK]===s.id)i.visible=enabled});guard();await OBR.scene.grid.setOpacity(enabled?0:(s.nativeOpacity??.5));guard();await OBR.scene.setMetadata({[GRID]:next});guard();return next}catch(e){try{guard();await OBR.scene.items.updateItems(s.ids,items=>{for(const i of items)if(i.metadata?.[MARK]===s.id)i.visible=s.enabled});await OBR.scene.grid.setOpacity(opacity)}catch{}throw e}}
export async function snapItems(ids,s){if(!s?.enabled||!valid(s))throw Error("Active la grille calibrée.");const items=await OBR.scene.items.getItems(ids);const targets=new Map();for(const i of items){if(i.type!=="IMAGE"||!["CHARACTER","MOUNT","PROP"].includes(i.layer)||i.locked||i.attachedTo)continue;const b=await OBR.scene.items.getItemBounds([i.id]);const p={x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2},q=snapCenter(p,s);targets.set(i.id,{x:i.position.x+q.x-p.x,y:i.position.y+q.y-p.y})}if(!targets.size)throw Error("Sélectionne un token indépendant et déverrouillé.");await OBR.scene.items.updateItems([...targets.keys()],draft=>{for(const i of draft)i.position=targets.get(i.id)});return targets.size}
