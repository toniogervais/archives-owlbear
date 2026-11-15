import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveNode,validateReserve,cellTypes} from '../src/v74/cell-reserve.mjs';
import {packBackup,inspectBackup} from '../src/v63/backup.mjs';
import fs from 'node:fs';import vm from 'node:vm';
test('Every reserve cell type retains its description, original image and GM notes, with fresh hidden clues and no canvas position',()=>{
 for(const [category]of cellTypes){
  const source={id:'old',originalId:'old',parentId:'group',x:80,y:90,title:'Réserve '+category,category,bgImg:'data:image/png;base64,aGVsbG8=',desc:'Description privée',revealed:true,clues:[{id:'old-clue',text:'Indice privé',revealed:true}],gmDetails:[{title:'Voix',text:'Note MJ'}]},node=reserveNode(source),copy=reserveNode(node);
  assert.equal(node.category,category);assert.equal(node.desc,source.desc);assert.equal(node.bgImg,source.bgImg);assert.equal(node.gmDetails[0].text,'Note MJ');assert.equal(node.revealed,false);assert.equal(node.clues[0].revealed,false);assert.notEqual(copy.clues[0].id,node.clues[0].id);for(const key of ['id','originalId','parentId','x','y'])assert.equal(node[key],undefined);
  assert.equal(source.clues[0].revealed,true,'the source is never mutated');
 }
});
test('A complete backup restores reserve originals while leaving the canvas empty and public projection unaware of the reserve',async()=>{
 const entry={id:crypto.randomUUID(),node:reserveNode({title:'LIEU_SECRET_RESERVE',category:'lieu',desc:'NOTE_SECRETE_RESERVE',bgImg:'data:image/png;base64,aGVsbG8=',clues:[]}),created:10,updated:10};validateReserve([entry]);
 const scenario={boards:[{id:'a',name:'Acte',nodes:[],links:[]}],activeBoardId:'a',cellReserve:[entry]},packed=await packBackup({scenario,files:[],images:[],presets:[]}),restored=await inspectBackup(packed.blob);
 assert.deepEqual(restored.scenario.cellReserve,[entry]);assert.equal(restored.summary.cells,0);assert.equal(restored.summary.reserve,1);
 const html=fs.readFileSync('archives-app-v64-v55.html','utf8'),start=html.indexOf('// BEGIN SECURITY: player projection V4.7'),end=html.indexOf('// END SECURITY: player projection V4.7',start),project=vm.runInNewContext(html.slice(start,end)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
 const wire=JSON.stringify(project(scenario));assert.ok(!wire.includes('RESERVE'));assert.equal(project(scenario).cellReserve,undefined);
 assert.throws(()=>validateReserve([entry,entry]),/invalide/);
});
