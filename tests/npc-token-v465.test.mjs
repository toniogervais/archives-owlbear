import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeTokenNpcSheet,privateTokenSheet,hasTokenNpcSheet,publicTokenMarker,
  updatePrivateTokenCondition,mergeTransferredTokenCondition,
  ATTRIBUTES,COMBAT
} from '../src/v82/npc-token-model.mjs';

test('V4.65 — normaliser la fiche PNJ en respectant les sections existantes',()=>{
  const sheet=normalizeTokenNpcSheet({
    professionnalisme:'4',attributes:{CON:'5',AGI:'3',MAG:'1'},
    combat:{SD:'12','I/DI':'9/2'},sections:{notes:'SECRET_NE_JAMAIS_PARTAGER',armes:'Colt L36'},
    condition:{physical:{total:11,damage:2},stun:{total:10,damage:1}}
  });
  assert.equal(ATTRIBUTES.length,10);assert.equal(COMBAT.length,6);
  assert.equal(sheet.attributes.CON,'5');
  assert.equal(sheet.combat['I/DI'],'9/2');
  assert.equal(sheet.condition.physical.damage,2);
  assert.equal(sheet.sections.notes,'SECRET_NE_JAMAIS_PARTAGER');
  assert.ok(hasTokenNpcSheet(sheet));
});
test('V4.65 — aucune caractéristique confidentielle ne passe dans le marqueur partagé',()=>{
  const record={id:'01f7b752-6ce6-4c48-81a0-43c463a6145e',
    version:'ede806a7-1b9a-45c9-bf43-0371da3b9ffb',kind:'TOKEN',
    npcSheet:normalizeTokenNpcSheet({attributes:{CON:'9'},
      sections:{notes:'TRAME_SECRETE_PERSONNAGE',equipement:'CODE_DE_SERRURE_349'}})};
  const shared=publicTokenMarker(record);
  assert.deepEqual(Object.keys(shared).sort(),['hasSheet','id','kind','version']);
  assert.equal(shared.hasSheet,true);
  assert.ok(!JSON.stringify(shared).includes('TRAME_SECRETE_PERSONNAGE'));
  assert.ok(!JSON.stringify(shared).includes('CODE_DE_SERRURE_349'));
  assert.ok(!JSON.stringify(shared).includes('"CON"'));
  assert.equal(privateTokenSheet(record).attributes.CON,'9');
  assert.equal(privateTokenSheet({...record,kind:'DOCUMENT'}),null);
  assert.equal(publicTokenMarker({...record,kind:'DOCUMENT'}).hasSheet,false);
  assert.equal(normalizeTokenNpcSheet({}),null);
  assert.equal(normalizeTokenNpcSheet(null),null);
});
test('V4.65 — l’import ne peut pas injecter une structure arbitraire dans la fiche',()=>{
  const sheet=normalizeTokenNpcSheet({
    attributes:{CON:'1'.repeat(1000),EVIL:'666'},
    sections:{notes:'N'.repeat(15000),OTHER:'abc'},
    condition:{physical:{total:999,damage:999},stun:{total:0,damage:99}}
  });
  assert.equal(sheet.attributes.CON.length,32);assert.equal(sheet.attributes.EVIL,undefined);
  assert.equal(sheet.sections.notes.length,12000);
  assert.equal(sheet.sections.OTHER,undefined);
  assert.deepEqual(sheet.condition.physical,{total:60,damage:60});
  assert.deepEqual(sheet.condition.stun,{total:0,damage:0});
});
test('V4.65 — le transfert, les lots et la fenêtre utilisent la même fiche privée',()=>{
  const transfer=readFileSync('src/v58/transfers.mjs','utf8');
  const ui=readFileSync('src/v58/transfer-ui.mjs','utf8');
  const batch=readFileSync('src/v63/batch.mjs','utf8');
  const viewer=readFileSync('src/v82/npc-token-view.mjs','utf8');
  const menu=readFileSync('src/v82/npc-token-context.mjs','utf8');
  const background=readFileSync('src/v55/background.mjs','utf8');
  assert.match(transfer,/npcSheet:npc\.sheet,npcConditionOrigin:npc\.origin/);
  assert.ok(transfer.includes('.metadata({[assetKey]:{...publicTokenMarker(record),privateForGM:hidden}})'));
  assert.match(ui,/npcSheet:node\.category==='personnage'/);
  assert.match(batch,/npcSheet:state\.kind\.value==='TOKEN'/);
  assert.match(viewer,/await OBR\.player\.getRole\(\)!=='GM'/);
  assert.match(viewer,/record\.scene!==scene/);
  assert.match(menu,/roles:\['GM'\]/);
  assert.match(background,/installNpcTokenContext/);
});

