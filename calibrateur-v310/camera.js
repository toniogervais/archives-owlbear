// Preserve the local MJ view by compensating the scene's affine transform.
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function cameraTarget(view,s,r){
 const scale=view.scale/r.k;
 if(!Number.isFinite(scale)||scale<=0)throw Error("Zoom indisponible.");
 const oldOrigin={x:s.x-s.size/2,y:s.y-s.size/2};
 const shift={x:r.corner.x-r.k*oldOrigin.x,y:r.corner.y-r.k*oldOrigin.y};
 return {scale,position:{x:view.position.x-scale*shift.x,y:view.position.y-scale*shift.y}};
}
export async function captureCamera(api,guard=()=>{}){
 try{
 const [position,scale,origin,x,y]=await Promise.all([api.getPosition(),api.getScale(),api.transformPoint({x:0,y:0}),api.transformPoint({x:100,y:0}),api.transformPoint({x:0,y:100})]);guard();
 if(!finite(position)||!finite(origin)||!finite(x)||!finite(y)||!(scale>0)||dist(position,origin)>.5||dist(x,{x:origin.x+100*scale,y:origin.y})>.5||dist(y,{x:origin.x,y:origin.y+100*scale})>.5)return null;
 return {position,scale};
 }catch{return null}
}
export async function preserveCamera(api,view,s,r,guard=()=>{}){
 if(!view)return false;
 guard();const now=await captureCamera(api,guard);guard();
 if(!now||dist(now.position,view.position)>1||Math.abs(now.scale-view.scale)>.001)return false;
 const target=cameraTarget(view,s,r);await api.animateTo(target);guard();return true;
}
export async function restoreCamera(api,view,guard=()=>{}){
 if(!view)return false;guard();await api.animateTo(view);guard();return true;
}
