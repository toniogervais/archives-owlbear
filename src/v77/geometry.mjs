const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function pinchCamera(camera,origin,distance,midpoint,nextDistance){
 if(![camera.panX,camera.panY,camera.zoom,origin.x,origin.y,midpoint.x,midpoint.y,distance,nextDistance].every(Number.isFinite)||camera.zoom<=0||distance<=0||nextDistance<=0)throw Error('Geste de zoom invalide.');
 const zoom=clamp(camera.zoom*nextDistance/distance,.05,5);
 return {zoom,panX:midpoint.x-(origin.x-camera.panX)/camera.zoom*zoom,panY:midpoint.y-(origin.y-camera.panY)/camera.zoom*zoom};
}
export const zoomCamera=(camera,zoom,point)=>pinchCamera(camera,point,1,point,zoom/camera.zoom);
export function dockPosition(position,width,height,viewport){
 const left=viewport.left||0,top=viewport.top||0,margin=8;
 return {x:clamp(Number(position.x)||left+margin,left+margin,left+Math.max(margin,viewport.width-width-margin)),y:clamp(Number(position.y)||top+margin,top+margin,top+Math.max(margin,viewport.height-height-margin))};
}
