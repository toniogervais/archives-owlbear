const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = name => fs.readFileSync(path.join(root,name),'utf8');

test('V4.0 keeps its own app copy and previous reference',()=>{
 assert.ok(fs.existsSync(path.join(root,'archives-app-v51-v37.html')));
 const v52=file('archives-app-v52-v40.html');
 assert.match(v52,/window\.ArchivesLiveInvitations\s*=/);
 assert.match(v52,/conn\.on\("data", function\(data\)/);
 assert.match(v52,/archives:invite:v40/);
 assert.match(v52,/params\.get\("main"\)==="1"/);
 assert.match(v52,/src\/v40\/archives-navigation\.mjs/);
});
test('GM and players explicitly opt in',()=>{
 const v40=file('src/v40/archives-navigation.mjs');
 assert.match(v40,/Inviter les joueurs à voir la carte/);
 assert.match(v40,/Rester dans les Archives/);
 assert.match(v40,/archives_owlbear_room_url_v38/);
 assert.match(v40,/window\.open\(url,MAP_TAB\)/);
 assert.doesNotMatch(v40,/<iframe/i);
});
test('Owlbear extension accepts only invitations from room GM',()=>{
 const js=file('src/v40/background.mjs');
 assert.match(js,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(js,/OBR\.broadcast\.onMessage/);
 assert.match(js,/Retour aux Archives/);
});
test('manifest URLs target independent V4.0 assets',()=>{
 const manifest=JSON.parse(file('manifest-v40.json'));
 assert.equal(manifest.version,'4.0.0');
 assert.match(manifest.background_url,/background-v40\.html$/);
 assert.match(manifest.action.popover,/index-v40\.html$/);
});
