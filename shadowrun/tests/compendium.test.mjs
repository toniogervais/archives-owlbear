import test from 'node:test';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateLibrary,parseLibraryText,parseLibraryFileText,rollResult,inventoryText} from '../model.mjs';
import {prepareEntries,searchEntries,makeAliases,profileRolls,queryWords} from '../search.mjs';
import {createBridge} from '../bridge-core.mjs';
import {sectionExcerpt} from '../reader.mjs';
import {assembleEntries,localKeyPoints,SITUATIONS} from '../content.mjs';

const json=async name=>JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const [sources,index,equipment,profiles,rules,coverage,terminology]=await Promise.all(['sources','index','equipment','profiles','rules','coverage','terminology'].map(json));
const aliases=makeAliases(terminology.terms);
const searchData=prepareEntries([...rules,...profiles,...equipment.map(e=>({...e,kind:'equipment',topic:'equipement'})),...index]);

test('all six sources and every published reference have valid, bounded source pages',()=>{
 assert.equal(sources.length,6);assert.equal(sources.reduce((n,b)=>n+b.pageCount,0),1252);
 const ids=new Set();const books=new Map(sources.map(b=>[b.id,b]));
 for(const e of [...index,...equipment,...profiles,...rules]){
  assert.ok(!ids.has(e.id),`duplicate ${e.id}`);ids.add(e.id);
  const b=books.get(e.source);assert.ok(b,`${e.id}: unknown source`);
  assert.ok(Number.isInteger(e.page)&&e.page>=1&&e.page<=b.pageCount,`${e.id}: invalid page`);
  assert.equal(e.printedPage,e.page-b.printedOffset,`${e.id}: printed page mismatch`);
 }
 assert.equal(coverage.sections,index.length);assert.equal(coverage.profiles,profiles.length);
});

test('English profiles retain every attribute cell and every numeric value after localization',()=>{
 const numbers=s=>String(s).match(/\d+(?:[.,]\d+)?/g)||[];
 for(const e of profiles.filter(e=>['wild','companion'].includes(e.source))){
  assert.equal(e.issues.length,0,e.title);assert.equal(e.original.attributeCells.length,Object.keys(e.attributes).length,e.title);
  for(const c of e.original.attributeCells)assert.equal(typeof e.attributes[c.fr],'string',`${e.title}: ${c.label}`);
  assert.equal(e.comparison.length,e.original.attributeCells.length+Object.keys(e.original.derived).length,e.title);
  for(const c of e.comparison){assert.ok(c.source,c.en);assert.ok(c.value,c.fr);assert.deepEqual(numbers(c.value),numbers(c.source),`${e.title}: ${c.en}`);}
 }
 const furfur=profiles.find(e=>e.name.toLowerCase()==='furfur');
 assert.equal(furfur.attributes['RÉA'],'5');assert.equal(furfur.attributes['RÉS'],'4');
 assert.ok(furfur.sections.Armes.includes('VD 2E'));assert.equal(furfur.attributes.FOR,'4');
 const spirit=profiles.find(e=>e.name==='Gashadokuro');assert.equal(spirit.attributes.CON,'P+2');assert.equal(spirit.original.attributes.B,'F+2');
 const pigeon=profiles.find(e=>e.originalTitle==='noise pigeon');assert.equal(pigeon.derived['SD matriciel'],'7');assert.equal(pigeon.derived.Firewall,'3');
});

test('French and English multiword searches, accent folding and filters find the same records',()=>{
 const query=(q,options={})=>searchEntries(searchData,{query:q,limit:500,...options},aliases);
 assert.ok(query('armure renforcee').items.some(e=>e.title==='Armure renforcée'));
 assert.ok(query('hardened armor').items.some(e=>e.title==='Armure renforcée'));
 assert.ok(query('combat rapproché',{source:'wild'}).items.some(e=>e.name?.toLowerCase()==='furfur'));
 assert.ok(query('pigeon brouilleur',{kind:'creature'}).items.some(e=>e.originalTitle==='noise pigeon'));
 const matches=query('calibrage',{kind:'action',source:'hacker'});assert.ok(matches.total>0);assert.ok(matches.items.every(e=>e.kind==='action'&&e.source==='hacker'));
 const favorite=rules[0].id;assert.deepEqual(query('',{favorites:new Set([favorite])}).items.map(e=>e.id),[favorite]);
 assert.equal(query('zzzzimpossiblezzzzz').total,0);
});

