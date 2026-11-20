import assert from 'node:assert/strict';
import test from 'node:test';
import {panelSize} from '../panel-size.mjs';
import {selectPlates} from '../table-books.mjs';
import {topicsOf,mergeTableRules} from '../themes.mjs';
import {prepareEntries,searchEntries} from '../search.mjs';
import {sectionExcerpt} from '../reader.mjs';

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
