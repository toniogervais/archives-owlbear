import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,imageFrame} from "./math.js?v=231";
import {geometry,closeGeometry,LAST,temporaryOwned} from "./temporary.js";
const near=(a,b)=>Math.abs(a-b)<=Math.max(.02,Math.abs(b)*.00001);
export function targetGeometry(original,s,dpi,corner){if(!valid(s)||!Number.isFinite(dpi)||dpi<=0||!Number.isFinite(corner.x)||!Number.isFinite(corner.y))throw Error("Calibration invalide.");const k=dpi/s.size;if(k<.01||k>100)throw Error("Rapport de calibration trop important.");const center={x:corner.x+dpi/2,y:corner.y+dpi/2};return {k,center,target:{...original,position:{x:center.x+k*(original.position.x-s.x),y:center.y+k*(original.position.y-s.y)},scale:{x:original.scale.x*k,y:original.scale.y*k}}}}
export async function alignDirect(s,id,guard=()=>{},api=OBR){
 const [type,dpi,all]=await Promise.all([api.scene.grid.getType(),api.scene.grid.getDpi(),api.scene.items.getItems([id])]);guard();if(type!=="SQUARE")throw Error("Ce calibrateur nécessite une grille carrée.");
 const item=all[0];if(!item||item.type!=="IMAGE"||item.layer!=="MAP"||item.attachedTo||temporaryOwned(item))throw Error("Carte indépendante introuvable.");
 const b=await api.scene.items.getItemBounds([id]);guard();const frame=imageFrame(item,b);
 const original=geometry(item),corner=await api.scene.grid.snapPosition({x:s.x-dpi/2,y:s.y-dpi/2},1,true,false);guard();const {k,center,target}=targetGeometry(original,s,dpi,corner);
 const [fresh]=await api.scene.items.getItems([id]);guard();if(!fresh||fresh.image.url!==item.image.url||!closeGeometry(geometry(fresh),original))throw Error("La carte a changé. Recommence.");
 // Save rollback before editing the original. No image replacement or extra objects.
 await api.scene.setMetadata({[LAST]:{originalId:id,sourceUrl:item.image.url,before:original,after:target}});guard();
 try{await api.scene.items.updateItems([id],draft=>{for(const i of draft){i.position=target.position;i.scale=target.scale}});guard();
 const [check]=await api.scene.items.getItems([id]);guard();if(!check||!closeGeometry(geometry(check),target))throw Error("Owlbear n’a pas confirmé le changement.");
 const after=imageFrame(check,await api.scene.items.getItemBounds([id]));guard();
 const expected={x:center.x+k*(frame.x-s.x),y:center.y+k*(frame.y-s.y),w:frame.w*k,h:frame.h*k};
 // Verify actual scene bounds as well as persisted transform.
 if(!near(after.x,expected.x)||!near(after.y,expected.y)||!near(after.w,expected.w)||!near(after.h,expected.h))throw Error("Le rendu de la carte ne correspond pas au calcul.");
 return {k,center,dpi}
 }catch(err){try{guard();await api.scene.items.updateItems([id],draft=>{for(const i of draft){i.position=original.position;i.scale=original.scale}});guard();await api.scene.setMetadata({[LAST]:null})}catch{}throw err}
}
