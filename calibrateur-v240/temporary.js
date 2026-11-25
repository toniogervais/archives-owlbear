import OBR,{buildImage} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,imageFrame,anchoredSegments,pixelSegments} from "./math.js?v=231";
export const SESSION="fr.toniogervais.calibrateur/v24/session",TEMP=SESSION+"/image",LAST=SESSION+"/undo";
const copy=o=>JSON.parse(JSON.stringify(o));
export const geometry=i=>({position:copy(i.position),scale:copy(i.scale),rotation:i.rotation,grid:copy(i.grid)});
export function closeGeometry(a,b){if(!a||!b)return false;const n=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<Math.max(.00001,Math.abs(y)*.000001);return n(a.rotation,b.rotation)&&n(a.grid?.dpi,b.grid?.dpi)&&["x","y"].every(k=>n(a.position[k],b.position[k])&&n(a.scale[k],b.scale[k])&&n(a.grid?.offset?.[k],b.grid?.offset?.[k]))}
export function temporaryOwned(i,id){return i?.type==="IMAGE"&&typeof i.metadata?.[TEMP]?.session==="string"&&(!id||i.metadata[TEMP].session===id)}
export async function session(api=OBR){return (await api.scene.getMetadata())[SESSION]||null}
export async function makeReference(item,b,s){
 if(!valid(s))throw Error("Case de calibration invalide.");
 const w=item.image.width,h=item.image.height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0||w>16384||h>16384||w*h>64000000)throw Error("Carte trop grande pour créer le support temporaire.");
 const frame=imageFrame(item,b),segments=pixelSegments(anchoredSegments(s,b,frame),w,h);if(!segments.length)throw Error("Aucune ligne sur la carte.");
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 try{const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas indisponible.");ctx.strokeStyle="#171717";ctx.lineWidth=Math.max(3,4*Math.sqrt(w*h/(frame.w*frame.h)));ctx.beginPath();for(const [a,b] of segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}ctx.stroke();ctx.strokeStyle="#ffee00";ctx.lineWidth=Math.max(1,ctx.lineWidth/2);ctx.stroke();const url=canvas.toDataURL("image/png");if(!url.startsWith("data:image/png")||url.length>1500000)throw Error("Le support dépasse la taille de sécurité. Utilise une carte plus petite.");return {url,width:w,height:h,mime:"image/png"}}finally{canvas.width=canvas.height=1}
}
export async function prepare(s,mapId,guard=()=>{},api=OBR,render=makeReference,builder=buildImage){
 if(await session(api))throw Error("Termine ou annule l’alignement en cours.");guard();
 const [item]=await api.scene.items.getItems([mapId]);guard();if(!item||item.type!=="IMAGE"||item.layer!=="MAP"||temporaryOwned(item))throw Error("Choisis une carte du calque MAP.");
 if(item.attachedTo)throw Error("La carte est attachée à un autre objet. Détache-la avant l’alignement.");
 const b=await api.scene.items.getItemBounds([mapId]);guard();const image=await render(item,b,s);guard();
 const id=crypto.randomUUID(),original=geometry(item),temp=builder(image,copy(item.grid)).name("CALIBRATION TEMPORAIRE — "+item.name).layer("MAP").position(copy(item.position)).scale(copy(item.scale)).rotation(item.rotation).locked(false).visible(true).zIndex(Math.max(Date.now(),(item.zIndex||0)+1)).metadata({[TEMP]:{session:id,originalId:mapId}}).build();
 const record={id,originalId:mapId,tempId:temp.id,original,sourceUrl:item.image.url,sourceWidth:item.image.width,sourceHeight:item.image.height,calibration:{x:s.x,y:s.y,size:s.size},phase:"align"};
 // Persist recovery data before creating the temporary item.
 await api.scene.setMetadata({[SESSION]:record});guard();
 try{await api.scene.items.addItems([temp]);guard();const [created]=await api.scene.items.getItems([temp.id]);guard();if(!temporaryOwned(created,id))throw Error("Owlbear n’a pas confirmé le support temporaire.");await api.player.select([temp.id],true);guard();return record}catch(e){try{guard();const [created]=await api.scene.items.getItems([temp.id]);guard();if(temporaryOwned(created,id))await api.scene.items.deleteItems([temp.id]);guard();await api.scene.setMetadata({[SESSION]:null})}catch{}throw e}
}
export async function finish(guard=()=>{},api=OBR){
 const q=await session(api);guard();if(!q)throw Error("Aucun alignement en cours.");
 const all=await api.scene.items.getItems([q.originalId,q.tempId]);guard();const original=all.find(i=>i.id===q.originalId),temp=all.find(i=>i.id===q.tempId);
 if(!original||original.type!=="IMAGE"||original.image.url!==q.sourceUrl||original.image.width!==q.sourceWidth||original.image.height!==q.sourceHeight)throw Error("La carte originale a changé. Annule et recommence.");
 if(!temporaryOwned(temp,q.id)||temp.metadata[TEMP].originalId!==original.id)throw Error("Support temporaire absent. Annule et recommence.");
 const target=geometry(temp),before=geometry(original);if(!closeGeometry(before,q.original)&&!closeGeometry(before,target))throw Error("La carte originale a été modifiée pendant l’alignement. Annule et recommence.");
 if(closeGeometry(target,q.original))throw Error("Aucun réglage détecté sur le support. Utilise Align Image puis confirme le réglage dans Owlbear.");
 await api.scene.setMetadata({[LAST]:{originalId:original.id,sourceUrl:q.sourceUrl,before:q.original,after:target}});guard();
 await api.scene.items.updateItems([original],draft=>{for(const i of draft)Object.assign(i,copy(target))});guard();
 const [check]=await api.scene.items.getItems([original.id]);guard();if(!check||!closeGeometry(geometry(check),target))throw Error("Owlbear n’a pas confirmé la transformation. Le support est conservé pour réessayer.");
 await api.scene.items.deleteItems([temp.id]);guard();await api.scene.setMetadata({[SESSION]:null});guard();await api.player.select([original.id],true);return target
}
export async function cancel(guard=()=>{},api=OBR){
 const q=await session(api);guard();if(!q)return;const all=await api.scene.items.getItems([q.tempId]);guard();const temp=all.find(i=>temporaryOwned(i,q.id));if(temp){const attached=await api.scene.items.getItemAttachments([temp.id]);guard();if(attached.length)throw Error("Détache les objets du support temporaire avant de l’effacer.");await api.scene.items.deleteItems([temp.id]);guard()}await api.scene.setMetadata({[SESSION]:null});guard()
}
export async function undo(guard=()=>{},api=OBR){const m=await api.scene.getMetadata();guard();const q=m[LAST];if(!q)throw Error("Aucun alignement à annuler.");const [i]=await api.scene.items.getItems([q.originalId]);guard();if(!i||i.image?.url!==q.sourceUrl||!closeGeometry(geometry(i),q.after))throw Error("La carte a changé depuis l’alignement.");await api.scene.items.updateItems([i],draft=>{for(const v of draft)Object.assign(v,copy(q.before))});guard();await api.scene.setMetadata({[LAST]:null});guard()}
