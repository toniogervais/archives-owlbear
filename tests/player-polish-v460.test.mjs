import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('archives-app-v64-v55.html','utf8');
const playerUi=fs.readFileSync('src/v77/player-ui.mjs','utf8');
const audience=fs.readFileSync('src/v79/audience.mjs','utf8');
const start=html.indexOf('// BEGIN SECURITY: player projection V4.7');
const end=html.indexOf('// END SECURITY: player projection V4.7',start);
const project=vm.runInNewContext(html.slice(start,end)+'\nprojectPlayerPayload;', {Set,Array,Number,String,Object});
const namesStart=audience.indexOf('export function groupRecipients(');
const namesEnd=audience.indexOf('export function chooseAudience(',namesStart);
const group=vm.runInNewContext(audience.slice(namesStart,namesEnd).replace('export function','function')+'\ngroupRecipients;');
const scenario=(background,opacity)=>({boards:[{id:'scene',name:'Privé',nodes:[{id:'shown',title:'Visible',revealed:true,clues:[]},{id:'hidden',title:'LE_SECRET',revealed:false,clues:[]}],links:[]}],activeBoardId:'scene',bgImage:background,canvasBgOp:opacity,journalPages:[{text:'M_J_PRIVATE'}]});
test('A selected MJ canvas background is public, including opacity and removal',()=>{
 const url='data:image/png;base64,QUJD',out=project(scenario(url,46));
 assert.equal(out.bgImage,url);assert.equal(out.canvasBgOp,46);
 assert.equal(project(scenario('',75)).bgImage,'');
 assert.equal(project(scenario('javascript:alert(1)',75)).bgImage,'');
 assert.equal(project(scenario('data:image/svg+xml;base64,PHN2Zz4=',75)).bgImage,'');
 assert.equal(project(scenario('https://images.example/image.png',120)).canvasBgOp,100);
 assert.equal(project(scenario(url,-10)).canvasBgOp,0);
 assert.ok(!JSON.stringify(out).includes('LE_SECRET'));
 assert.ok(!JSON.stringify(out).includes('M_J_PRIVATE'));
});
test('The same named player is offered once but keeps both delivery routes',()=>{
 const groups=group([{id:'live1',name:'Aline',transport:'live'},{id:'owl1',name:'Aline',transport:'owl'},{id:'live2',name:'Benoît',transport:'live'}]);
 assert.equal(groups.length,2);assert.equal(groups[0].name,'Aline');assert.equal(groups[0].channels.length,2);
 assert.deepEqual(Array.from(groups[0].channels,x=>x.transport).sort(),['live','owl']);
 const ambiguous=group([{id:'live1',name:'Aline',transport:'live'},{id:'live2',name:'Aline',transport:'live'},{id:'owl1',name:'Aline',transport:'owl'}]);
 assert.equal(ambiguous.length,3,'names stay separate if same-channel identities conflict');
});
test('Player cells drag without any toolbar mode or duplicated settings',()=>{
 for (const id of ['archives-player-zoom-in','archives-player-zoom-out','archives-player-zoom-value','archives-player-display-open','archives-player-arrange','setArrange','player-arrange-cells'])
  assert.ok(!playerUi.includes(id),'removed control: '+id);
 assert.ok(playerUi.includes("command('quick-grid-toggle','Grille')"));
 assert.ok(playerUi.includes("command('quick-player-undo','Annuler')"));
 const css=fs.readFileSync('src/v77/player.css','utf8');
 assert.ok(!css.includes('player-arrange-cells')&&!css.includes('player-arrange-toggle'));
 assert.ok(css.includes('body.archives-player-ui .node-cell{cursor:move}'));
 assert.ok(css.includes('overflow-x:auto'));
 const touch=fs.readFileSync('src/v77/touch-canvas.mjs','utf8');
 assert.ok(touch.includes('if(interactive||cell)return;'));
 assert.ok(!touch.includes('ArchivesPlayerUI?.arranging'));
 assert.ok(touch.includes('directTap={id:cell.dataset.id'));
 assert.ok(touch.includes('api.openPlayerCell(tap.id)'));
 assert.ok(touch.includes('directTap=null;claim(event)'));
 assert.ok(html.includes('function onCellPressed(node, elCell, startX, startY, isTouch)'));

});
test('Redundant player instructions are absent from viewers',()=>{
 assert.doesNotMatch(fs.readFileSync('media-view-v60.html','utf8'),/Lecture sur ton appareil/);
 assert.doesNotMatch(fs.readFileSync('src/v60/viewer.mjs','utf8'),/Ferme-le avec la croix/);
});
