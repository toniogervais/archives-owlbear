import OBR,{buildPath,Command} from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {valid,extent} from "./math.js";
export {OBR};
export const KEY="fr.toniogervais.calibrateur/v1",UNDO=KEY+"/undo",LOCAL=KEY+"/preview",TOOL=KEY+"/tool",MODE=TOOL+"/adjust";
export const isMap=i=>i.layer==="MAP"&&i.type==="IMAGE";
export const isToken=i=>i.type==="IMAGE"&&["CHARACTER","MOUNT","PROP"].includes(i.layer);
export async function state(){return (await OBR.scene.getMetadata())[KEY]||null}
export async function write(s){await OBR.scene.setMetadata({[KEY]:s})}
export async function localItems(){return OBR.scene.local.getItems(i=>!!i.metadata?.[LOCAL])}
function commands(s,b,kind){const a=[],line=(x,y,X,Y)=>a.push([Command.MOVE,x,y],[Command.LINE,X,Y]);const q=s.size/2;
if(kind==="cell"){line(-q,-q,q,-q);line(q,-q,q,q);line(q,q,-q,q);line(-q,q,-q,-q);const h=s.size*.035;for(const x of [-q,q])for(const y of [-q,q]){line(x-h,y,x+h,y);line(x,y-h,x,y+h)}}
else{const e=extent(s,b);for(let i=e.l;i<=e.r;i++)line(i*s.size-q,e.t*s.size-q,i*s.size-q,e.b*s.size-q);for(let i=e.t;i<=e.b;i++)line(e.l*s.size-q,i*s.size-q,e.r*s.size-q,i*s.size-q)}
return a}
export async function render(s,b){const old=await localItems();const wanted=valid(s)&&s.active?(s.full?["grid","cell"]:["cell"]):[];const remove=old.filter(i=>!wanted.includes(i.metadata[LOCAL]));if(remove.length)await OBR.scene.local.deleteItems(remove.map(i=>i.id));for(const kind of wanted){const cmd=commands(s,b,kind),existing=old.find(i=>i.metadata[LOCAL]===kind);if(existing){await OBR.scene.local.updateItems([existing.id],items=>{for(const i of items){i.commands=cmd;i.position={x:s.x,y:s.y};i.scale={x:1,y:1}}})}else{const item=buildPath().name("Calibration "+kind).layer("GRID").position({x:s.x,y:s.y}).commands(cmd).strokeColor(kind==="cell"?"#ffd24a":"#48e0ef").strokeOpacity(kind==="cell"?1:.65).strokeWidth(kind==="cell"?4:2).fillOpacity(0).locked(true).disableHit(true).metadata({[LOCAL]:kind}).build();await OBR.scene.local.addItems([item])}}}
