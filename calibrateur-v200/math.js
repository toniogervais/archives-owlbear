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

export function imageFrame(item,b){const x=(b.min.x+b.max.x)/2,y=(b.min.y+b.max.y)/2,bw=b.max.x-b.min.x,bh=b.max.y-b.min.y,a=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));const rw=item.image.width*Math.abs(item.scale.x),rh=item.image.height*Math.abs(item.scale.y);const pw=c*rw+s*rh,ph=s*rw+c*rh;const k=(bw*pw+bh*ph)/(pw*pw+ph*ph);if(!(k>0&&Number.isFinite(k)))throw Error("Dimensions du token indisponibles.");return {x,y,w:rw*k,h:rh*k,rotation:item.rotation||0,flipX:Math.sign(item.scale.x)||1,flipY:Math.sign(item.scale.y)||1}}
export function independentCase(b,dpi){return {x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2,size:clamp(dpi||150,1,100000)}}
export function descendsFrom(item,ancestor,all){const seen=new Set();let p=item.attachedTo;while(p&&!seen.has(p)){if(p===ancestor)return true;seen.add(p);p=all.find(i=>i.id===p)?.attachedTo}return false}

export const image=i=>!!i&&i.type==="IMAGE"&&!!i.image;
export function maps(items,tokenId){const list=items.filter(i=>image(i)&&i.id!==tokenId);const native=list.filter(i=>i.layer==="MAP");return native.length?native:list}
export function pickMap(items,tokenId,preferred){const list=maps(items,tokenId);return list.find(i=>i.id===preferred)?.id||(list.length===1&&list[0].layer==="MAP"?list[0].id:"")}
export function closeTransform(i,t){return !!i&&["x","y"].every(k=>["position","scale"].every(p=>Math.abs(i[p][k]-t[p][k])<=Math.max(.001,Math.abs(t[p][k])*.000001)))}

export function selectedToken(items,selection){const selected=items.filter(i=>image(i)&&i.layer!=="MAP"&&(selection||[]).includes(i.id));return selected.length===1?selected[0]:null}

export function gridSegments(s,b){
 if(!valid(s)||!b||![b.min.x,b.min.y,b.max.x,b.max.y].every(Number.isFinite))throw Error("Dimensions de la grille invalides.");
 const ox=s.x-s.size/2,oy=s.y-s.size/2,l=Math.floor((b.min.x-ox)/s.size),r=Math.ceil((b.max.x-ox)/s.size),t=Math.floor((b.min.y-oy)/s.size),bottom=Math.ceil((b.max.y-oy)/s.size);
 if(r-l+bottom-t+2>1600)throw Error("Grille trop dense (plus de 1600 lignes). Agrandis la case ou choisis une carte plus petite.");
 const a=[];for(let i=l;i<=r;i++)a.push([ox+i*s.size,oy+t*s.size,ox+i*s.size,oy+bottom*s.size]);
 for(let i=t;i<=bottom;i++)a.push([ox+l*s.size,oy+i*s.size,ox+r*s.size,oy+i*s.size]);return a;
}
export function snapCenter(p,s){return {x:s.x+Math.round((p.x-s.x)/s.size)*s.size,y:s.y+Math.round((p.y-s.y)/s.size)*s.size}}
export function distance(a,b,s){const cells=Math.hypot(b.x-a.x,b.y-a.y)/s.size;return {cells,value:cells*s.meters}}
