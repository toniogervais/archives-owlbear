const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'archives-app-v51-v37.html'),'utf8');
let checked = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=|\btype\s*=\s*["']module/.test(match[1])) continue;
  new vm.Script(match[2], { filename: 'V51-inline-' + (++checked) });
}
assert.ok(checked > 5);
assert.equal((html.match(/src="\.\/src\/v37\/embedded.mjs"/g)||[]).length,1);
assert.ok(html.includes("select('mode:active_mode,active_scene_id:owlbear_scene_id,revision,updated_at')"));
assert.ok(!html.includes("select('active_scene_id')"));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest-v37.json'),'utf8'));
for (const url of [manifest.background_url, manifest.action.popover, manifest.action.icon]) {
  assert.ok(fs.existsSync(path.join(root, new URL(url).pathname.split('/').at(-1))));
}
console.log(checked + ' inline scripts checked; schema aliases and release entry points checked.');
