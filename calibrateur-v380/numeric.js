import {valid,toMap} from "./math.js?v=231";
export function calculate(s,item,f,sceneDpi){
 if(!valid(s)||!(f.w>0&&f.h>0)||!(item.image.width>0&&item.image.height>0)||!(sceneDpi>0))throw Error("Dimensions indisponibles.");
 const w=item.image.width,h=item.image.height,q=s.size/2;
 const points=[[-q,-q],[q,-q],[q,q],[-q,q]].map(([dx,dy])=>toMap({x:s.x+dx,y:s.y+dy},f));
 const x0=Math.min(...points.map(p=>p.x)),x1=Math.max(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y)),y1=Math.max(...points.map(p=>p.y));
 const mod=(n,d)=>((n%d)+d)%d;
 const dpiX=s.size*w/f.w,dpiY=s.size*h/f.h,columns=f.w/s.size,rows=f.h/s.size;
 return {dpiX,dpiY,columns,rows,k:sceneDpi/s.size,scaleX:item.scale.x*sceneDpi/s.size,scaleY:item.scale.y*sceneDpi/s.size,
 originX:(x0+.5)*w,originY:(y0+.5)*h,phaseX:mod((x0+.5)*w,dpiX),phaseY:mod((y0+.5)*h,dpiY),
 inside:x0>=-.50001&&x1<=.50001&&y0>=-.50001&&y1<=.50001,
 rotated:Math.abs(Math.sin(f.rotation*Math.PI/180*2))>1e-6,anisotropic:Math.abs(dpiX-dpiY)>Math.max(dpiX,dpiY)*.005};
}
