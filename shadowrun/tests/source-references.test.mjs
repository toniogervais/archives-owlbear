import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {originalReferences,originalSourceLabel} from '../source-links.mjs';
import {accessFromText} from '../table-books.mjs';
const load=async id=>JSON.parse(await readFile(new URL('../data/'+id+'.json',import.meta.url),'utf8'));
const [books,index,gear,profiles,rules]=await Promise.all(['sources','index','equipment','profiles','rules'].map(load));
const all=[...index,...gear.map(e=>({...e,kind:'equipment'})),...profiles,...rules];

test('chaque entrée renvoie à au moins une vraie page du bon ouvrage',()=>{
 for(const e of all){
  const refs=originalReferences(e,books);
  assert.ok(refs.length,'Aucune page pour '+e.id);
  for(const r of refs){
   const book=books.find(b=>b.id===r.source);
   assert.ok(book,e.id+' : source inexistante');
   assert.ok(r.page>=1&&r.page<=book.pageCount,e.id+' : page hors limites');
   assert.equal(r.printedPage,r.page-book.printedOffset,e.id+' : décalage incorrect');
   assert.ok(originalSourceLabel(r).includes(book.displayTitle||book.title));
   assert.equal(new Set(refs.map(x=>x.source+':'+x.page)).size,refs.length);
  }
 }
});

test('tous les objets issus de tableaux disposent de leur page originale',()=>{
 const items=gear.filter(e=>e.origin==='table');
 assert.ok(items.length>500);
 for(const e of items){
  const originals=originalReferences({...e,kind:'equipment'},books);
  assert.ok(originals.some(r=>r.source===e.source&&r.page===(e.tablePage||e.page)&&r.facsimile),e.id);
 }
});

test('tous les profils chiffrés renvoient à leur tableau ou bloc original',()=>{
 for(const e of profiles){
  assert.ok(originalReferences(e,books).some(r=>r.page===e.page&&r.facsimile),e.id);
 }
});

test('deux exemplaires d’un même équipement conservent leurs pages et ouvrages distincts',()=>{
 const a=gear.find(x=>x.source==='core'&&x.name==='AK-97'),b=gear.find(x=>x.source==='feu'&&x.name==='AK-97');
 assert.ok(a&&b);
 const x=originalReferences({...a,kind:'equipment'},books),y=originalReferences({...b,kind:'equipment'},books);
 assert.notEqual(x[0].book,y[0].book);
 assert.equal(x.find(t=>t.facsimile).page,268);
 assert.equal(y.find(t=>t.facsimile).page,150);
});

test('description et tableau sur des pages différentes restent tous deux visibles',()=>{
 const entry={source:'core',page:268,descriptionPage:260,kind:'equipment',origin:'table'};
 const refs=originalReferences(entry,books);
 assert.deepEqual(refs.map(x=>[x.page,x.role]),[[260,'description'],[268,'table']]);
});

test('aucun faux passage pour une référence inconnue',()=>{
 assert.deepEqual(originalReferences({source:'invented',page:7,kind:'rule'},books),[]);
 assert.deepEqual(originalReferences({source:'core',page:999999,kind:'rule'},books),[]);
});

test('le lien de table privé doit être explicite et ne peut pas être deviné',()=>{
 const token='A'.repeat(32);
 assert.equal(accessFromText(token),token);
 assert.equal(accessFromText('https://example.org/shadowrun/#table='+token),token);
 assert.equal(accessFromText('https://example.org/shadowrun/?entry=abc#table='+token+'&x=1'),token);
 assert.equal(accessFromText('https://example.org/shadowrun/'),null);
 assert.equal(accessFromText('not-a-token'),null);
});
