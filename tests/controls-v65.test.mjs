import assert from 'node:assert/strict';
import {test} from 'node:test';
import {screenCommand,clampPanel} from '../src/v65/screen-model.mjs';
import {storageAmounts,storageText} from '../src/v65/storage-model.mjs';
import {pictureFrame} from '../src/v65/picture-model.mjs';
test('Screen requests reject unknown destinations, policies and invalid or excessive player recipients',()=>{
 for(const value of [null,{target:'URL',policy:'REQUIRED'},{target:'ARCHIVES',policy:'AUTO'},
  {target:'OWLBEAR',policy:'OPTIONAL',recipients:[]},{target:'OWLBEAR',policy:'STAY',recipients:['a']},
  {target:'ARCHIVES',policy:'OPTIONAL',recipients:Array(101).fill('a')},{target:'ARCHIVES',policy:'REQUIRED',recipients:[{id:'a'}]}])assert.throws(()=>screenCommand(value));
 assert.deepEqual(screenCommand({target:'OWLBEAR',policy:'OPTIONAL',recipients:['a','a','b'],url:'https://bad.test'}),{target:'OWLBEAR',policy:'OPTIONAL',recipients:['a','b']});
});
test('A saved floating window remains reachable after changing viewport or device orientation',()=>{
 assert.deepEqual(clampPanel({left:1400,top:1000},365,300,820,1180),{left:447,top:872});
 assert.deepEqual(clampPanel({left:-300,top:-100},365,500,360,400),{left:8,top:8});
});
test('Storage displays a browser estimate without inventing free capacity when unavailable',()=>{
 assert.deepEqual(storageAmounts({usage:8e6,quota:64e6}),{used:8e6,capacity:64e6,available:56e6,ratio:.125});
 assert.equal(storageAmounts({usage:80,quota:64}).available,0);
 for(const input of [undefined,{}, {usage:1,quota:0},{usage:-1,quota:10},{usage:1,quota:Infinity}])assert.throws(()=>storageAmounts(input));
 assert.equal(storageText(56e6),'56 Mo');
});
test('Free picture framing keeps finite bounds for zoom and translation',()=>{
 assert.deepEqual(pictureFrame({bgZoom:Infinity,bgOffsetX:NaN,bgOffsetY:-500}),{zoom:1,x:0,y:-4});
 assert.deepEqual(pictureFrame({bgZoom:.5,bgOffsetX:.2,bgOffsetY:-.25}),{zoom:.5,x:.2,y:-.25});
});
