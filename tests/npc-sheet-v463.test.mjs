import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('archives-app-v64-v55.html','utf8');
const moduleSource=fs.readFileSync('src/v80/npc-sheet.mjs','utf8');
const context={window:{},document:{},Number,Math,String,Array,Object};
vm.runInNewContext(moduleSource.replace(/^export /gm,'')+'\nwindow.__normalize=normalizeNpcSheet;',context);
const normalize=context.window.__normalize;

test('Fiche Shadowrun 6 : caractéristiques et valeurs dérivées du modèle, sans valeurs inventées',()=>{
 const empty=normalize(null);
 assert.deepEqual(Object.keys(empty.attributes),['CON','AGI','RÉA','FOR','VOL','LOG','INT','CHA','MAG','ESS']);
 assert.deepEqual(Object.keys(empty.combat),['SD','I/DI','PA','ME','DÉPLACEMENT','DRAIN']);
 assert.equal(empty.professionnalisme,null);
 assert.equal(empty.condition.physical.total,0);
 assert.equal(empty.condition.stun.total,0);
 assert.equal(empty.attributes.CON,'');
 assert.equal(empty.sections.armes,'');
});
test('Les champs édités et les blessures restent dans le même objet de personnage',()=>{
 const first=normalize({
  professionnalisme:'3',
  attributes:{CON:'5',AGI:'4',RÉA:'3',ESS:'4,7'},
  combat:{'I/DI':'7/2','DÉPLACEMENT':'10/15/+1'},
  sections:{competences:'Combat rapproché 3',armes:'Colt America L36',equipement:'Commlink',notes:'Réaction à surveiller'},
  condition:{physical:{total:11,damage:4},stun:{total:10,damage:2}}
 });
 const saved=normalize(JSON.parse(JSON.stringify(first)));
 assert.equal(saved.professionnalisme,3);
 assert.equal(saved.attributes.CON,'5');
 assert.equal(saved.attributes.ESS,'4,7');
 assert.equal(saved.combat['I/DI'],'7/2');
 assert.equal(saved.sections.armes,'Colt America L36');
 assert.equal(saved.condition.physical.damage,4);
 assert.equal(saved.condition.stun.damage,2);
 assert.equal(normalize({condition:{physical:{total:8,damage:100}}}).condition.physical.damage,8);
 assert.equal(normalize({condition:{stun:{total:8,damage:-7}}}).condition.stun.damage,0);
});
test('Fiche PNJ : données écrites par la sauvegarde principale et jamais publiées aux joueurs',()=>{
 const method=html.slice(html.indexOf('setNpcSheet: function('),html.indexOf('copySelection: function('));
 assert.match(method,/state\.playerMode\|\|state\.strictReadOnly/);
 assert.match(method,/node\.category!=="personnage"/);
 assert.match(method,/node\.npcSheet=sheet/);
 assert.match(method,/saveState\(\)/);
 assert.match(method,/setNpcCondition: function/);
 const start=html.indexOf('// BEGIN SECURITY: player projection V4.7');
 const end=html.indexOf('// END SECURITY: player projection V4.7',start);
 const project=vm.runInNewContext(html.slice(start,end)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
 const privateSheet={professionnalisme:5,attributes:{CON:'7'},sections:{armes:'ARME_PRIVEE_NPC_463'},condition:{physical:{total:12,damage:3}}};
 const packet=project({boards:[{id:'a',name:'MJ',nodes:[
  {id:'p1',title:'Contact',category:'personnage',revealed:true,npcSheet:privateSheet,clues:[]},
  {id:'p2',title:'Autre',category:'personnage',revealed:false,npcSheet:privateSheet,clues:[]}
 ],links:[]}],activeBoardId:'a'});
 assert.ok(!JSON.stringify(packet).includes('ARME_PRIVEE_NPC_463'));
 assert.ok(!JSON.stringify(packet).includes('npcSheet'));
 assert.equal(packet.boards[0].nodes.length,1);
});
test('Fiche NPC sous le portrait, labels rouges, édition réservée au MJ',()=>{
 const brief=fs.readFileSync('src/v68/cell-brief.mjs','utf8');
 const css=fs.readFileSync('src/v80/npc-sheet.css','utf8');
 assert.match(brief,/renderNpcPanel/);
 assert.match(brief,/archives:npc-sheet/);
 assert.match(moduleSource,/isGM\(\)/);
 assert.match(moduleSource,/setNpcSheet/);
 assert.match(moduleSource,/setNpcCondition/);
 assert.match(css,/npc-stat-label/);
 assert.match(css,/#ff6b7f/);
 assert.match(html,/src\/v80\/npc-sheet\.mjs\?v=4640/);
 assert.match(html,/src\/v80\/npc-sheet\.css\?v=4640/);
});
