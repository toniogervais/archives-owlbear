import {HANDLES,drag,clamp,handleAt} from "./math.js?v=231";
import {measureCase,numberLabel} from "./measure.js";
const NS="http://www.w3.org/2000/svg";
const el=(name,attrs={})=>{const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
export function createPreview(svg,onChange,onCommit,onState=()=>{},onLive=()=>{}){
 let frame=null,current=null,view=null,mode="square",enabled=true,first=null,hover=null,line=null,gesture=null;
 const bg=el("g"),image=el("g"),ink=el("g"),hit=el("rect",{fill:"transparent","pointer-events":"all"});
 for(const g of [bg,image,ink])g.setAttribute("pointer-events","none");
 svg.append(bg,image,ink,hit);
 svg.style.touchAction="none";svg.style.userSelect="none";
 function unit(){const b=svg.getBoundingClientRect();return view.side/Math.max(1,Math.min(b.width,b.height))}
 function point(e){const b=svg.getBoundingClientRect(),u=unit();return {x:view.x+(e.clientX-b.left-b.width/2)*u,y:view.y+(e.clientY-b.top-b.height/2)*u}}
 function label(x,y,t,color){const u=unit(),f=15*u,half=Math.min(view.side*.45,(t.length*4.6+10)*u);const n=el("text",{x:clamp(x,view.x-view.side/2+half,view.x+view.side/2-half),y:clamp(y,view.y-view.side/2+f*1.2,view.y+view.side/2-f/2),"text-anchor":"middle","font-family":"system-ui","font-weight":750,"font-size":f,fill:color,stroke:"#161923","stroke-width":5*u,"paint-order":"stroke fill","stroke-linejoin":"round"});n.textContent=t;ink.append(n)}
 function draw(){
  ink.replaceChildren();if(!view||!current)return;const u=unit();
  const s=first&&hover?measureCase(first,hover)||current:current,q=s.size/2;
  ink.append(el("rect",{x:s.x-q,y:s.y-q,width:s.size,height:s.size,fill:"#ffd24a","fill-opacity":".06",stroke:"#ffd24a","stroke-width":2,"vector-effect":"non-scaling-stroke","stroke-dasharray":first?"5 4":"none"}));
  if(mode==="square"){const h=6*u;for(const [a,b] of HANDLES)ink.append(el("rect",{x:s.x+a*q-h,y:s.y+b*q-h,width:2*h,height:2*h,rx:u,fill:"#fff",stroke:"#191b25","stroke-width":1,"vector-effect":"non-scaling-stroke"}))}
  const a=first||line?.a,b=first?hover:line?.b;
  if(mode==="distance"&&a){
   if(b){ink.append(el("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#16212c","stroke-width":7,"vector-effect":"non-scaling-stroke"}),el("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#61e7ff","stroke-width":3,"vector-effect":"non-scaling-stroke"}));label((a.x+b.x)/2,(a.y+b.y)/2-15*u,numberLabel(Math.hypot(b.x-a.x,b.y-a.y))+" px","#61e7ff")}
   ink.append(el("circle",{cx:a.x,cy:a.y,r:7*u,fill:"#61e7ff",stroke:"#131723","stroke-width":2,"vector-effect":"non-scaling-stroke"}));label(a.x,a.y+23*u,"A","#61e7ff");
   if(b&&Math.hypot(b.x-a.x,b.y-a.y)>u*4){ink.append(el("circle",{cx:b.x,cy:b.y,r:6*u,fill:"#61e7ff",stroke:"#131723","stroke-width":2,"vector-effect":"non-scaling-stroke"}));label(b.x,b.y+23*u,"B","#61e7ff")}
  }else label(s.x,s.y-q-12*u,numberLabel(s.size)+" px","#ffd24a");
 }
 function render(){if(!view)return;const b=svg.getBoundingClientRect(),u=unit(),w=Math.max(view.side,b.width*u),h=Math.max(view.side,b.height*u);svg.setAttribute("viewBox",[view.x-w/2,view.y-h/2,w,h].join(" "));for(const [k,v] of Object.entries({x:view.x-w/2,y:view.y-h/2,width:w,height:h}))hit.setAttribute(k,String(v));draw()}
 function fit(){if(!frame||!current)return;const a=frame.rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));view={x:frame.x,y:frame.y,side:Math.max(c*frame.w+s*frame.h,s*frame.w+c*frame.h,2*Math.abs(current.x-frame.x)+current.size,2*Math.abs(current.y-frame.y)+current.size,1)*1.65};render()}
 function zoom(f){if(view){view.side=clamp(view.side*f,.5,1000000);render()}}
 function resetMeasure(){first=null;hover=null;line=null;gesture=null;onLive(null)}
 function commit(p){const m=measureCase(first,p);if(!m){resetMeasure();draw();onState("invalid");return}line={a:{...first},b:{...p}};current=m;first=null;hover=null;onLive(null);draw();onCommit({...current});onState("done")}
 function down(e){if(!enabled||!view||!current||e.button!==0)return;e.preventDefault();e.stopPropagation();const p=point(e);
  if(mode==="distance"){const second=!!first;if(!first){first=p;hover=p;line=null;onLive(0);onState("start")}gesture={id:e.pointerId,start:p,cx:e.clientX,cy:e.clientY,second};draw()}
  else {const h=mode==="pan"?null:handleAt(current,p);gesture={id:e.pointerId,start:p,cx:e.clientX,cy:e.clientY,base:{...current},view:{...view},h};}
  try{svg.setPointerCapture(e.pointerId)}catch{}
 }
 function move(e){if(!enabled||!view||!current)return;if(mode==="distance"){if(first){hover=point(e);onLive(Math.hypot(hover.x-first.x,hover.y-first.y));draw()}return}
  if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;if(g.h){current=drag(g.base,g.start,point(e),g.h);draw();onChange({...current})}else{const u=unit();view={...g.view,x:g.view.x-(e.clientX-g.cx)*u,y:g.view.y-(e.clientY-g.cy)*u};render()}}
 function up(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(mode==="distance"){const p=point(e);if(g.second||Math.hypot(e.clientX-g.cx,e.clientY-g.cy)>4)commit(p);else{hover=p;draw()}}else if(g.h)onCommit({...current});try{svg.releasePointerCapture(e.pointerId)}catch{}}
 function cancel(e){if(gesture?.id!==e.pointerId)return;gesture=null;if(mode==="distance"){resetMeasure();draw();onState("ready")}}
 svg.addEventListener("pointerdown",down);svg.addEventListener("pointermove",move);svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",cancel);
 svg.addEventListener("wheel",e=>{if(view&&enabled){e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15)}},{passive:false});
 function picture(layer,item,fr){layer.replaceChildren();if(!item||!fr)return;const g=el("g",{transform:"translate("+fr.x+" "+fr.y+") rotate("+fr.rotation+") scale("+fr.flipX+" "+fr.flipY+")"});g.append(el("image",{href:item.image.url,x:-fr.w/2,y:-fr.h/2,width:fr.w,height:fr.h,preserveAspectRatio:"none"}));layer.append(g)}
 return {mode(v){mode=v;resetMeasure();svg.style.cursor=v==="distance"?"crosshair":v==="pan"?"grab":"move";draw();if(v==="distance")onState("ready")},context(item,fr){picture(bg,item,fr)},set(item,fr,s){resetMeasure();frame=fr;current=s;picture(image,item,fr);if(!item){view=null;bg.replaceChildren();ink.replaceChildren();return}fit()},fit,zoom,enabled(v){enabled=v}};
}
