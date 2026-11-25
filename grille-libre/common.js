import OBR, {buildPath, Command} from "https://esm.sh/@owlbear-rodeo/sdk@3";
export {OBR};
export const KEY="fr.toniogervais.grille-libre/v1";
export const TOOL="fr.toniogervais.grille-libre/tool", MOVE=TOOL+"/move", SIZE=TOOL+"/size";
export const defaults={cols:20,rows:15,width:3000,height:2250,color:"#ffffff",opacity:0.55,thickness:2,x:0,y:0,rotation:0,shown:true,locked:false};
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function number(v,f,min,max){return v===""||!Number.isFinite(Number(v))?f:clamp(Number(v),min,max)}
export function clean(s){const d=defaults;return {cols:Math.round(number(s.cols,d.cols,1,100)),rows:Math.round(number(s.rows,d.rows,1,100)),width:number(s.width,d.width,1,100000),height:number(s.height,d.height,1,100000),color:/^#[0-9a-f]{6}$/i.test(s.color)?s.color:d.color,opacity:number(s.opacity,d.opacity,0.01,1),thickness:number(s.thickness,d.thickness,0.1,30),x:number(s.x,d.x,-10000000,10000000),y:number(s.y,d.y,-10000000,10000000),rotation:number(s.rotation,d.rotation,-360000,360000),shown:s.shown!==false,locked:s.locked===true}}
export function commands(s){const a=[];const x=-s.width/2,y=-s.height/2;for(let i=0;i<=s.cols;i++){const p=x+s.width*i/s.cols;a.push([Command.MOVE,p,y],[Command.LINE,p,-y])}for(let i=0;i<=s.rows;i++){const p=y+s.height*i/s.rows;a.push([Command.MOVE,x,p],[Command.LINE,-x,p])}return a}
export const isGrid=i=>i.type==="PATH"&&!!i.metadata?.[KEY];
export async function getGrid(){return (await OBR.scene.items.getItems(isGrid))[0]}
export function read(i){const m=i.metadata[KEY];return clean({...defaults,...m,width:m.width*Math.abs(i.scale.x),height:m.height*Math.abs(i.scale.y),x:i.position.x,y:i.position.y,rotation:i.rotation,locked:m.shown===false?m.locked:i.locked})}
export function apply(i,s){s=clean(s);i.position={x:s.x,y:s.y};i.rotation=s.rotation;i.scale={x:1,y:1};i.commands=commands(s);i.style.strokeColor=s.color;i.style.strokeOpacity=s.shown?s.opacity:0;i.style.strokeWidth=s.thickness;i.style.fillOpacity=0;i.visible=s.shown;i.locked=s.locked||!s.shown;i.disableHit=s.locked||!s.shown;i.layer="GRID";i.metadata[KEY]=s;delete i.attachedTo}
export function make(s){s=clean(s);return buildPath().name("Grille tactique libre").layer("GRID").position({x:s.x,y:s.y}).rotation(s.rotation).scale({x:1,y:1}).commands(commands(s)).fillOpacity(0).strokeColor(s.color).strokeOpacity(s.opacity).strokeWidth(s.thickness).metadata({[KEY]:s}).locked(s.locked).disableHit(s.locked).build()}
export async function save(id,s){await OBR.scene.items.updateItems([id],items=>{for(const i of items){if(isGrid(i))apply(i,s)}})}
// Side handles use a single axis as their scaling driver; corners use a diagonal.
export function handleAt(s,p){const a=s.rotation*Math.PI/180,c=Math.cos(a),n=Math.sin(a),dx=p.x-s.x,dy=p.y-s.y;const x=c*dx+n*dy,y=-n*dx+c*dy;const nx=2*x/s.width,ny=2*y/s.height;const ex=Math.abs(Math.abs(nx)-1)<=.16&&Math.abs(ny)<=1.16,ey=Math.abs(Math.abs(ny)-1)<=.16&&Math.abs(nx)<=1.16;return ex||ey?{sx:ex?Math.sign(nx):0,sy:ey?Math.sign(ny):0}:null}
export function dragGeometry(s,start,end,resize){
 const dx=end.x-start.x,dy=end.y-start.y;
 if(!resize)return clean({...s,x:s.x+dx,y:s.y+dy});
 const rad=s.rotation*Math.PI/180,c=Math.cos(rad),n=Math.sin(rad);
 const lx=c*dx+n*dy,ly=-n*dx+c*dy;
 const localX=c*(start.x-s.x)+n*(start.y-s.y),localY=-n*(start.x-s.x)+c*(start.y-s.y);
 const {sx,sy}=typeof resize==="object"?resize:(handleAt(s,start)||{sx:localX<0?-1:1,sy:localY<0?-1:1});
 const vx=sx*s.width,vy=sy*s.height;
 const k=clamp(1+(vx*lx+vy*ly)/(vx*vx+vy*vy),Math.max(1/s.width,1/s.height),Math.min(100000/s.width,100000/s.height));
 const w=s.width*k,h=s.height*k;
 const cx=sx*(w-s.width)/2,cy=sy*(h-s.height)/2;
 return clean({...s,width:w,height:h,x:s.x+c*cx-n*cy,y:s.y+n*cx+c*cy});
}
// Owlbear's ordinary selection handles can scale either axis independently.
// Bake each committed native transform into the original geometry, using one
// common factor. Keeping the native centre preserves the opposite edge midpoint
// for a side handle. Never derive the reference ratio from a distorted scale.
export function needsNormalize(i){return isGrid(i)&&(Math.abs(i.scale.x-1)>1e-6||Math.abs(i.scale.y-1)>1e-6)}
export function normalizeNative(i){
 const m=clean({...defaults,...i.metadata[KEY]});
 const a=Math.abs(i.scale.x),b=Math.abs(i.scale.y);
 const raw=Math.abs(a-1)>=Math.abs(b-1)?a:b;
 const k=clamp(Number.isFinite(raw)?raw:1,Math.max(1/m.width,1/m.height),Math.min(100000/m.width,100000/m.height));
 return clean({...m,width:m.width*k,height:m.height*k,x:i.position.x,y:i.position.y,rotation:i.rotation,locked:m.shown?i.locked:m.locked});
}
