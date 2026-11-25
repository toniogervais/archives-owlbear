export function measureCase(a,b){
 if(![a?.x,a?.y,b?.x,b?.y].every(Number.isFinite))return null;
 const size=Math.hypot(b.x-a.x,b.y-a.y);
 if(size<1||size>100000)return null;
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,size};
}