import test from 'node:test';
import assert from 'node:assert/strict';
import {imagePlacement,normalizeCrop,zoomCropAt} from '../src/v61/token-crop.mjs';

test('Centered suggestion fills the token without stretching portrait or landscape images',() => {
  for (const [width,height] of [[1200,600],[600,1200],[900,900]]) {
    const box = imagePlacement(width,height);
    assert.equal(box.width / box.height,width / height);
    assert.equal(Math.min(box.width,box.height),512);
    assert.equal(box.x + box.width / 2,256);
    assert.equal(box.y + box.height / 2,256);
  }
});
test('Zoom preserves the source point under the mouse, and dezoom reverses the operation',() => {
  const crop = {zoom:1.2,x:0.1,y:-0.15},point = {x:0.3,y:0.65};
  const next = zoomCropAt(crop,2.4,point);
  const before = imagePlacement(1200,800,crop),after = imagePlacement(1200,800,next);
  for (const [axis,size] of [['x','width'],['y','height']]) {
    const a = (point[axis] * 512 - before[axis]) / before[size];
    const b = (point[axis] * 512 - after[axis]) / after[size];
    assert.ok(Math.abs(a - b) < 1e-12);
  }
  const back = zoomCropAt(next,crop.zoom,point);
  assert.ok(Math.abs(back.x - crop.x) < 1e-12);
  assert.ok(Math.abs(back.y - crop.y) < 1e-12);
});
test('User can dezoom beyond the automatic fit and move the image freely inside the token',() => {
  const box = imagePlacement(1000,1000,{zoom:0.5,x:0.3,y:-0.25});
  assert.equal(box.width,256);
  assert.equal(box.x,128 + 0.3 * 512);
  assert.equal(box.y,0);
  assert.deepEqual(normalizeCrop({zoom:Infinity,x:NaN,y:-100}),{zoom:1,x:0,y:-8});
  assert.deepEqual(normalizeCrop(null),{zoom:1,x:0,y:0});
  assert.throws(() => imagePlacement(0,100),/invalides/);
});
