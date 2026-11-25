import {HANDLES,drag,clamp} from "./math.js?v=220";
const NS="http://www.w3.org/2000/svg";
function el(name,attrs={}){const a=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))a.setAttribute(k,String(v));return a}
export function createPreview(svg,onChange,onCommit){
 let frame=null,tokenId=null,source=null,box=null,current=null,gesture=null,enabled=true,view=null;
 const imageLayer=el("g"),cellLayer=el("g");svg.append(imageLayer,cellLayer);
 function fit(){if(!frame)return;const a=frame.rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));const w=c*frame.w+s*frame.h,h=s*frame.w+c*frame.h;const half=Math.max(w,h,current?.size||0,Math.abs((current?.x??frame.x)-frame.x)*2+(current?.size||0),Math.abs((current?.y??frame.y)-frame.y)*2+(current?.size||0),1)*.68;view={x:frame.x,y:frame.y,side:half*2};renderView()}
 function renderView(){if(!view)return;svg.setAttribute("viewBox",[view.x-view.side/2,view.y-view.side/2,view.side,view.side].join(" "));draw()}
 function draw(){cellLayer.replaceChildren();if(!current||!view)return;const q=current.size/2,h=Math.min(current.size*.12,Math.max(view.side*.016,current.size*.012)),x=current.x,y=current.y;
 const rect=el("rect",{x:x-q,y:y-q,width:current.size,height:current.size,fill:"#ffd24a","fill-opacity":".08",stroke:"#ffd24a","stroke-width":"2","vector-effect":"non-scaling-stroke",cursor:"move","data-move":"1"});cellLayer.append(rect);
 for(const [sx,sy] of HANDLES){const handle=el("rect",{x:x+sx*q-h,y:y+sy*q-h,width:h*2,height:h*2,fill:"#fff",stroke:"#2b2636","stroke-width":"1.4","vector-effect":"non-scaling-stroke","data-hx":sx,"data-hy":sy,cursor:sx&&sy?(sx===sy?"nwse-resize":"nesw-resize"):sx?"ew-resize":"ns-resize"});cellLayer.append(handle)}
 }
 function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
 svg.addEventListener("pointerdown",e=>{if(!enabled||!current||e.button!==0)return;const a=e.target;const hx=a.getAttribute("data-hx");const h=hx!==null?{x:Number(hx),y:Number(a.getAttribute("data-hy"))}:a.hasAttribute("data-move")?{x:0,y:0}:null;gesture={id:e.pointerId,base:{...current},start:point(e),h,view:{...view}};svg.setPointerCapture(e.pointerId);e.preventDefault()});
 svg.addEventListener("pointermove",e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,p=point(e);if(g.h){current=drag(g.base,g.start,p,g.h);draw();onChange(current)}else{const bounds=svg.getBoundingClientRect(),ratio=g.view.side/Math.min(bounds.width,bounds.height);view={...g.view,x:g.view.x-(e.clientX-g.clientX)*ratio,y:g.view.y-(e.clientY-g.clientY)*ratio};renderView()}});
 svg.addEventListener("pointerdown",e=>{if(gesture){gesture.clientX=e.clientX;gesture.clientY=e.clientY}});
 function finish(e,cancel){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(cancel){current=g.base;view=g.view;renderView();if(g.h)onChange(current)}else if(g.h)onCommit(current)}
 svg.addEventListener("pointerup",e=>finish(e,false));svg.addEventListener("pointercancel",e=>finish(e,true));
 function zoom(f){if(!view)return;view.side=clamp(view.side*f,.5,1000000);renderView()}
 svg.addEventListener("wheel",e=>{if(view){e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15)}},{passive:false});
 return {set(token,fr,s){if(!token||!fr){frame=null;tokenId=null;source=null;box=null;current=null;view=null;imageLayer.replaceChildren();cellLayer.replaceChildren();return}const key=JSON.stringify(fr),changed=tokenId!==token.id;const reload=changed||source!==token.image.url||box!==key;tokenId=token.id;source=token.image.url;box=key;frame=fr;if(!gesture)current=s;if(reload){imageLayer.replaceChildren();const g=el("g",{transform:"translate("+fr.x+" "+fr.y+") rotate("+fr.rotation+") scale("+fr.flipX+" "+fr.flipY+")"});const i=el("image",{href:source,x:-fr.w/2,y:-fr.h/2,width:fr.w,height:fr.h,preserveAspectRatio:"none"});i.addEventListener("error",()=>{const t=el("text",{x:0,y:0,"text-anchor":"middle",fill:"#fff","font-size":Math.max(fr.w,fr.h)*.07});t.textContent="Image indisponible";g.append(t)});g.append(i);imageLayer.append(g)}if(changed||!view)fit();else draw()},fit,zoom,enabled(v){enabled=v}};
}