test('V4.71 — la fiche reste une action du menu natif et jamais de la sélection',()=>{
  const menu=readFileSync('src/v82/npc-token-context.mjs','utf8');
  const viewer=readFileSync('src/v82/npc-token-view.mjs','utf8');
  assert.match(menu,/OBR\\.contextMenu\\.create\\(menu\\)/);
  assert.match(menu,/label:'Caractéristiques et PV'/);
  assert.doesNotMatch(menu,/selectionChanged|OBR\\.player\\.getSelection\\(/);
  assert.doesNotMatch(viewer,/OBR\\.player\\.deselect\\(/);
});

test('V4.66 — une blessure cliquée modifie uniquement le moniteur demandé',()=>{
  const record={kind:'TOKEN',id:'agent',npcSheet:normalizeTokenNpcSheet({
    attributes:{CON:'6'},sections:{notes:'SECRET_RESTE_PRIVE'},
    condition:{physical:{total:10,damage:3},stun:{total:8,damage:2}}
  })};
  const updated=updatePrivateTokenCondition(record,'physical',{damage:7});
  assert.equal(updated.npcSheet.condition.physical.damage,7);
  assert.equal(updated.npcSheet.condition.physical.total,10);
  assert.equal(updated.npcSheet.condition.stun.damage,2);
  assert.equal(updated.npcSheet.sections.notes,'SECRET_RESTE_PRIVE');
  assert.equal(record.npcSheet.condition.physical.damage,3,'ne modifie pas la sauvegarde initiale');
  const total=updatePrivateTokenCondition(updated,'physical',{total:5});
  assert.deepEqual(total.npcSheet.condition.physical,{total:5,damage:5});
  assert.deepEqual(updatePrivateTokenCondition(total,'stun',{damage:99}).npcSheet.condition.stun,{total:8,damage:8});
  assert.throws(()=>updatePrivateTokenCondition(record,'magie',{damage:1}),/Moniteur/);
  assert.throws(()=>updatePrivateTokenCondition(record,'physical',{damage:2.5}),/entier/);
});
test('V4.66 — les valeurs de dégâts saisies dans Owlbear survivent au prochain transfert',()=>{
  const incoming={attributes:{CON:'5'},condition:{physical:{total:10,damage:3},stun:{total:9,damage:1}}};
  const initial=mergeTransferredTokenCondition(null,incoming);
  assert.deepEqual(initial.sheet.condition.physical,{total:10,damage:3});
  const old={kind:'TOKEN',npcSheet:initial.sheet,npcConditionOrigin:initial.origin};
  const edited=updatePrivateTokenCondition(old,'physical',{total:12,damage:5});
  const refreshed=mergeTransferredTokenCondition(edited,{...incoming,attributes:{CON:'8'}});
  assert.equal(refreshed.sheet.attributes.CON,'8');
  assert.deepEqual(refreshed.sheet.condition.physical,{total:12,damage:5});
  assert.deepEqual(refreshed.sheet.condition.stun,{total:9,damage:1});
  assert.deepEqual(refreshed.origin.physical,{total:10,damage:3});
  const editedInArchives=mergeTransferredTokenCondition(edited,{...incoming,condition:{
    ...incoming.condition,physical:{total:11,damage:2}
  }});
  assert.deepEqual(editedInArchives.sheet.condition.physical,{total:11,damage:2},
    'un changement explicite dans Les Archives reste prioritaire');
});
test('V4.66 — le menu PJ ne reçoit pas la commande et les fiches Owlbear sont éditables',()=>{
  const menu=readFileSync('src/v82/npc-token-context.mjs','utf8');
  const viewer=readFileSync('src/v82/npc-token-view.mjs','utf8');
  const html=readFileSync('npc-token-v82.html','utf8');
  assert.match(menu,/if\(role==='GM'&&!registered\)/);
  assert.match(menu,/role!=='GM'&&registered/);
  assert.match(menu,/OBR\.contextMenu\.remove\(id\)/);
  assert.match(menu,/roles:\['GM'\]/);
  assert.match(viewer,/scheduleSave\(kind/);
  assert.match(viewer,/store\.put\(next\)/);
  assert.match(viewer,/updatePrivateTokenCondition/);
  assert.match(html,/save-status/);
  assert.match(html,/npc-token-view\.mjs\?v=4710/);
});
