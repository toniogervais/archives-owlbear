const bounded=(value,fallback,min,max)=>value!==null&&value!==''&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
export function pictureFrame(value={}) {
  return {zoom:bounded(value.bgZoom,1,.15,8),x:bounded(value.bgOffsetX,0,-4,4),y:bounded(value.bgOffsetY,0,-4,4)};
}
export const frameFields=frame=>({bgZoom:frame.zoom,bgOffsetX:frame.x,bgOffsetY:frame.y});
export const frameTransform=frame=>'translate('+frame.x*100+'%, '+frame.y*100+'%) scale('+frame.zoom+')';
