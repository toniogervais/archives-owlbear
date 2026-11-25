export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function valid(s){return !!s&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.size)&&s.size>=1&&s.size<=100000}
export function fromBounds(b){const w=b.max.x-b.min.x,h=b.max.y-b.min.y;return {x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2,size:clamp(Math.max(w,h),1,100000)}}
export const HANDLES=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
export function handleAt(s,p){const q=s.size/2,dx=p.x-s.x,dy=p.y-s.y,tol=s.size*.13;let best=null,dist=Infinity;for(const [x,y] of HANDLES){const d=Math.hypot(dx-x*q,dy-y*q);if(d<=tol&&d<dist){dist=d;best={x,y}}}if(best)return best;if(Math.abs(dx)<=q&&Math.abs(dy)<=q)return {x:0,y:0};return null}
export function drag(s,start,end,h=handleAt(s,start)){if(!h)return s;const dx=end.x-start.x,dy=end.y-start.y;if(!h.x&&!h.y)return {...s,x:s.x+dx,y:s.y+dy};const size=clamp(s.size+(h.x*dx+h.y*dy)/(h.x*h.x+h.y*h.y),1,100000);const delta=(size-s.size)/2;return {...s,size,x:s.x+h.x*delta,y:s.y+h.y*delta}}
export function transform(item,origin,target,k){return {id:item.id,position:{x:target.x+(item.position.x-origin.x)*k,y:target.y+(item.position.y-origin.y)*k},scale:{x:item.scale.x*k,y:item.scale.y*k}}}
export function snapshot(i){return {id:i.id,position:{...i.position},scale:{...i.scale}}}
export function same(i,t){return i&&["x","y"].every(k=>Math.abs(i.position[k]-t.position[k])<.0001&&Math.abs(i.scale[k]-t.scale[k])<.0001)}
export function extent(s,b){if(!b)return {l:-5,r:6,t:-5,b:6};const x=s.x-s.size/2,y=s.y-s.size/2;return {l:clamp(Math.floor((b.min.x-x)/s.size),-100,100),r:clamp(Math.ceil((b.max.x-x)/s.size),-100,100),t:clamp(Math.floor((b.min.y-y)/s.size),-100,100),b:clamp(Math.ceil((b.max.y-y)/s.size),-100,100)}}
