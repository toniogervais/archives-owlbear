import {pinchCamera} from './geometry.mjs?v=4550';
function install(){
 const viewport=document.getElementById('viewport'),api=window.DuneApp;if(!viewport||!api?.setCanvasCamera)return;
 let gesture=null,pending=null,frame=0;const canvasTouches=new Set();
 const camera=()=>{const s=api.getState();return {panX:s.panX,panY:s.panY,zoom:s.zoom}};
 const isPlayer=()=>{const s=api.getState();return s.playerMode||s.strictReadOnly};
 const touches=event=>Array.from(event.touches).filter(t=>canvasTouches.has(t.identifier));
 const point=touch=>{const rect=viewport.getBoundingClientRect();return {x:touch.clientX-rect.left,y:touch.clientY-rect.top}};
 const pair=list=>{const a=point(list[0]),b=point(list[1]);return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(b.x-a.x,b.y-a.y),ids:[list[0].identifier,list[1].identifier].join(':')}};
 function flush(){if(frame)cancelAnimationFrame(frame);frame=0;if(pending){api.setCanvasCamera(pending);pending=null}}
 function draw(value){pending=value;if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(pending){api.setCanvasCamera(pending);pending=null}})}
 function claim(event){event.preventDefault();event.stopImmediatePropagation()}
 function startPinch(event,list){
  claim(event);flush();api.setCanvasInteraction(true);window.dispatchEvent(new Event('archives:cancel-cell-touch'));
  viewport.querySelectorAll('.peek-bg-only').forEach(cell=>cell.classList.remove('peek-bg-only'));
  const p=pair(list);gesture={kind:'pinch',camera:camera(),...p};
 }
 function startPan(touch,tap){
  flush();gesture={kind:'pan',camera:camera(),point:point(touch),id:touch.identifier,tap,moved:false,time:performance.now()};api.setCanvasInteraction(true);
 }
 function finish(cancelled){
  if(!gesture)return;flush();const old=gesture;gesture=null;canvasTouches.clear();api.setCanvasInteraction(false);api.setCanvasCamera(camera(),true);
  if(!cancelled&&old.kind==='pan'&&!old.moved&&old.tap&&performance.now()-old.time<450&&isPlayer())api.openPlayerCell(old.tap);
 }
 window.addEventListener('touchstart',event=>{
  for(const touch of event.changedTouches)if(viewport.contains(touch.target))canvasTouches.add(touch.identifier);
  const list=touches(event);if(!list.length)return;
  if(list.length>=2){const p=pair(list);if(gesture?.kind!=='pinch'||gesture.ids!==p.ids)startPinch(event,list);else claim(event);return}
  const target=list[0].target,cell=target.closest('.node-cell'),interactive=target.closest('button,a,input,textarea,select,[contenteditable="true"],.resize-handle,.sub-cell-card,.child-chip,.context-menu');
  if(interactive||cell&&(!isPlayer()||window.ArchivesPlayerUI?.arranging))return;
  claim(event);api.closeContextMenus();startPan(list[0],cell?.dataset.id||null);
 },{capture:true,passive:false});
 window.addEventListener('touchmove',event=>{
  if(!gesture)return;const list=touches(event);if(!list.length)return;claim(event);
  if(list.length>=2){
   const p=pair(list);if(gesture.kind!=='pinch'||gesture.ids!==p.ids){startPinch(event,list);return}
   if(p.distance>2&&gesture.distance>2)draw(pinchCamera(gesture.camera,gesture.mid,gesture.distance,p.mid,p.distance));
  }else{
   if(gesture.kind!=='pan'||gesture.id!==list[0].identifier){startPan(list[0],null);return}
   const p=point(list[0]),dx=p.x-gesture.point.x,dy=p.y-gesture.point.y;
   if(Math.hypot(dx,dy)>6)gesture.moved=true;
   if(gesture.moved)draw({...gesture.camera,panX:gesture.camera.panX+dx,panY:gesture.camera.panY+dy});
  }
 },{capture:true,passive:false});
 window.addEventListener('touchend',event=>{
  for(const touch of event.changedTouches)canvasTouches.delete(touch.identifier);
  if(!gesture)return;claim(event);flush();const list=touches(event);
  if(list.length>=2){if(gesture.kind!=='pinch'||gesture.ids!==pair(list).ids)startPinch(event,list)}
  else if(list.length===1)startPan(list[0],null);else finish(false);
 },{capture:true,passive:false});
 window.addEventListener('touchcancel',event=>{for(const touch of event.changedTouches)canvasTouches.delete(touch.identifier);if(gesture){claim(event);finish(true)}},{capture:true,passive:false});
 window.addEventListener('blur',()=>{canvasTouches.clear();finish(true)});window.addEventListener('pagehide',()=>{canvasTouches.clear();finish(true)},{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){canvasTouches.clear();finish(true)}});
 window.addEventListener('resize',()=>{canvasTouches.clear();finish(true)});
 window.ArchivesTouchCanvas={handles:true};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
