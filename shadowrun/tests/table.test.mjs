import assert from 'node:assert/strict';
import test from 'node:test';
import {panelSize} from '../panel-size.mjs';
import {selectPlates} from '../table-books.mjs';
import {topicsOf,mergeTableRules} from '../themes.mjs';
import {prepareEntries,searchEntries} from '../search.mjs';
import {sectionExcerpt} from '../reader.mjs';
import {assembleEntries} from '../content.mjs';

test('short cards shrink, long illustrated cards fit the host, including a telephone',()=>{
 const host={screenWidth:1280,screenHeight:800};
 const short=panelSize({...host,content:405}),long=panelSize({...host,content:2300,wide:true});
 assert.ok(short.height<long.height&&short.width<long.width);assert.ok(long.height<=host.screenHeight);
 const phone=panelSize({screenWidth:375,screenHeight:630,content:1600,wide:true});
 assert.ok(phone.width<375&&phone.height<630);
});
test('cross-list drones, distinguish NPCs, and make skill-plus-attribute passages searchable',()=>{
 assert.deepEqual(topicsOf({kind:'equipment',category:'Drones'}),['equipement','rigging']);
 assert.deepEqual(topicsOf({kind:'npc',topic:'mj',page:135}),['pnj']);
 const source={id:'a',kind:'roll',title:'Perception',page:105,pools:['Perception + Intuition'],source:'core',topic:'combat'};
 const data=prepareEntries([source]);
 assert.equal(searchEntries(data,{kind:'rolls',topic:'competences',query:'intuition'}).items[0].id,source.id);
});
test('a portrait follows the printed caption across a page boundary',()=>{
 const art={wild:[{page:24,label:'SABRE-TOOTHED TIGER'},{page:25,label:'OTHER'}]};
 const entry={source:'wild',kind:'creature',name:'sabre-toothed tiger',page:25};
 assert.equal(selectPlates(entry,art)[0].page,24);
 assert.deepEqual(selectPlates({...entry,name:'unrelated'},art),[]);
});
test('table additions keep pre-existing properties and the original catalog untouched',()=>{
 const orig=[{id:'a',procedure:{opposition:'Défense'}}];const res=mergeTableRules(orig,{updates:{a:{procedure:{test:'Compétence + attribut'}}},rules:[{id:'b'}]});
 assert.deepEqual(res[0].procedure,{opposition:'Défense',test:'Compétence + attribut'});assert.equal(res[1].id,'b');assert.equal(orig[0].procedure.test,undefined);
});
test('known anchors stop at the actual end of the source passage',()=>{
 const text='Exemple\nLa règle précise le seuil à atteindre.\nAutre règle\nAutre réserve.';
 const book={pages:[{text}],pageCount:1,anchors:{x:[1,0,1,text.indexOf('Autre')]}};
 const index=[{id:'x',title:'Exemple',page:1,source:'core',level:2}];
 assert.equal(sectionExcerpt(index[0],book,index).text,'La règle précise le seuil à atteindre.');
});
test('the equipment recap links to its identified illustration on the description page',()=>{
 const art={feu:[{page:14,label:'Serres digitales',entries:['claws']},{page:14,label:'Tomahawk',entries:['axe']}]};
 const item={source:'feu',id:'claws',name:'Serres digitales',kind:'equipment',page:147,descriptionPage:14};
 assert.deepEqual(selectPlates(item,art).map(a=>a.entries),[['claws']]);
 assert.deepEqual(selectPlates({...item,id:'x',name:'autre équipement'},art),[]);
});

test('a two-page source section stops at the next named heading',()=>{
 const pages=[{text:'Premiers soins\nLe test suit la procédure de soins. Le résultat se poursuit sur la page suivante.'},{text:'Les limitations sont précisées ici.\nMédikit\nCette deuxième procédure est distincte.'}];
 const index=[{id:'care',source:'core',title:'Premiers soins',page:1,endPage:2,level:3},{id:'kit',source:'core',title:'Médikit',page:2,endPage:2,level:3}];
 const result=sectionExcerpt(index[0],{pages},index);
 assert.equal(result.endPage,2);
 assert.match(result.text,/limitations/);
 assert.doesNotMatch(result.text,/deuxième procédure/);
});
test('a missing section heading never falls back to an unrelated page',()=>{
 const book={pages:[{text:'Autre règle\nUn paragraphe sur une règle totalement différente.'}]};
 assert.equal(sectionExcerpt({source:'core',title:'Premiers soins',page:1},book,[]),null);
});
test('sections without verified anchors never silently absorb a third page',()=>{
 const pages=[{text:'Test\nDescription suffisamment longue pour servir de premier paragraphe.'},{text:'Suite de la description avec des conditions différentes.'},{text:'Une troisième page qui ne doit pas être mélangée.'}];
 const index=[{id:'a',source:'core',title:'Test',page:1,endPage:3,level:3}];
 const result=sectionExcerpt(index[0],{pages},index);
 assert.equal(result.endPage,2);
 assert.equal(result.truncated,true);
 assert.doesNotMatch(result.text,/troisième page/);
});
test('the index merges identical locations but keeps same-name sections in different chapters',()=>{
 const index=[
  {id:'a',source:'core',title:'Initiative',page:41,level:3,path:['Personnage'],topic:'regles'},
  {id:'b',source:'core',title:'Initiative',page:41,level:3,path:['Personnage'],topic:'regles'},
  {id:'c',source:'core',title:'Initiative',page:111,level:2,path:['Combat'],topic:'combat'}
 ];
 const result=assembleEntries({rules:[],profiles:[],equipment:[],index});
 assert.equal(result.entries.length,2);
 assert.equal(result.replacements.get('b'),'a');
 assert.equal(result.replacements.has('c'),false);
});
test('a distant recap is joined to its equipment only through a verified description page',()=>{
 const equipment=[{id:'digital',source:'feu',name:'Serres digitales',page:147,descriptionPage:14,category:'Armes'}];
 const index=[{id:'entry',source:'feu',title:'Serres digitales',page:14,level:4,path:['Arsenal'],topic:'equipement'}];
 const result=assembleEntries({rules:[],profiles:[],equipment,index});
 assert.equal(result.entries.length,1);
 assert.equal(result.replacements.get('entry'),'digital');
});
