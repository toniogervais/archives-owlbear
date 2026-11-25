import OBR,{buildImage} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,imageFrame,anchoredSegments,pixelSegments} from "./math.js?v=231";
export const SESSION="fr.toniogervais.calibrateur/v24/session",TEMP=SESSION+"/image",LAST=SESSION+"/undo";
const copy=o=>JSON.parse(JSON.stringify(o));
export const geometry=i=>({position:copy(i.position),scale:copy(i.scale),rotation:i.rotation,grid:copy(i.grid)});
export function closeGeometry(a,b){if(!a||!b)return false;const n=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<Math.max(.00001,Math.abs(y)*.000001);return n(a.rotation,b.rotation)&&n(a.grid?.dpi,b.grid?.dpi)&&["x","y"].every(k=>n(a.position[k],b.position[k])&&n(a.scale[k],b.scale[k])&&n(a.grid?.offset?.[k],b.grid?.offset?.[k]))}
export function temporaryOwned(i,id){return i?.type==="IMAGE"&&typeof i.metadata?.[TEMP]?.session==="string"&&(!id||i.metadata[TEMP].session===id)}
export async function session(api=OBR){return (await api.scene.getMetadata())[SESSION]||null}
export function frameFrom(i,b){return imageFrame(i,b)}
export function transformFromSquare(original,before,after){
 const k=after.w/before.w,ky=after.h/before.h;if(!Number.isFinite(k)||k<=0||Math.abs(k-ky)>Math.max(.0001,k*.005))throw Error("Alignement non proportionnel : conserve une case carrée.");
 if(before.flipX!==after.flipX||before.flipY!==after.flipY)throw Error("Ne retourne pas la case de calibration.");
 const r=after.rotation-before.rotation,a=r*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),dx=original.position.x-before.x,dy=original.position.y-before.y;
 return {...copy(original),position:{x:after.x+k*(c*dx-sn*dy),y:after.y+k*(sn*dx+c*dy)},scale:{x:original.scale.x*k,y:original.scale.y*k},rotation:original.rotation+r};
}
export async function chooseReferenceMap(s,ids,guard=()=>{},api=OBR){
 const items=await api.scene.items.getItems(ids);guard();const candidates=[];
 for(const i of items){if(i.type!=="IMAGE"||i.layer!=="MAP"||temporaryOwned(i)||i.visible===false)continue;const b=await api.scene.items.getItemBounds([i.id]);guard();const fr=imageFrame(i,b);const a=fr.rotation*Math.PI/180,dx=s.x-fr.x,dy=s.y-fr.y;if(Math.abs(Math.cos(a)*dx+Math.sin(a)*dy)<=fr.w/2&&Math.abs(-Math.sin(a)*dx+Math.cos(a)*dy)<=fr.h/2)candidates.push(i)}
 if(!candidates.length)throw Error("La case doit être placée sur une carte cochée.");candidates.sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));return candidates[0].id
}
export async function prepare(s,mapId,guard=()=>{},api=OBR,builder=buildImage){
 if(!valid(s))throw Error("Case de calibration invalide.");if(await session(api))throw Error("Annule d’abord le support précédent.");guard();
 const [item]=await api.scene.items.getItems([mapId]);guard();if(!item||item.type!=="IMAGE"||item.layer!=="MAP"||temporaryOwned(item)||item.attachedTo)throw Error("Choisis une carte indépendante.");
 const dpi=await api.scene.grid.getDpi();guard();if(!(dpi>0))throw Error("DPI natif indisponible.");
 const id=crypto.randomUUID(),original=geometry(item),scale=s.size/224;
 const image={url:new URL("case.png",location.href).href,width:256,height:256,mime:"image/png"};
 const temp=builder(image,{dpi,offset:{x:128,y:128}}).name("CASE DE CALIBRATION — "+item.name).layer("MAP").position({x:s.x,y:s.y}).scale({x:scale,y:scale}).rotation(0).locked(false).visible(true).zIndex(Math.max(Date.now(),(item.zIndex||0)+1)).metadata({[TEMP]:{session:id,originalId:mapId}}).build();
 const record={id,kind:"single",originalId:mapId,tempId:temp.id,original,sourceUrl:item.image.url,sourceWidth:item.image.width,sourceHeight:item.image.height,calibration:{x:s.x,y:s.y,size:s.size},phase:"creating"};
 await api.scene.setMetadata({[SESSION]:record});guard();
 try{
 await api.scene.items.addItems([temp]);guard();let [created]=await api.scene.items.getItems([temp.id]);guard();if(!temporaryOwned(created,id))throw Error("Owlbear n’a pas accepté la case temporaire.");
 let fr=frameFrom(created,await api.scene.items.getItemBounds([temp.id]));guard();const k=s.size/(fr.w*224/256);if(!Number.isFinite(k)||k<=0)throw Error("Dimensions de la case non confirmées.");
 await api.scene.items.updateItems([created],draft=>{for(const i of draft){i.scale={x:i.scale.x*k,y:i.scale.y*k};i.position={x:i.position.x+(s.x-fr.x)*k,y:i.position.y+(s.y-fr.y)*k}}});guard();
 [created]=await api.scene.items.getItems([temp.id]);guard();fr=frameFrom(created,await api.scene.items.getItemBounds([temp.id]));guard();
 // Correct center after scaling when the host uses a different image pivot.
 if(Math.hypot(fr.x-s.x,fr.y-s.y)>.01){await api.scene.items.updateItems([created],draft=>{for(const i of draft)i.position={x:i.position.x+s.x-fr.x,y:i.position.y+s.y-fr.y}});guard();[created]=await api.scene.items.getItems([temp.id]);guard();fr=frameFrom(created,await api.scene.items.getItemBounds([temp.id]));guard()}
 if(Math.abs(fr.w*224/256-s.size)>Math.max(.1,s.size*.01)||Math.hypot(fr.x-s.x,fr.y-s.y)>Math.max(.1,s.size*.01))throw Error("La position ou la taille de la case n’a pas été confirmée.");
 record.initialFrame=fr;record.phase="align";await api.scene.setMetadata({[SESSION]:record});guard();
 await api.player.select([temp.id],true);guard();return record
 }catch(e){try{guard();const [created]=await api.scene.items.getItems([temp.id]);guard();if(temporaryOwned(created,id))await api.scene.items.deleteItems([temp.id]);guard();await api.scene.setMetadata({[SESSION]:null})}catch{}throw e}
}
export async function finish(guard=()=>{},api=OBR){
 const q=await session(api);guard();if(!q)throw Error("Aucun alignement en cours.");if(q.kind!=="single"||!q.initialFrame)throw Error("Ancien support : clique sur Annuler puis prépare la case.");
 const all=await api.scene.items.getItems([q.originalId,q.tempId]);guard();const original=all.find(i=>i.id===q.originalId),temp=all.find(i=>i.id===q.tempId);
 if(!original||original.type!=="IMAGE"||original.image.url!==q.sourceUrl||original.image.width!==q.sourceWidth||original.image.height!==q.sourceHeight)throw Error("La carte originale a changé. Annule et recommence.");
 if(!temporaryOwned(temp,q.id)||temp.metadata[TEMP].originalId!==original.id)throw Error("Case temporaire introuvable.");
 const attached=await api.scene.items.getItemAttachments([temp.id]);guard();if(attached.length)throw Error("Détache les objets de la case temporaire avant de valider.");
 const after=frameFrom(temp,await api.scene.items.getItemBounds([temp.id]));guard();const target=transformFromSquare(q.original,q.initialFrame,after),before=geometry(original);
 if(!closeGeometry(before,q.original)&&!closeGeometry(before,target))throw Error("La carte originale a été modifiée pendant l’alignement.");
 await api.scene.setMetadata({[LAST]:{originalId:original.id,sourceUrl:q.sourceUrl,before:q.original,after:target}});guard();
 await api.scene.items.updateItems([original],draft=>{for(const i of draft)Object.assign(i,copy(target))});guard();
 const [check]=await api.scene.items.getItems([original.id]);guard();if(!check||!closeGeometry(geometry(check),target))throw Error("Transformation non confirmée. La case est conservée.");
 await api.scene.items.deleteItems([temp.id]);guard();await api.scene.setMetadata({[SESSION]:null});guard();await api.player.select([original.id],true);return target
}
export async function cancel(guard=()=>{},api=OBR){
 const q=await session(api);guard();if(!q)return;const all=await api.scene.items.getItems([q.tempId]);guard();const temp=all.find(i=>temporaryOwned(i,q.id));if(temp){const attached=await api.scene.items.getItemAttachments([temp.id]);guard();if(attached.length)throw Error("Détache les objets du support temporaire avant de l’effacer.");await api.scene.items.deleteItems([temp.id]);guard()}await api.scene.setMetadata({[SESSION]:null});guard()
}
export async function undo(guard=()=>{},api=OBR){const m=await api.scene.getMetadata();guard();const q=m[LAST];if(!q)throw Error("Aucun alignement à annuler.");const [i]=await api.scene.items.getItems([q.originalId]);guard();if(!i||i.image?.url!==q.sourceUrl||!closeGeometry(geometry(i),q.after))throw Error("La carte a changé depuis l’alignement.");await api.scene.items.updateItems([i],draft=>{for(const v of draft)Object.assign(v,copy(q.before))});guard();await api.scene.setMetadata({[LAST]:null});guard()}
