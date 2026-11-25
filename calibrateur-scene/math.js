export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function valid(s){return !!s&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.size)&&s.size>=1&&s.size<=100000}
export function fromBounds(b){const w=b.max.x-b.min.x,h=b.max.y-b.min.y;return {x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2,size:clamp(Math.max(w,h),1,100000)}}
export function corner(s,p){const dx=p.x-s.x,dy=p.y-s.y,half=s.size/2;if(Math.abs(Math.abs(dx)-half)<=s.size*.18&&Math.abs(Math.abs(dy)-half)<=s.size*.18)return {x:Math.sign(dx)||1,y:Math.sign(dy)||1};return null}
export function drag(s,start,end){const h=corner(s,start);const dx=end.x-start.x,dy=end.y-start.y;if(h){const size=clamp(s.size+(h.x*dx+h.y*dy)/2,1,100000);return {...s,size,x:s.x+h.x*(size-s.size)/2,y:s.y+h.y*(size-s.size)/2}}return {...s,x:s.x+dx,y:s.y+dy}}
export function transform(item,origin,target,k){return {id:item.id,position:{x:target.x+(item.position.x-origin.x)*k,y:target.y+(item.position.y-origin.y)*k},scale:{x:item.scale.x*k,y:item.scale.y*k}}}
export function snapshot(i){return {id:i.id,position:{...i.position},scale:{...i.scale}}}
export function same(i,t){return i&&["x","y"].every(k=>Math.abs(i.position[k]-t.position[k])<.0001&&Math.abs(i.scale[k]-t.scale[k])<.0001)}
export function extent(s,b){if(!b)return {l:-5,r:6,t:-5,b:6};const x=s.x-s.size/2,y=s.y-s.size/2;return {l:clamp(Math.floor((b.min.x-x)/s.size),-100,100),r:clamp(Math.ceil((b.max.x-x)/s.size),-100,100),t:clamp(Math.floor((b.min.y-y)/s.size),-100,100),b:clamp(Math.ceil((b.max.y-y)/s.size),-100,100)}}
