import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {catalogHierarchy,classifyEntry,matchFacet,EQUIPMENT_ORDER} from '../catalog.mjs';
import {prepareEntries,searchEntries} from '../search.mjs';
import {panelSize} from '../panel-size.mjs';
import {installWindowControls} from '../window-controls.mjs';

const gear=JSON.parse(readFileSync(fileURLToPath(new URL('../data/equipment.json',import.meta.url)),'utf8')).map(e=>({...e,kind:'equipment',title:e.name,topic:'equipement'}));
const hierarchy=catalogHierarchy(gear,{kind:'equipment'});

test('all equipment remains accessible through twelve explicitly named families',()=>{
 assert.equal(gear.length,1231);
 assert.equal(hierarchy.length,12);
 assert.equal(hierarchy.reduce((sum,x)=>sum+x.count,0),gear.length);
 assert.deepEqual(hierarchy.map(x=>x.name),EQUIPMENT_ORDER);
 for(const family of hierarchy){
  assert.equal(family.children.reduce((sum,c)=>sum+c.count,0),family.count);
  assert.ok(family.children.length>0);
 }
});
test('common items have useful subtype names, beyond alphabetical AK and crossbow results',()=>{
 const byName=name=>gear.find(x=>x.name===name);
 assert.equal(classifyEntry(byName('AK-97')).subcategory,'Fusils');
 assert.equal(classifyEntry(byName('Arbalète, légère')).subcategory,'Arbalètes');
 assert.equal(classifyEntry(byName('Ares Predator VI')).subcategory,'Pistolets');
 assert.equal(classifyEntry(byName('Renraku Sensei')).family,'Matrice et logiciels');
 assert.equal(classifyEntry(byName('BMW Tsarina II')).family,'Véhicules');
});
test('search facet and navigation return the same items, without losing references',()=>{
 const guns=hierarchy.find(x=>x.name==='Armes'),crossbows=guns.children.find(x=>x.name==='Arbalètes');
 const prepared=prepareEntries(gear);
 const result=searchEntries(prepared,{kind:'equipment',family:'Armes',subcategory:'Arbalètes',limit:100});
 assert.equal(result.total,crossbows.count);
 assert.equal(result.items.length,crossbows.count);
 assert.ok(result.items.every(x=>matchFacet(x,{kind:'equipment',family:'Armes',subcategory:'Arbalètes'})));
 const filtered=searchEntries(prepared,{kind:'equipment',family:'Armes',subcategory:'Fusils',query:'AK-97'});
 assert.equal(filtered.items[0].name,'AK-97');
});
test('browsing a theme provides its own chapters and subsections',()=>{
 const fixtures=[
  {id:'m',kind:'rule',title:'Soin',source:'core',page:142,topic:'magie',path:['Magie','Sorts','Sorts de Santé']},
  {id:'x',kind:'rule',title:'Combat astral',source:'core',page:130,topic:'magie',path:['Magie','Le plan astral']},
 ];
 const categories=catalogHierarchy(fixtures,{topic:'magie'});
 assert.equal(categories.length,1);
 assert.equal(categories[0].name,'Magie');
 assert.ok(categories[0].children.some(x=>x.name==='Sorts de Santé'));
 assert.equal(searchEntries(prepareEntries(fixtures),{topic:'magie',family:'Magie',subcategory:'Sorts de Santé'}).items[0].id,'m');
});
test('enlargement uses the real host dimensions and can be reduced',()=>{
 const compact=panelSize({screenWidth:1536,screenHeight:900,content:420});
 const large=panelSize({screenWidth:1536,screenHeight:900,content:420,mode:'large'});
 assert.ok(large.width>compact.width);
 assert.ok(large.height>compact.height);
 assert.ok(large.width<=1536&&large.height<=900);
 const phone=panelSize({screenWidth:360,screenHeight:720,content:420,mode:'large'});
 assert.ok(phone.width<360&&phone.height<720);
});
test('fullscreen opens the native Owlbear overlay and closes it from the modal',async()=>{
 const previous={document:globalThis.document,window:globalThis.window};
 let opened=null,closed=null;
 const makeButton=()=>({hidden:false,disabled:false,textContent:'',setAttribute(){},classList:{toggle(){}}});
 const elements={resizeButton:makeButton(),fullscreenButton:makeButton(),restoreButton:makeButton()};
 const body={dataset:{},classList:{add(){},toggle(){}}};
 try{
  globalThis.document={getElementById:id=>elements[id],body,fullscreenElement:null,addEventListener(){}};
  globalThis.window={location:{href:'https://example.org/shadowrun/index.html'}};
  const OBR={isAvailable:true,modal:{open:async x=>{opened=x;},close:async id=>{closed=id;}}};
  installWindowControls({OBR,ready:async()=>true,viewState:()=>({kind:'equipment',family:'Armes',sub:'Fusils',search:'Ares'})});
  await elements.fullscreenButton.onclick();
  assert.equal(opened.fullScreen,true);
  assert.match(opened.url,/family=Armes/);
  assert.match(opened.url,/kind=equipment/);
  globalThis.window.location.href='https://example.org/shadowrun/index.html?view=fullscreen';
  installWindowControls({OBR,ready:async()=>true,viewState:()=>({})});
  await elements.restoreButton.onclick();
  assert.equal(closed,opened.id);
 }finally{globalThis.document=previous.document;globalThis.window=previous.window;}
});
