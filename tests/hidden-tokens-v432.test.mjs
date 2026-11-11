import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Hidden Owlbear token is an opaque GM-only local item, never shared while hidden',()=>{
  const code=read('src/v58/transfers.mjs');
  assert.match(code,/\.layer\(hidden \? "POPOVER"/);
  assert.doesNotMatch(code,/item\.opacity\s*=\s*0/);
  assert.match(code,/OBR\.scene\.local\.addItems\(\[desired\]\)/);
  assert.match(code,/OBR\.scene\.local\.getItems\(item=>item\.metadata\?\.\[assetKey\]\?\.id===item\.id\)/);
  assert.match(code,/if \(reveal\) \{/);
  assert.match(code,/else if \(existing\) \{[\s\S]*?OBR\.scene\.items\.deleteItems/);
});

test('GM can find and self-heal a missing hidden token without revealing it',()=>{
  const code=read('src/v58/transfers.mjs');
  const ui=read('src/v58/transfer-ui.mjs');
  assert.match(code,/if\(!shared\(record\.id\)\?\.visible\)await queueRender\(\)/);
  assert.match(code,/const present=new Map\(actual\.map/);
  assert.match(code,/if\(!current\)\{[\s\S]*?OBR\.scene\.local\.addItems/);
  assert.match(code,/visibleToGM:/);
  assert.match(ui,/Localiser \(MJ\)/);
  assert.match(ui,/action:"focus",scene:context\.scene,assetId:record\.id/);
});
