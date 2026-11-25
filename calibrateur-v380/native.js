import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,imageFrame,toMap,fromMap} from "./math.js?v=231";
import {geometry,closeGeometry,LAST,temporaryOwned} from "./temporary.js";
const copy=o=>JSON.parse(JSON.stringify(o));
export function calculate(s,item,frame,sceneDpi){
 if(!valid(s)||!(sceneDpi>0))throw Error("Calibration invalide.");
 const w=item.image.width,h=item.image.height,px=frame.w/w,py=frame.h/h;
 if(!(px>0&&py>0)||Math.abs(px-py)>Math.max(px,py)*.005)throw Error("Carte déformée : rétablis ses proportions avant le calibrage.");
 const dpi=s.size/((px+py)/2);if(!(dpi>=1&&dpi<=100000))throw Error("Taille de case hors limites.");
 const world={x:s.x-s.size/2,y:s.y-s.size/2},uv=toMap(world,frame),pixel={x:(uv.x+.5)*w,y:(uv.y+.5)*h};
 // Use the pixel corner as the native image pivot. The position is separately snapped to a scene-grid intersection.
 return {dpi,columns:w/dpi,rows:h/dpi,offset:pixel,uv,world,scale:{x:Math.sign(item.scale.x)||1,y:Math.sign(item.scale.y)||1},expectedW:w*sceneDpi/dpi,expectedH:h*sceneDpi/dpi};
}
export async function readCalibration(s,id,guard=()=>{},api=OBR){
 const [type,dpi,items]=await Promise.all([api.scene.grid.getType(),api.scene.grid.getDpi(),api.scene.items.getItems([id])]);guard();
 if(type!=="SQUARE")throw Error("Choisis une grille carrée dans Owlbear.");
 const item=items[0];if(!item||item.type!=="IMAGE"||item.layer!=="MAP"||item.attachedTo||temporaryOwned(item))throw Error("Carte indépendante introuvable.");
 const frame=imageFrame(item,await api.scene.items.getItemBounds([id]));guard();
 const values=calculate(s,item,frame,dpi);return {id,item,frame,values,sceneDpi:dpi,original:geometry(item)};
}
export async function applyNative(q,guard=()=>{},api=OBR){
 const {id,item,values:v,original}=q;const [fresh]=await api.scene.items.getItems([id]);guard();
 if(!fresh||fresh.image.url!==item.image.url||!closeGeometry(geometry(fresh),original))throw Error("La carte a changé : recalcule la case.");
 const corner=await api.scene.grid.snapPosition(v.world,1,true,false);guard();
 if(!(Number.isFinite(corner.x)&&Number.isFinite(corner.y)))throw Error("Intersection native introuvable.");
 const target={...copy(original),position:copy(corner),scale:copy(v.scale),grid:{...copy(original.grid),dpi:v.dpi,offset:copy(v.offset)}};
 await api.scene.setMetadata({[LAST]:{originalId:id,sourceUrl:item.image.url,before:original,after:target}});guard();
 try{
 await api.scene.items.updateItems([id],draft=>{for(const i of draft)Object.assign(i,copy(target))});guard();
 const [check]=await api.scene.items.getItems([id]);guard();if(!check||!closeGeometry(geometry(check),target))throw Error("Owlbear n’a pas confirmé les paramètres natifs.");
 const after=imageFrame(check,await api.scene.items.getItemBounds([id]));guard();
 const anchor=fromMap(v.uv,after),tol=Math.max(.15,q.sceneDpi*.002);
 if(Math.abs(after.w-v.expectedW)>tol||Math.abs(after.h-v.expectedH)>tol||Math.hypot(anchor.x-corner.x,anchor.y-corner.y)>tol)throw Error("Owlbear a rendu un résultat différent : utilise les valeurs manuelles affichées.");
 return {corner,dpi:q.sceneDpi,values:v}
 }catch(e){try{guard();await api.scene.items.updateItems([id],draft=>{for(const i of draft)Object.assign(i,copy(original))});guard();await api.scene.setMetadata({[LAST]:null})}catch{}throw e}
}
