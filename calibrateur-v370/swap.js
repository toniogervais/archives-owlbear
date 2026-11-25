import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,imageFrame,toMap} from "./math.js?v=231";
export const KEY="fr.toniogervais.calibrateur/v26/swap",TAG=KEY+"/active",OLD="fr.toniogervais.calibrateur/v24/session";
const copy=o=>JSON.parse(JSON.stringify(o)),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const geometry=i=>({position:copy(i.position),scale:copy(i.scale),rotation:i.rotation,grid:copy(i.grid)});
const boundsEqual=(a,b)=>["min","max"].every(k=>["x","y"].every(j=>Math.abs(a[k][j]-b[k][j])<.2));
export function pixelCorners(s,item,frame){if(!valid(s))throw Error("Case invalide.");const q=s.size/2;return [[-q,-q],[q,-q],[q,q],[-q,q]].map(([dx,dy])=>{const p=toMap({x:s.x+dx,y:s.y+dy},frame);return {x:(p.x+.5)*item.image.width,y:(p.y+.5)*item.image.height}})}
export function inside(points,w,h){return points.every(p=>p.x>=-.00001&&p.x<=w+.00001&&p.y>=-.00001&&p.y<=h+.00001)}
export async function getSession(api=OBR){return (await api.scene.getMetadata())[KEY]||null}
export async function render(item,points,file=null){
 const w=item.image.width,h=item.image.height;
 if(w>16384||h>16384||w*h>64000000)throw Error("Carte trop grande pour le support temporaire.");
 let blob=file;if(!blob){try{const r=await fetch(item.image.url,{mode:"cors",credentials:"omit",signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error("HTTP "+r.status);blob=await r.blob()}catch{throw Error("Lecture de la carte refusée. Sélectionne le fichier original sous le bouton.")}}
 const video=/^video\//.test(item.image.mime)||/webm|mp4/i.test(item.image.mime)||/\.webm(?:$|\?)/i.test(item.image.url);
 let source=null,url=null;const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 try{
 if(video){source=document.createElement("video");source.muted=true;source.playsInline=true;source.preload="auto";url=URL.createObjectURL(blob);await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error("Lecture vidéo impossible.")),20000);source.onloadeddata=()=>{clearTimeout(timer);ok()};source.onerror=()=>{clearTimeout(timer);no(Error("Vidéo non décodable."))};source.src=url});}
 else source=await createImageBitmap(blob);
 const sw=video?source.videoWidth:source.width,sh=video?source.videoHeight:source.height;if(sw!==w||sh!==h)throw Error("Le fichier ne correspond pas aux dimensions de la carte.");
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas indisponible.");ctx.drawImage(source,0,0,w,h);const side=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle="#171717";ctx.lineWidth=Math.max(4,side*.045);ctx.stroke();ctx.strokeStyle="#ffff00";ctx.lineWidth=Math.max(2,side*.022);ctx.stroke();
 for(const quality of [.82,.65,.45,.25,.12]){const data=canvas.toDataURL("image/jpeg",quality);if(data.startsWith("data:image/jpeg")&&data.length<=700000)return {url:data,width:w,height:h,mime:"image/jpeg"}}
 throw Error("Copie temporaire trop lourde. Aucun changement effectué.");
 }finally{if(video&&source){source.pause();source.removeAttribute("src");source.load()}else source?.close?.();if(url)URL.revokeObjectURL(url);canvas.width=canvas.height=1}
}
export async function prepare(s,id,file,guard=()=>{},api=OBR,make=render){
 if(await getSession(api))throw Error("Un alignement est déjà en cours.");guard();
 const [item]=await api.scene.items.getItems([id]);guard();if(item?.type!=="IMAGE"||item.layer!=="MAP"||item.metadata?.[TAG])throw Error("Carte originale introuvable.");
 const before=await api.scene.items.getItemBounds([id]);guard();const frame=imageFrame(item,before),points=pixelCorners(s,item,frame);
 if(!inside(points,item.image.width,item.image.height))throw Error("Place la case entièrement sur la carte choisie.");
 const image=await make(item,points,file);guard();const [fresh]=await api.scene.items.getItems([id]);guard();
 if(!fresh||!eq(fresh.image,item.image)||!eq(geometry(fresh),geometry(item)))throw Error("La carte a changé durant la préparation.");
 const rec={id,nonce:crypto.randomUUID(),image:copy(item.image),geometry:geometry(item),locked:item.locked,temporary:true};
 await api.scene.setMetadata({[KEY]:rec});guard();
 try{await api.scene.items.updateItems([fresh],draft=>{for(const i of draft){i.image=copy(image);i.locked=false;i.metadata={...i.metadata,[TAG]:rec.nonce}}});guard();
 const [check]=await api.scene.items.getItems([id]);guard();if(check?.metadata?.[TAG]!==rec.nonce||!eq(check.image,image))throw Error("Owlbear a refusé la substitution d’image.");
 const after=await api.scene.items.getItemBounds([id]);guard();if(!boundsEqual(before,after))throw Error("Owlbear a changé la géométrie pendant la substitution.");
 await api.player.select([id],true);guard();return rec
 }catch(e){try{guard();await restore(true,guard,api)}catch{}throw e}
}
export async function restore(cancel=false,guard=()=>{},api=OBR){
 const rec=await getSession(api);guard();if(!rec)return false;
 const [item]=await api.scene.items.getItems([rec.id]);guard();if(!item)throw Error("Carte introuvable : sauvegarde de récupération conservée.");
 if(item.metadata?.[TAG]!==rec.nonce){if(eq(item.image,rec.image)){await api.scene.setMetadata({[KEY]:null});guard();return true}throw Error("La carte a été remplacée par un autre outil. Récupération conservée.")}
 const aligned=geometry(item);await api.scene.items.updateItems([item],draft=>{for(const i of draft){i.image=copy(rec.image);i.locked=rec.locked;if(cancel)Object.assign(i,copy(rec.geometry));delete i.metadata[TAG]}});guard();
 const [check]=await api.scene.items.getItems([rec.id]);guard();if(!check||!eq(check.image,rec.image)||!eq(geometry(check),cancel?rec.geometry:aligned))throw Error("Restauration non confirmée. Réessaie.");
 await api.scene.setMetadata({[KEY]:null});guard();return true
}
export async function clearLegacy(guard=()=>{},api=OBR){
 const meta=await api.scene.getMetadata();guard();const old=meta[OLD];if(!old)return;
 const all=await api.scene.items.getItems();guard();const temp=all.find(i=>i.id===old.tempId&&i.type==="IMAGE"&&i.metadata?.[OLD+"/image"]?.session===old.id);
 if(temp){if(all.some(i=>i.attachedTo===temp.id))throw Error("Une ancienne case possède des objets attachés.");await api.scene.items.deleteItems([temp.id]);guard()}
 await api.scene.setMetadata({[OLD]:null});guard();
}
