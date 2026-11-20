import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SKILLS,skillGuideEntries,parseProfileSkills,profileSkillPools} from '../profile-pools.mjs';
import {prepareEntries,searchEntries} from '../search.mjs';
import {catalogHierarchy} from '../catalog.mjs';

const p=JSON.parse(readFileSync(fileURLToPath(new URL('../data/profiles.json',import.meta.url)),'utf8'));
const guide=skillGuideEntries();
const reporter=p.find(x=>x.title==='Journaliste');

test('19 compétences actives, une formule et un attribut chacune',()=>{
 assert.equal(SKILLS.length,19);
 assert.equal(guide.length,19);
 assert.ok(guide.every(x=>x.fields.some(f=>f.label==='Attribut principal')&&x.procedure.test&&x.printedPage>=99));
});
test('Journaliste : tous les pools des 6 compétences',()=>{
 const found=profileSkillPools(reporter),actual=Object.fromEntries(found.map(x=>[x.name,x.total]));
 assert.deepEqual(actual,{Escroquerie:7,Piratage:5,'Électronique':5,Influence:8,Perception:8,'Furtivité':5});
 assert.equal(found.find(x=>x.name==='Escroquerie').attr,'CHA');
 assert.equal(found.find(x=>x.name==='Escroquerie').attributeValue,4);
});
test('bonus de spécialisation séparé, aucun +2 automatique',()=>{
 const mock={attributes:{AGI:'4',CHA:'2'},sections:{Compétences:'Combat rapproché 7 (Morsure +2), Influence 2 (Intimidation +2)'}};
 const values=profileSkillPools(mock);
 assert.equal(values[0].total,11);
 assert.equal(values[0].specialtyTotal,13);
 assert.equal(values[1].total,4);
 assert.equal(values[1].specialtyTotal,6);
});
test('attributs secondaires jamais additionnés au pool normal',()=>{
 const mock={attributes:{AGI:'3',FOR:'5',LOG:'4',INT:'2'},sections:{Compétences:'Athlétisme 3, Ingénierie 2, Perception 4'}};
 const list=profileSkillPools(mock),ath=list[0],ing=list[1],per=list[2];
 assert.equal(ath.total,6);
 assert.equal(ath.contextual.find(x=>x.attr==='FOR').total,8);
 assert.equal(ing.total,6);
 assert.equal(ing.contextual.find(x=>x.attr==='AGI').total,5);
 assert.equal(per.total,6);
 assert.equal(per.contextual.find(x=>x.attr==='LOG').total,8);
});
test('ne pas inventer de valeur magique quand le profil ne fournit pas MAG',()=>{
 const profile={attributes:{CHA:'4'},sections:{Compétences:'Conjuration 2, Escroquerie 3'}};
 const rows=profileSkillPools(profile);
 assert.equal(rows[0].total,null);
 assert.equal(rows[1].total,7);
});
test('une valeur alternative entre parenthèses reste conditionnelle',()=>{
 const profile={attributes:{AGI:'3(5)'},sections:{Compétences:'Armes à feu 4(6) (Pistolets +2)'}};
 const rows=profileSkillPools(profile);
 assert.equal(rows[0].total,7);
 assert.equal(rows[0].alternateAttributeTotal,9);
 assert.equal(rows[0].alternateRankTotal,9);
 assert.equal(rows[0].specialtyTotal,9);
});
test('le bestiaire est calculable sans lancer de dés',()=>{
 const wolf=p.find(x=>x.title==='Loup');
 const rows=profileSkillPools(wolf);
 assert.ok(rows.length>=3);
 assert.ok(rows.every(x=>x.total===null||Number.isInteger(x.total)));
});
test('la recherche Jets D6 inclut les compétences, sans perdre les autres tests',()=>{
 const fake=[
  ...guide,
  {id:'action1',kind:'action',source:'core',page:47,title:'Tirer',procedure:{test:'Armes à feu + Agilité'},topic:'combat'},
  {id:'other',kind:'equipment',source:'core',page:222,title:'Pistolet',topic:'equipement'}
 ];
 const results=searchEntries(prepareEntries(fake),{kind:'dice',limit:100});
 assert.equal(results.total,20);
 assert.equal(catalogHierarchy(fake,{kind:'dice'}).reduce((n,g)=>n+g.count,0),20);
 assert.ok(results.items.some(x=>x.title==='Escroquerie'));
 assert.ok(results.items.some(x=>x.title==='Tirer'));
 assert.ok(!results.items.some(x=>x.kind==='equipment'));
});
