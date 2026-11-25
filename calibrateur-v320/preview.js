import {HANDLES,drag,clamp} from "./math.js?v=231";
import {measureCase} from "./measure.js";
const NS="http://www.w3.org/2000/svg";
function el(name,attrs={}){const a=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))a.setAttribute(k,String(v));return a}
export function createPreview(svg,onChange,onCommit,onMeasureState=()=>{}){
 let frame=null,tokenId=null,source=null,box=null,current=null,gesture=null,enabled=true,view=null,mode="square",first=null,hover=null,line=null;
 const contextLayer=el("g",{"pointer-events":"none"}),imageLayer=el("g"),cellLayer=el("g"),measureLayer=el("g",{"pointer-events":"none"});svg.append(contextLayer,imageLayer,cellLayer,measureLayer);
 function fit(){if(!frame)return;const a=frame.rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));const w=c*frame.w+s*frame.h,h=s*frame.w+c*frame.h;const half=Math.max(w,h,current?.size||0,Math.abs((current?.x??frame.x)-frame.x)*2+(current?.size||0),Math.abs((current?.y??frame.y)-frame.y)*2+(current?.size||0),1)*.68;view={x:frame.x,y:frame.y,side:half*2};renderView()}
 function renderView(){if(!view)return;svg.setAttribute("viewBox",[view.x-view.side/2,view.y-view.side/2,view.side,view.side].join(" "));draw()}
 function draw(){cellLayer.replaceChildren();measureLayer.replaceChildren();if(!current||!view)return;const q=current.size/2,h=Math.min(current.size*.12,Math.max(view.side*.016,current.size*.012)),x=current.x,y=current.y;
 const rect=el("rect",{x:x-q,y:y-q,width:current.size,height:current.size,fill:"#ffd24a","fill-opacity":".08",stroke:"#ffd24a","stroke-width":"2","vector-effect":"non-scaling-stroke",cursor:"move","data-move":"1"});cellLayer.append(rect);
 if(mode==="square")for(const [sx,sy] of HANDLES){const handle=el("rect",{x:x+sx*q-h,y:y+sy*q-h,width:h*2,height:h*2,fill:"#fff",stroke:"#2b2636","stroke-width":"1.4","vector-effect":"non-scaling-stroke","data-hx":sx,"data-hy":sy,cursor:sx&&sy?(sx===sy?"nwse-resize":"nesw-resize"):sx?"ew-resize":"ns-resize"});cellLayer.append(handle)}
 drawMeasure();
 }
 function drawMeasure(){
 if(mode!=="distance"||!view)return;
 const a=first||line?.a,b=first?hover:line?.b;if(!a)return;
 const r=view.side*.012;
 if(b){measureLayer.append(el("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#61e7ff","stroke-width":2.5,"vector-effect":"non-scaling-stroke"}));}
 for(const v of [a,b].filter(Boolean))measureLayer.append(el("circle",{cx:v.x,cy:v.y,r,fill:"#61e7ff",stroke:"#142433","stroke-width":1,"vector-effect":"non-scaling-stroke"}));
 }
 function commitMeasure(a,b){const m=measureCase(a,b);if(!m){onMeasureState("invalid");return false}current=m;line={a:{...a},b:{...b}};first=null;hover=null;draw();onCommit(current);onMeasureState("done");return true}
 function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
 svg.addEventListener("pointerdown",e=>{if(!enabled||!current||e.button!==0)return;
 if(mode==="distance"){const pos=point(e);gesture={id:e.pointerId,measure:true,start:pos,cx:e.clientX,cy:e.clientY,hadFirst:!!first};if(!first){first=pos;hover=pos;line=null;onMeasureState("start")}svg.setPointerCapture(e.pointerId);draw();e.preventDefault();return}
 const a=e.target;const hx=a.getAttribute("data-hx");const h=mode==="pan"?null:hx!==null?{x:Number(hx),y:Number(a.getAttribute("data-hy"))}:a.hasAttribute("data-move")?{x:0,y:0}:null;gesture={id:e.pointerId,base:{...current},start:point(e),h,view:{...view}};svg.setPointerCapture(e.pointerId);e.preventDefault()});
 svg.addEventListener("pointermove",e=>{if(mode==="distance"&&first){hover=point(e);draw()}if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,p=point(e);if(g.measure)return;if(g.h){current=drag(g.base,g.start,p,g.h);draw();onChange(current)}else{const bounds=svg.getBoundingClientRect(),ratio=g.view.side/Math.min(bounds.width,bounds.height);view={...g.view,x:g.view.x-(e.clientX-g.clientX)*ratio,y:g.view.y-(e.clientY-g.clientY)*ratio};renderView()}});
 svg.addEventListener("pointerdown",e=>{if(gesture){gesture.clientX=e.clientX;gesture.clientY=e.clientY}});
 function finish(e,cancel){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.measure){if(cancel){first=null;hover=null;draw();onMeasureState("ready");return}const end=point(e);if(g.hadFirst||Math.hypot(e.clientX-g.cx,e.clientY-g.cy)>4){if(!commitMeasure(first,end)){first=null;hover=null;draw()}}else{hover=end;draw()}return}if(cancel){current=g.base;view=g.view;renderView();if(g.h)onChange(current)}else if(g.h)onCommit(current)}
 svg.addEventListener("pointerup",e=>finish(e,false));svg.addEventListener("pointercancel",e=>finish(e,true));
 function zoom(f){if(!view)return;view.side=clamp(view.side*f,.5,1000000);renderView()}
 svg.addEventListener("wheel",e=>{if(view){e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15)}},{passive:false});
 return {mode(v){if(!["square","distance","pan"].includes(v))return;mode=v;first=null;hover=null;line=null;gesture=null;svg.style.cursor=v==="distance"?"crosshair":v==="pan"?"grab":"default";draw();if(v==="distance")onMeasureState("ready")},context(item,fr){contextLayer.replaceChildren();if(!item||!fr)return;const g=el("g",{transform:"translate("+fr.x+" "+fr.y+") rotate("+fr.rotation+") scale("+fr.flipX+" "+fr.flipY+")"});g.append(el("image",{href:item.image.url,x:-fr.w/2,y:-fr.h/2,width:fr.w,height:fr.h,preserveAspectRatio:"none",opacity:".8"}));contextLayer.append(g)},set(token,fr,s){first=null;hover=null;line=null;if(!token||!fr){frame=null;tokenId=null;source=null;box=null;current=null;view=null;contextLayer.replaceChildren();imageLayer.replaceChildren();cellLayer.replaceChildren();measureLayer.replaceChildren();return}const key=JSON.stringify(fr),changed=tokenId!==token.id;const reload=changed||source!==token.image.url||box!==key;tokenId=token.id;source=token.image.url;box=key;frame=fr;if(!gesture)current=s;if(reload){imageLayer.replaceChildren();const g=el("g",{transform:"translate("+fr.x+" "+fr.y+") rotate("+fr.rotation+") scale("+fr.flipX+" "+fr.flipY+")"});const i=el("image",{href:source,x:-fr.w/2,y:-fr.h/2,width:fr.w,height:fr.h,preserveAspectRatio:"none"});i.addEventListener("error",()=>{const t=el("text",{x:0,y:0,"text-anchor":"middle",fill:"#fff","font-size":Math.max(fr.w,fr.h)*.07});t.textContent="Image indisponible";g.append(t)});g.append(i);imageLayer.append(g)}if(changed||!view)fit();else draw()},fit,zoom,enabled(v){enabled=v}};
}
