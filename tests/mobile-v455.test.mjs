import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pinchCamera,zoomCamera,dockPosition} from '../src/v77/geometry.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);
test('Pinching keeps the exact cell point under the two moving fingers, without rounding zoom',()=>{
 const camera={panX:-63.45,panY:91.7,zoom:.87341},origin={x:183.3,y:247.8},midpoint={x:217.6,y:289.25};
 const next=pinchCamera(camera,origin,71.6,midpoint,123.4321);
 near((origin.x-camera.panX)/camera.zoom,(midpoint.x-next.panX)/next.zoom);
 near((origin.y-camera.panY)/camera.zoom,(midpoint.y-next.panY)/next.zoom);
 near(next.zoom,camera.zoom*123.4321/71.6);assert.notEqual(next.zoom,Math.round(next.zoom*100)/100);
 const restored=pinchCamera(next,midpoint,123.4321,origin,71.6);near(restored.zoom,camera.zoom);near(restored.panX,camera.panX);near(restored.panY,camera.panY);
});
test('The finger anchor remains fixed at both zoom limits and for accessible zoom buttons',()=>{
 const camera={panX:20,panY:-30,zoom:1},point={x:147.25,y:351.75};
 for(const zoom of [.001,.05,1.37,5,25]){
  const next=zoomCamera(camera,zoom,point);near(next.zoom,Math.max(.05,Math.min(5,zoom)));
  near((point.x-camera.panX)/camera.zoom,(point.x-next.panX)/next.zoom);near((point.y-camera.panY)/camera.zoom,(point.y-next.panY)/next.zoom);
 }
 assert.throws(()=>pinchCamera(camera,point,0,point,20));assert.throws(()=>zoomCamera({...camera,zoom:NaN},2,point));
});
test('Dragged player controls stay reachable after rotation, browser panning and smaller displays',()=>{
 assert.deepEqual(dockPosition({x:800,y:1100},300,64,{width:390,height:740}),{x:82,y:668});
 assert.deepEqual(dockPosition({x:-40,y:-100},64,320,{left:50,top:30,width:820,height:390}),{x:58,y:38});
 assert.deepEqual(dockPosition({x:Infinity,y:-20},52,52,{width:320,height:300}),{x:260,y:8});
});
