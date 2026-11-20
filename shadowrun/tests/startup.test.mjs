import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assembleEntries} from '../content.mjs';
import {quickCatalogHierarchy} from '../catalog.mjs';
import {prepareEntries, searchEntries} from '../search.mjs';

const read=name=>JSON.parse(readFileSync(fileURLToPath(new URL('../data/'+name+'.json',import.meta.url)),'utf8'));
const source={index:read('index'),rules:read('rules'),profiles:read('profiles'),equipment:read('equipment')};
const {entries}=assembleEntries(source);
const prepared=prepareEntries(entries);

test('démarrage direct : page initiale sans thème ni catégorie',()=>{
 const hierarchy=quickCatalogHierarchy(entries,{kind:'',topic:'',source:''});
 assert.ok(hierarchy.length>0);
 assert.equal(hierarchy.reduce((sum,item)=>sum+item.count,0),entries.length);
 assert.equal(searchEntries(prepared,{limit:75}).total,entries.length);
});

test('tous les onglets chargent leurs rubriques et leurs fiches',()=>{
 for(const kind of ['equipment','rule','action','rolls','npc','creature']){
  const sections=quickCatalogHierarchy(entries,{kind});
  const hits=searchEntries(prepared,{kind,limit:75});
  assert.ok(sections.length>0,'Aucune catégorie : '+kind);
  assert.equal(sections.reduce((sum,item)=>sum+item.count,0),hits.total,kind);
 }
});

test('les thèmes ne provoquent pas de référence manquante au chargement',()=>{
 for(const topic of ['combat','magie','matrice','rigging','equipement','pnj']){
  const sections=quickCatalogHierarchy(entries,{topic,kind:''});
  const hits=searchEntries(prepared,{topic,limit:75});
  assert.equal(sections.reduce((sum,item)=>sum+item.count,0),hits.total,topic);
  assert.ok(hits.total>0,topic);
 }
});