test('variants remain explicitly optional and cross-links resolve',()=>{
 const ids=new Set(rules.map(r=>r.id));
 for(const r of rules){if(r.source==='companion'&&r.topic==='variantes')assert.equal(r.optional,true,r.title);for(const id of r.related)assert.ok(ids.has(id));}
 assert.ok(rules.some(r=>r.source==='companion'&&r.optional===false&&r.title.includes('enchanteur')));
 for(const source of sources)assert.ok(rules.some(r=>r.source===source.id),`no reminders for ${source.id}`);
});

test('library validation keeps the original five-book format and accepts the six-book format',()=>{
 const books=sources.map(b=>({...b,pages:Array.from({length:b.pageCount},(_,i)=>({number:i+1,text:'Source',layout:'Source'}))}));
 const six={schema:'fr.archives-imaginaire.sr6.library',version:2,books};assert.equal(validateLibrary(six),six);
 assert.ok(validateLibrary({...six,version:1,books:books.filter(b=>b.id!=='wild')}));
 assert.throws(()=>validateLibrary({...six,books:[...books.slice(1),books[1]]}));
 const damaged=structuredClone(six);damaged.books[0].pages[10].number=1;assert.throws(()=>validateLibrary(damaged));
 const unsupported=structuredClone(six);unsupported.books[5].pageCount=1;assert.throws(()=>validateLibrary(unsupported));
});

test('wild die mishaps and critical glitches use the complete dice pool',()=>{
 assert.equal(rollResult([5,6,2],1).hits,1);assert.equal(rollResult([2,4],6).hits,3);
 assert.equal(rollResult([1,1],1).critical,true);assert.equal(rollResult([1,6],1).critical,false);
});

test('imports JSON or the existing standalone HTML without executing its scripts',()=>{
 const books=sources.map(b=>({...b,pages:Array.from({length:b.pageCount},(_,i)=>({number:i+1,text:'Source',layout:'Source'}))}));
 const library={schema:'fr.archives-imaginaire.sr6.library',version:2,books};
 const json=JSON.stringify(library);
 assert.deepEqual(parseLibraryText(json),library);
 const html='<!doctype html><script>throw Error("must not execute");</script><script type="application/json" id="sr6-library">'+json+'</script>';
 assert.deepEqual(parseLibraryText(html),library);
 assert.throws(()=>parseLibraryText('<html><script id="sr6-data">{}</script></html>'),/ne contient pas/);
 assert.throws(()=>parseLibraryText('<script id="sr6-library">{}</script>'),/compatible/);
 assert.throws(()=>parseLibraryText(null),/invalide/);
});

test('the section reader ignores mentions inside paragraphs and stops at the next heading',()=>{
 const index=[{id:'a',source:'core',title:'Esquiver (L)',level:4,page:1,endPage:1},{id:'b',source:'core',title:'Bloquer (L)',level:4,page:1,endPage:1}];
 const book={pageCount:1,pages:[{text:'Introduction : Esquiver (L) est mentionné ici.\nEsquiver (L)\nLe texte précis de cette action et de ses limites se trouve ici.\nBloquer (L)\nCette autre action ne doit pas être incluse.'}]};
 const excerpt=sectionExcerpt(index[0],book,index);assert.equal(excerpt.text,'Le texte précis de cette action et de ses limites se trouve ici.');
 assert.equal(sectionExcerpt({...index[0],id:'inconnu',title:'Titre absent'},book,index),null);
});

