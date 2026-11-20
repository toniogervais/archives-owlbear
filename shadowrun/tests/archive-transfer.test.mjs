import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {toArchiveCell,encodeArchiveImport} from '../archive-transfer.mjs';
const get=n=>JSON.parse(readFileSync(fileURLToPath(new URL('../data/'+n+'.json',import.meta.url)),'utf8'));
const profiles=get('profiles'),gear=get('equipment');
const journalist=profiles.find(x=>x.title==='Journaliste');
const beast=profiles.find(x=>x.title==='Loup');
const equipment=gear.find(x=>x.name==='AK-97');

test('PNJ → cellule personnage MJ cachée avec pools de D6',()=>{
 const cell=toArchiveCell(journalist);
 assert.equal(cell.title,'Journaliste');
 assert.equal(cell.category,'personnage');
 assert.equal(cell.revealed,false);
 assert.deepEqual(cell.clues,[]);
 assert.equal(cell.npcSheet.attributes.CHA,'4');
 assert.match(cell.npcSheet.sections.competences,/Escroquerie : 3 \+ CHA 4 = 7 D6/);
 assert.match(cell.npcSheet.sections.competences,/Influence : 4 \+ CHA 4 = 8 D6/);
 assert.ok(cell.gmDetails.some(x=>x.title==='Connaissances'));
 assert.ok(cell.gmDetails.some(x=>x.title==='Pools de D6'));
});
test('Bestiaire → personnage avec pouvoirs et conditions',()=>{
 const cell=toArchiveCell(beast);
 assert.equal(cell.category,'personnage');
 assert.equal(cell.revealed,false);
 assert.ok(cell.npcSheet);
 assert.ok(cell.npcSheet.sections.competences.includes(' D6'));
});
test('Équipement → cellule objet conservant toutes les caractéristiques connues',()=>{
 const cell=toArchiveCell({...equipment,kind:'equipment'});
 assert.equal(cell.title,'AK-97');
 assert.equal(cell.category,'objet');
 assert.equal(cell.revealed,false);
 assert.ok(cell.gmDetails.some(x=>x.title==='Caractéristiques'&&x.text));
 assert.ok(cell.gmDetails.some(x=>x.title==='Catégorie et type'));
});
test('Aucune catégorie non autorisée ne devient une cellule',()=>{
 assert.throws(()=>toArchiveCell({kind:'rule',title:'Résoudre une attaque'}),/transférables/);
});
test('Transfert encodé vers les Archives, et validation du destinataire',async()=>{
 // DOM is not needed for the pure decoder, but the module registers a
 // listener at load time when imported in a browser.
 const previous=globalThis.document;
 globalThis.document={readyState:'loading',addEventListener(){}};
 try{
  const {decodeSr6Import}=await import('../../src/v84/sr6-import.mjs');
  for(const destination of ['canvas','library']){
   const payload={schema:'archives-sr6-transfer',version:1,destination,node:toArchiveCell(journalist)};
   const encoded=await encodeArchiveImport(payload);
   const decoded=await decodeSr6Import(encoded);
   assert.equal(decoded.destination,destination);
   assert.equal(decoded.node.revealed,false);
   assert.equal(decoded.node.npcSheet.attributes.CHA,'4');
  }
  const illegal={schema:'archives-sr6-transfer',version:1,destination:'canvas',node:{...toArchiveCell(journalist),revealed:true}};
  await assert.rejects(decodeSr6Import(await encodeArchiveImport(illegal)),/pas valides/);
 }finally{globalThis.document=previous;}
});
