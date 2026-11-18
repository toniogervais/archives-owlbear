import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V4.69 — un token en Hide dans Owlbear est un item CHARACTER partagé mais invisible aux joueurs',()=>{
  const code=read('src/v58/transfers.mjs');
  assert.match(code,/\.layer\(record\.kind === "TOKEN" \? "CHARACTER" : "PROP"\)/);
  assert.doesNotMatch(code,/item\.opacity\s*=\s*0/);
  assert.match(code,/if\(record\.kind==='TOKEN'\)/);
  assert.match(code,/item\.visible=reveal/);
  assert.match(code,/OBR\.scene\.items\.addItems\(\[item\]\)/);
  assert.match(code,/await OBR\.scene\.items\.updateItems\(\[existing\.id\]/);
  assert.ok(!code.includes('record.kind===\'TOKEN\'&&!shared(record.id)'),
    'le token ne doit pas exister en doublon privé');
});

test('V4.69 — l’ancien token local caché est migré sans changer de position ni être rendu visible',()=>{
  const code=read('src/v58/transfers.mjs');
  assert.match(code,/if\(record\.kind!=='TOKEN'\|\|record\.revealed===true\|\|record\.nativeVisibility===true\|\|isDeleted\(record\)/);
  assert.match(code,/item\.visible=false/);
  assert.match(code,/Object\.assign\(record,pose\(local\)\)/);
  assert.match(code,/await deleteLocalItems\(\[record\.id\]\)/);
  assert.match(code,/visibleToGM:/);
  assert.match(read('src/v58/transfer-ui.mjs'),/Localiser \(MJ\)/);
});
