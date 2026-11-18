import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const transfer=readFileSync('src/v58/transfers.mjs','utf8');
const context=readFileSync('src/v83/token-visibility.mjs','utf8');
const ui=readFileSync('src/v58/transfer-ui.mjs','utf8');
const host=readFileSync('src/v57/room-host.mjs','utf8');
const relay=readFileSync('src/v58/main-relay.mjs','utf8');

test('V4.69 — token natif Hide dans la scène Owlbear sans doublon local',()=>{
  assert.match(transfer,/\.layer\(record\.kind === "TOKEN" \? "CHARACTER" : "PROP"\)/);
  assert.doesNotMatch(transfer,/\.layer\(hidden\s*\?\s*"POPOVER"/);
  assert.match(transfer,/record\.kind!=='TOKEN'&&!shared\(record\.id\)/);
  assert.match(transfer,/OBR\.scene\.local\.addItems\(\[desired\]\)/);
  assert.ok(transfer.includes('if (hidden) item.zIndex = 0'));
});
test('V4.69 — un token en Hide reste partagé avec visible false sans disparition',()=>{
  const visibility=transfer.slice(transfer.indexOf('async function visibility'),transfer.indexOf('const safeImage'));
  assert.match(visibility,/draft\[0\]\.visible=false/);
  assert.doesNotMatch(visibility,/deleteSharedItems/);
  assert.match(visibility,/item\.visible=reveal/);
  assert.match(transfer,/privateForGM:hidden/);
  assert.match(transfer,/privateForGM:false/);
});
test('V4.67 — seules les connexions MJ synchronisent les états des tokens',()=>{
  assert.match(context,/roles:\['GM'\]/);
  assert.match(context,/await OBR\.player\.getRole\(\)!=='GM'/);
  assert.match(context,/window\.ArchivesTokenVisibility/);
  assert.match(transfer,/channel\.postMessage\(\{type:'artwork-sync',\.\.\.state\}\)/);
  assert.match(transfer,/record\.revealed=revealed/);
  assert.match(transfer,/current\.revealed=revealed/);
  assert.match(ui,/window\.ArchivesTokenSync=tokenSync/);
  assert.match(ui,/event\.data\.type==='owl-token-sync'/);
  assert.match(host,/post\('owl-token-sync'/);
  assert.match(relay,/artwork-main-sync/);
  assert.doesNotMatch(transfer,/OBR\.broadcast\.sendMessage\([^]*artwork-sync/);
});
test('V4.67 — les données confidentielles restent hors de la scène partagée',()=>{
  assert.match(transfer,/\.metadata\(\{\[assetKey\]:\{\.\.\.publicTokenMarker\(record\),privateForGM:hidden\}\}\)/);
  assert.match(transfer,/\.scene\.local\.deleteItems/);
  assert.doesNotMatch(context,/npcSheet/);
  assert.doesNotMatch(context,/sections/);
  assert.doesNotMatch(context,/sections\.notes/);
});
