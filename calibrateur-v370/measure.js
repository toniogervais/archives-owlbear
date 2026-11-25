export function measureCase(a,b){
 if(![a?.x,a?.y,b?.x,b?.y].every(Number.isFinite))return null;
 const size=Math.hypot(b.x-a.x,b.y-a.y);
 if(size<1||size>100000)return null;
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,size};
}
export const numberLabel=n=>Number.isFinite(n)?new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(n):"—";
export function measureInfo(size,dpi,scale){
 const cells=Number.isFinite(size)&&size>=0&&Number.isFinite(dpi)&&dpi>0?size/dpi:null;
 const multiplier=scale?.parsed?.multiplier,unit=scale?.parsed?.unit||"";
 const real=cells!==null&&Number.isFinite(multiplier)?cells*multiplier:null;
 return {pixels:Number.isFinite(size)&&size>=0?numberLabel(size)+" px":"—",cells:cells===null?"—":numberLabel(cells)+" case(s)",real:real===null?"—":numberLabel(real)+(unit?" "+unit:""),target:Number.isFinite(multiplier)&&multiplier>0?numberLabel(multiplier)+(unit?" "+unit:"")+" / case":"—",factor:cells>0?numberLabel(1/cells)+" ×":"—"};
}
