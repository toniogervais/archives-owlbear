const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const get = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Right toolbar icon opens official Owlbear popover', () => {
  const source = get('src/v42/background.mjs');
  assert.match(source, /OBR\.tool\.create\(/);
  assert.match(source, /onClick:\(_context,elementId\)=>\{showReturnMenu\(elementId\);return false;\}/);
  assert.match(source, /OBR\.popover\.open\(popover\)/);
  assert.match(source, /popover\.anchorElementId=elementId/);
  assert.doesNotMatch(source, /window\.open\(/);
});
test('Both top-left and toolbar use the same proven link UI', () => {
  const manifest = JSON.parse(get('manifest-v42.json'));
  const source = get('src/v42/background.mjs');
  assert.equal(manifest.version, '4.2.0');
  assert.match(manifest.action.popover, /index-v41\.html$/);
  assert.match(source, /index-v41\.html/);
  assert.match(get('index-v41.html'), /focusArchives\(goBack\.href\)/);
});
test('Players continue to receive authorized invitation messages', () => {
  const source = get('src/v42/background.mjs');
  assert.match(source, /OBR\.broadcast\.onMessage/);
  assert.match(source, /p\.role==="GM"&&p\.connectionId===event\.connectionId/);
  assert.match(source, /OBR\.modal\.open/);
  assert.match(get('archives-app-v53-v41.html'), /window\.ArchivesLiveInvitations/);
});
