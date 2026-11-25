import OBR,{buildImageUpload} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {calculate} from "./numeric.js";
export function settings(s,item,frame,sceneDpi){
 const v=calculate(s,item,frame,sceneDpi);
 if(!v.inside)throw Error("Place toute la case à l'intérieur de la carte.");
 if(v.rotated)throw Error("La carte est tournée : remets-la à un angle droit pour ce premier essai.");
 if(v.anisotropic)throw Error("La carte est déformée : rétablis ses proportions.");
 const dpi=(v.dpiX+v.dpiY)/2;
 if(!Number.isFinite(dpi)||dpi<1)throw Error("DPI invalide.");
 return {dpi,offset:{x:v.phaseX,y:v.phaseY},rotation:item.rotation||0,scale:{x:Math.sign(item.scale.x)||1,y:Math.sign(item.scale.y)||1}};
}
async function dimensions(blob,mime){
 if(/video|webm|mp4/i.test(mime)){
 const v=document.createElement("video"),u=URL.createObjectURL(blob);
 try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Impossible de lire les dimensions vidéo.")),20000);v.preload="metadata";v.muted=true;v.onloadedmetadata=()=>{clearTimeout(timer);resolve({width:v.videoWidth,height:v.videoHeight})};v.onerror=()=>{clearTimeout(timer);reject(Error("Vidéo illisible."))};v.src=u})}
 finally{v.removeAttribute("src");v.load();URL.revokeObjectURL(u)}
 }
 const b=await createImageBitmap(blob);try{return {width:b.width,height:b.height}}finally{b.close()}
}
export async function makeUpload(item,grid,source,guard=()=>{},status=()=>{},api=OBR,builder=buildImageUpload){
 let blob=source;if(!blob){status("Lecture du fichier original…");try{const r=await fetch(item.image.url,{mode:"cors",signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error("HTTP "+r.status);blob=await r.blob()}catch{throw Error("Accès au fichier refusé. Choisis le fichier original sous le bouton.")}}
 guard();const mime=source?.type||item.image.mime||blob.type;
 if(!/^(image|video)\//.test(mime))throw Error("Type de fichier inconnu.");
 const d=await dimensions(blob,mime);guard();if(d.width!==item.image.width||d.height!==item.image.height)throw Error("Le fichier ne correspond pas aux dimensions de la carte.");
 const ext=mime.includes("webm")?"webm":mime.includes("mp4")?"mp4":mime.includes("png")?"png":mime.includes("webp")?"webp":mime.includes("jpeg")?"jpg":mime.includes("gif")?"gif":mime.split("/")[1];
 const name=(item.name||"Carte").replace(/\.[a-z0-9]{2,5}$/i,"")+" — calibrée";
 // Clone the original bytes without decoding/re-encoding the actual file.
 const file=new File([await blob.arrayBuffer()],name+"."+ext,{type:mime});guard();
 const upload=builder(file).name(name).dpi(grid.dpi).offset(grid.offset).scale(grid.scale).rotation(grid.rotation).locked(true).build();
 status("Choisis le dossier dans Owlbear…");await api.assets.uploadImages([upload],"MAP");guard();return grid;
}
