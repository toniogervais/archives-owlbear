import OBR,{buildImageUpload} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {imageFrame,anchoredSegments,pixelSegments} from "./math.js?v=230";
export async function prepareMaps(s,ids,guard=()=>{}){
 const all=await OBR.scene.items.getItems(ids);guard();const list=[];
 for(const id of ids){const item=all.find(i=>i.id===id&&i.type==="IMAGE");if(!item)throw Error("Carte introuvable.");if(!/^image\/(png|jpeg|webp|bmp|avif)$/i.test(item.image.mime||""))throw Error("Image fixe requise : "+(item.name||id)+". Les cartes animées ne sont pas aplaties.");
 const bounds=await OBR.scene.items.getItemBounds([id]);guard();const frame=imageFrame(item,bounds),segments=anchoredSegments(s,bounds,frame);if(!segments.length)throw Error("Aucune ligne sur "+item.name);
 list.push({item,frame,segments})}return list
}
export async function renderMap(entry,s,sourceFile=null){
 const {item,frame,segments}=entry;let source;try{if(sourceFile)source=sourceFile;else{const response=await fetch(item.image.url,{mode:"cors",credentials:"omit"});if(!response.ok)throw Error("HTTP "+response.status);source=await response.blob()}}catch(e){throw Error("Lecture de "+(item.name||"la carte")+" impossible. Utilise le fichier image original dans le panneau d’export.")}
 let bitmap;try{bitmap=await createImageBitmap(source)}catch{throw Error("Impossible de décoder l’image de la carte.")}
 const w=bitmap.width,h=bitmap.height;if(w!==item.image.width||h!==item.image.height){bitmap.close();throw Error("Le fichier ne correspond pas aux dimensions de la carte ("+item.image.width+" × "+item.image.height+").")}
 if(w>16384||h>16384||w*h>64000000){bitmap.close();throw Error("Carte trop grande pour une incrustation sûre dans le navigateur. Aucune réduction automatique n’est effectuée.")}
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");if(!ctx){bitmap.close();throw Error("Canvas indisponible.")}
 try{ctx.drawImage(bitmap,0,0);ctx.strokeStyle=s.color||"#ffffff";ctx.globalAlpha=s.opacity??.65;ctx.lineWidth=Math.max(1,(s.width||2)*Math.sqrt(w*h/(frame.w*frame.h)));ctx.beginPath();for(const [a,b] of pixelSegments(segments,w,h)){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}ctx.stroke();const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Export PNG impossible.")),"image/png"));const name=(item.name||"Carte").replace(/[\\/:*?"<>|]/g,"_").replace(/\.(png|jpg|jpeg|webp)$/i,"")+" - grille incrustée.png";return {file:new File([blob],name,{type:"image/png"}),item}}finally{bitmap.close();canvas.width=canvas.height=1}
}
export async function uploadBaked(result){if(!OBR.isReady)throw Error("SDK non connecté.");const {file,item}=result;const upload=buildImageUpload(file).name(file.name).grid(item.grid).scale(item.scale).rotation(item.rotation).locked(true).build();await OBR.assets.uploadImages([upload],"MAP")}
export function downloadBaked(result){const url=URL.createObjectURL(result.file),a=document.createElement("a");a.href=url;a.download=result.file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
