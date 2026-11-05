const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.resolve(__dirname,"..",name),"utf8");
test("Transparent grimoire icon with no opaque square",()=>{
 const svg=read("icon-archives-v43.svg");
 assert.match(svg,/<svg[^>]+viewBox="0 0 64 64"/);
 assert.match(svg,/<path/);
 assert.match(svg,/<title>Les Archives de l'Imaginaire<\/title>/);
 assert.doesNotMatch(svg,/<rect/);
});
test("The same icon is used on both Owlbear navigation surfaces",()=>{
 const bg=read("src/v43/background.mjs");
 const manifest=JSON.parse(read("manifest-v43.json"));
 assert.match(bg,/icon-archives-v43\.svg/);
 assert.match(manifest.action.icon,/icon-archives-v43\.svg$/);
 assert.equal(manifest.version,"4.3.0");
});
test("The right-hand toolbar panel has only the return command",()=>{
 const pane=read("return-v43.html");
 const bg=read("src/v43/background.mjs");
 assert.equal((pane.match(/<a\s/g)||[]).length,1);
 assert.match(pane,/Retour aux Archives/);
 assert.match(pane,/focusArchives\(link\.href\)/);
 assert.match(bg,/OBR\.popover\.open\(options\)/);
 assert.match(bg,/return-v43\.html/);
 assert.doesNotMatch(bg,/window\.open\(/);
});
test("The left menu and invitations remain available",()=>{
 const manifest=JSON.parse(read("manifest-v43.json"));
 assert.match(manifest.action.popover,/index-v41\.html$/);
 assert.match(read("src/v43/background.mjs"),/OBR\.broadcast\.onMessage/);
 assert.match(read("src/v43/background.mjs"),/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(read("index-v41.html"),/Inviter les joueurs à revenir aux Archives/);
});
