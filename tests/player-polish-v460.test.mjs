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
test('Player toolbar keeps direct arranging and discards the three-dot panel',()=>{
 assert.doesNotMatch(playerUi,/archives-player-zoom-(?:in|out|value)/);
 assert.doesNotMatch(playerUi,/archives-player-display-open|icon\('more'\)|menuActions/);
 assert.match(playerUi,/id='archives-player-arrange'/);
 assert.match(playerUi,/arrange,command\('quick-player-center-all'/);
 assert.match(playerUi,/classList\.toggle\('player-arrange-cells',arranging\)/);
 assert.match(playerUi,/aria-pressed/);
 assert.match(playerUi,/command\('quick-grid-toggle','Grille'\)/);
 assert.match(playerUi,/command\('quick-player-undo','Annuler'\)/);
 const css=fs.readFileSync('src/v77/player.css','utf8');assert.match(css,/\.player-arrange-toggle\[aria-pressed="true"\]/);
 assert.match(css,/overflow-x:auto/);
 const touch=fs.readFileSync('src/v77/touch-canvas.mjs','utf8');assert.match(touch,/window\.ArchivesPlayerUI\?\.arranging/);
});
test('Redundant player instructions are absent from viewers',()=>{
 assert.doesNotMatch(fs.readFileSync('media-view-v60.html','utf8'),/Lecture sur ton appareil/);
 assert.doesNotMatch(fs.readFileSync('src/v60/viewer.mjs','utf8'),/Ferme-le avec la croix/);
});
