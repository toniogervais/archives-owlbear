import test from 'node:test';
import assert from 'node:assert/strict';
import {packBackup,inspectBackup} from '../src/v63/backup.mjs';
import {digest} from '../src/v60/files.mjs';
import {createPresence} from '../src/v63/presence.mjs';
import {publicArtwork} from '../src/v63/public-items.mjs';
import {assetKey} from '../src/v58/model.mjs';
import {campaignHost} from '../src/v63/campaign-host.mjs';

const scenario = {boards:[{id:'one',nodes:[{id:'hidden',title:'SECRET_MJ_482',revealed:false}],links:[]}],activeBoardId:'one',journalPages:[{text:'JOURNAL_PRIVE_925'}]};
async function sample() {
  const blob = new Blob(['Texte original privé.'],{type:'text/plain'});
  return {scenario,files:[{entry:{id:'b3b2ec3e-645c-44f5-982e-6c3b1988adfa',title:'Rapport',name:'original-prive.txt',mime:'text/plain',kind:'DOCUMENT',size:blob.size,hash:await digest(blob),links:['cell:one:hidden'],scope:['ANCIENNE_SALLE','ANCIEN_COMPTE'],released:true},blob}],images:[],
    presets:[{source:'cell:one:hidden',value:{identity:'a'.repeat(64),kind:'TOKEN',page:1,crop:{zoom:1.8,x:.3,y:-.1}}}],subcategories:{personnage:['Alliés']}};
}
test('One campaign file preserves original bytes, secret scenario, linked documents and token framing, without importing old account scopes',async() => {
  const original = await sample(),{blob,summary} = await packBackup(original),restored = await inspectBackup(blob);
  assert.equal(summary.cells,1);assert.equal(summary.files,1);
  assert.deepEqual(restored.scenario,scenario);
  assert.equal(await restored.files[0].blob.text(),'Texte original privé.');
  assert.deepEqual(restored.files[0].entry.links,['cell:one:hidden']);
  assert.equal(restored.files[0].entry.released,false,'restoring never publishes a file');
  assert.equal(restored.files[0].entry.scope,undefined);
  assert.deepEqual(restored.presets,original.presets);
  assert.deepEqual(restored.subcategories,{personnage:['Alliés']});
  const raw = new TextDecoder().decode(await blob.arrayBuffer());
  assert.ok(!raw.includes('ANCIENNE_SALLE'));assert.ok(!raw.includes('ANCIEN_COMPTE'));
});
test('Corrupted metadata, corrupted original bytes and truncated backups are rejected before restoration',async() => {
  const {blob} = await packBackup(await sample()),bytes = new Uint8Array(await blob.arrayBuffer());
  const alteredMetadata = bytes.slice();alteredMetadata[80] ^= 1;
  await assert.rejects(inspectBackup(new Blob([alteredMetadata])),/altéré/);
  const alteredFile = bytes.slice();alteredFile[alteredFile.length-1] ^= 1;
  await assert.rejects(inspectBackup(new Blob([alteredFile])),/endommagé/);
  await assert.rejects(inspectBackup(blob.slice(0,blob.size-4)),/manque/);
  await assert.rejects(inspectBackup(new Blob(['fake'.repeat(30)])),/n’est pas/);
});
test('Backup validation refuses active image sources and files whose original no longer matches their stored integrity hash',async() => {
  const bad = await sample();bad.images = [{id:'unsafe',name:'Image',data:'javascript:alert(1)'}];
  await assert.rejects(packBackup(bad),/image.*invalide/);
  const missing = await sample();missing.files[0].entry.hash = 'b'.repeat(64);
  await assert.rejects(packBackup(missing),/incomplet/);
});
test('Player screen status is attributed to its actual room participant and keeps disconnected participants visible',() => {
  const presence = createPresence();presence.party([{connectionId:'alix',role:'PLAYER',name:'Alix'},{connectionId:'gm',role:'GM',name:'MJ'}]);
  assert.equal(presence.report('intruder',{screen:'ARCHIVES',pending:true}),false);
  assert.equal(presence.report('alix',{screen:'ARCHIVES',pending:true,name:'FORGED_NAME',id:'another',private:'PRIVATE_EXTRA'}),true);
  assert.deepEqual(presence.list(),[{id:'alix',name:'Alix',connected:true,screen:'ARCHIVES',pending:true}]);
  presence.party([]);assert.equal(presence.list()[0].connected,false);assert.equal(presence.list()[0].pending,false);
  assert.equal(presence.report('alix',{screen:'OWLBEAR',pending:false}),false);
});
test('Player dossier receives only explicitly visible native artwork and allowlisted image fields',() => {
  const item = {id:'one',visible:true,name:'Portrait montré',layer:'CHARACTER',image:{url:'https://images.owlbear.test/public.png',mime:'image/png',width:512,height:512,privateMemo:'CACHE_SECRET'},metadata:{[assetKey]:{id:'one'},secret:'PRIVATE_METADATA'},sourceKey:'PRIVATE_CELL_KEY'};
  const result = publicArtwork([item,{...item,id:'hidden',visible:false,metadata:{[assetKey]:{id:'hidden'}}},{...item,id:'string',visible:'true',metadata:{[assetKey]:{id:'string'}}}]);
  assert.equal(result.length,1);assert.equal(result[0].title,'Portrait montré');
  for (const secret of ['CACHE_SECRET','PRIVATE_METADATA','PRIVATE_CELL_KEY']) assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(Object.keys(result[0].image).sort(),['height','mime','url','width']);
});
test('A forged player backup request cannot open any private campaign store or receive a campaign',async() => {
  const replies = [],host = campaignHost({OBR:{player:{getRole:async()=>'PLAYER'}},canEdit:()=>true,post:(type,data)=>replies.push({type,data}),snapshot:()=>scenario,store:{},replace:()=>assert.fail('player cannot restore')});
  await host.receive({id:'request',command:{action:'export',snapshot:scenario}});
  assert.equal(replies.length,1);assert.equal(replies[0].data.safe,false);assert.equal(replies[0].data.result,undefined);
});