function fixture(role='GM',archives=false){
 const calls=[];let currentRole=role;const data=new Map();const token={id:'token',name:'Garde',layer:'CHARACTER',metadata:archives?{'fr.archives-imaginaire.bridge/artwork-v58':{id:'token'}}:{}};
 const obr={isAvailable:true,room:{id:'room'},player:{id:'owner',getRole:async()=>currentRole,onChange:()=>()=>{}},scene:{isReady:async()=>true,getMetadata:async()=>({'fr.archives-imaginaire.bridge/scene-key':'scene'}),items:{getItems:async()=>[token]},local:{getItems:async()=>[]}},contextMenu:{create:async menu=>calls.push(['menu',menu]),remove:async()=>{}},modal:{open:async()=>calls.push(['open'])},notification:{show:async()=>{}}};
 const storage={inventoryKey:ctx=>JSON.stringify(ctx),getStored:async key=>data.get(key),mutateStored:async(key,fn)=>{calls.push(['write']);const value=fn(data.get(key));data.set(key,value);return value;},atomicArchivesRecord:async(room,owner,id,fn)=>{calls.push(['archives']);const rec=fn(data.get('archives')||{kind:'TOKEN',scene:'scene',npcSheet:{sections:{description:'Secret MJ'}}});data.set('archives',rec);return rec;}};
 return {obr,storage,calls,data,setRole:r=>currentRole=r};
}

test('players cannot read or modify GM inventory and no shared scene payload is written',async()=>{
 const f=fixture('PLAYER');const b=createBridge(f.obr,f.storage,equipment);
 assert.deepEqual(await b.tokens(),[]);await assert.rejects(b.read('token'),/réservé au MJ/);await assert.rejects(b.transfer('token',[{id:equipment[0].id,quantity:1}]),/réservé au MJ/);assert.deepEqual(f.calls,[]);
});

test('equipment transfer updates the private Archives sheet atomically and preserves its notes',async()=>{
 const f=fixture('GM',true);const b=createBridge(f.obr,f.storage,equipment);const id=equipment[0].id;
 await Promise.all([b.transfer('token',[{id,quantity:1}]),b.transfer('token',[{id,quantity:2}])]);
 const record=f.data.get('archives');assert.equal(record.sr6Inventory[0].quantity,3);assert.equal(record.npcSheet.sections.description,'Secret MJ');assert.ok(record.npcSheet.sections.equipement.includes(equipment[0].name));
 assert.equal(f.calls.filter(c=>c[0]==='write').length,0);
 f.setRole('PLAYER');await assert.rejects(b.remove('token',id),/réservé au MJ/);assert.equal(record.sr6Inventory[0].quantity,3);
});

test('the extension installs an explicit native menu and never a selection listener',async()=>{
 const f=fixture();const b=createBridge(f.obr,f.storage,equipment);await b.installMenu();const menu=f.calls.find(c=>c[0]==='menu')[1];
 assert.match(menu.icons[0].label,/Équipement Shadowrun/);assert.deepEqual(menu.icons[0].filter.roles,['GM']);assert.equal(f.calls.some(c=>c[0]==='open'),false);
});

test('a standalone compendium identifies its scene without sharing an inventory or sheet',async()=>{
 const f=fixture();let metadata={};f.obr.scene.getMetadata=async()=>({...metadata});f.obr.scene.setMetadata=async patch=>{metadata={...metadata,...patch};};
 const b=createBridge(f.obr,f.storage,equipment);const [a,c]=await Promise.all([b.context(),b.context()]);assert.equal(a.scene,c.scene);assert.ok(a.scene);assert.deepEqual(Object.keys(metadata),['fr.archives-imaginaire.shadowrun/scene-key']);
 metadata={};const fresh=await b.context();assert.notEqual(fresh.scene,a.scene);
 assert.equal(f.calls.some(c=>c[0]==='write'||c[0]==='archives'),false);
});


test('natural questions prioritise the playable procedure, not an outline page',()=>{
 const cases=[['quel jet de dés pour crocheter une serrure','Crocheter une serrure'],['soigner un blessé','Administrer les premiers soins'],['tirer sur une cible','Tirer avec une arme à feu'],['passer discrètement','Se déplacer sans être repéré'],['pirater une caméra','Forcer l’accès']];
 for(const [query,title] of cases){const r=searchEntries(searchData,{query,limit:1},aliases);assert.equal(r.items[0]?.title,title,query);assert.ok(r.items[0].procedure.test);}
 assert.deepEqual(queryWords('Quel jet de dés pour crocheter une serrure ?'),['des','crocheter','serrure'].filter(x=>x!=='des'));
 const typo=searchEntries(searchData,{query:'medikitt',limit:20},aliases);assert.equal(typo.corrected,true);assert.ok(typo.items.some(e=>/médikit/i.test(e.title||e.name)));
});

test('the first-aid procedure keeps its threshold, timing, effects and required kit',()=>{
 const r=rules.find(e=>e.title==='Administrer les premiers soins');
 assert.equal(r.procedure.test,'Biotech + Logique');assert.match(r.procedure.threshold,/5 − Essence/);assert.match(r.procedure.action,/minute/);assert.match(r.procedure.effect,/2 succès nets/);assert.ok(r.kit.includes('kit de premiers soins'));
 const med=rules.find(e=>e.title==='Soigner avec un médikit');assert.match(med.procedure.test,/indice du médikit \+ Logique/);
 const heal=rules.find(e=>e.title==='Récupérer naturellement de ses blessures');assert.equal(heal.procedure.test,'Constitution + Volonté');
});

test('profile quick pools use the translated attribute, never a similarly named one',()=>{
 const furfur=profiles.find(e=>e.name.toLowerCase()==='furfur');const rolls=profileRolls(furfur);
 assert.equal(rolls.find(r=>r.label==='Défense physique').value,Number(furfur.attributes['RÉA'])+Number(furfur.attributes.INT)+'D6');
 const spirit=profiles.find(e=>e.name==='Gashadokuro');assert.equal(profileRolls(spirit).length,0);
});

test('individual local PDFs can be saved progressively without accepting corrupt complete imports',()=>{
 const meta=sources[0],book={...meta,pages:Array.from({length:meta.pageCount},(_,i)=>({number:i+1,text:'Source',layout:'Source'}))};
 assert.ok(validateLibrary({schema:'fr.archives-imaginaire.sr6.library',version:2,partial:true,books:[book]}));
 assert.throws(()=>validateLibrary({schema:'fr.archives-imaginaire.sr6.library',version:2,books:[book]}));
});


test('every original index entry still resolves in the assembled catalog or the book browser',()=>{
 const {entries,replacements}=assembleEntries({rules,profiles,equipment,index});const ids=new Set(entries.map(e=>e.id));
 for(const e of index){if(e.isStructural)continue;assert.ok(ids.has(e.id)||ids.has(replacements.get(e.id)),e.id);}
 for(const s of SITUATIONS)assert.ok(rules.some(r=>r.title===s.title),s.title);
 assert.equal(profiles.filter(p=>p.source==='companion').length,26);
});

test('local key points come verbatim from the local source and never claim to translate English',()=>{
 const text='Un test de Perception + Intuition permet de remarquer les détails de la pièce. Chaque succès améliore les informations obtenues. Le personnage doit avoir le matériel adapté.';
 for(const point of localKeyPoints(text))assert.ok(text.includes(point));
 assert.deepEqual(localKeyPoints(text,'en'),[]);
});

test('a matrix action heading with an initiative marker still opens its own body',()=>{
 const idx=[{id:'a',source:'hacker',title:'Calibrage',page:1,endPage:1,level:3},{id:'b',source:'hacker',title:'Commande retardée',page:1,endPage:1,level:3}];
 const book={pageCount:1,pages:[{text:'Calibrage (I)\nCette action donne le bonus exact de son propre paragraphe.\nCommande retardée (I)\nCe second paragraphe ne concerne pas Calibrage.'}]};
 assert.equal(sectionExcerpt(idx[0],book,idx).text,'Cette action donne le bonus exact de son propre paragraphe.');
});


test('imports V2 and compressed V2.1 data without executing HTML scripts',async()=>{
 const books=sources.map(b=>({...b,pages:Array.from({length:b.pageCount},(_,i)=>({number:i+1,text:'Texte conservé',layout:'Table conservée'}))}));
 const data=JSON.stringify({books});const full='<script>throw Error("never execute");</script><script id="data" type="application/json">'+data+'</script>';
 assert.deepEqual((await parseLibraryFileText(full)).books,books);
 const packed=gzipSync(data).toString('base64');const fast='<script id="data">{"books":[]}</script><script id="sr6-packed" type="application/octet-stream">'+packed+'</script>';
 assert.deepEqual((await parseLibraryFileText(fast)).books,books);
 await assert.rejects(()=>parseLibraryFileText('<script id="sr6-packed">invalid</script>'));
});
