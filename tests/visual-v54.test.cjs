const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("archives-app-v63-v54.html");
const css=read("src/v54/polish.css");
const js=read("src/v54/polish.js");
test("V4.14 complete manifest and permanent launcher",()=>{
 const m=JSON.parse(read("manifest-v54.json"));
 assert.equal(m.version,"4.14.0");
 for(const u of [m.background_url,m.action.popover,m.action.icon])
  assert.ok(fs.existsSync(new URL(u).pathname.split("/").at(-1)));
 for(const f of ["background-v54.html","index-v54.html","archives-host-v54.html","invite-v54.html"])
  assert.ok(fs.existsSync(f));
 for(const s of ["background","navigation","host","relay","embedded","open"])
  assert.ok(fs.existsSync("src/v54/"+s+".mjs"));
 assert.match(read("archives.html"),/archives-app-v63-v54\.html/);
 assert.match(read("src/v54/host.mjs"),/archives-app-v63-v54\.html/);
 assert.match(html,/src\/v54\/polish\.css/);
 assert.match(html,/src\/v54\/polish\.js/);
 assert.equal((html.match(/archives:edit:v54/g)||[]).length,2);
 assert.match(read("src/v54/relay.mjs"),/archives:edit:v54/);
});
test("Only fully revealed arrows have animated energy flowing along actual path",()=>{
 assert.match(html,/var revealMotion = !!\(lk\.revealed && item\.n1\.revealed && item\.n2\.revealed\)/);
 assert.match(html,/revealMotion \? '<path class="archives-reveal-current"/);
 assert.match(html,/revealLight \+ tetherHtml/);
 assert.match(css,/#links-layer g\.archives-revealed-link > path\.archives-reveal-current/);
 assert.match(css,/stroke-dashoffset:-58/);
 assert.match(css,/pointer-events:none/);
});
test("Premium buttons, transitions, glow and panels are non-invasive and respect settings",()=>{
 assert.match(css,/#quick-icon-dock > \.quick-icon-btn\.archives-v54-tap::after/);
 assert.match(css,/@keyframes archives-v54-halo/);
 assert.match(css,/@keyframes archives-v54-modal-enter/);
 assert.match(css,/backdrop-filter:blur\(12px\)/);
 assert.match(js,/node\.animate\(/);
 assert.match(js,/if\(dragging\|\|!enabled\(\)\|\|document\.hidden\|\|changed\.length>50\)return/);
 assert.match(js,/e\.target\?\.closest\?\./);
 assert.match(js,/document\.addEventListener\("click"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/body\.fx-disabled #links-layer \.archives-reveal-current/);
 assert.doesNotMatch(js,/fetch\(|localStorage|supabase|Peer\(/);
});
test("Player secrets remain protected and no extra controls were inserted",()=>{
 assert.match(html,/BEGIN SECURITY: player projection V4\.7/);
 assert.match(html,/state\.playerMode && !visibleForPlayers/);
 assert.match(read("src/v54/background.mjs"),/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(read("src/v54/relay.mjs"),/conn\.metadata\?\.secret!==secret/);
 assert.match(read("src/v54/navigation.mjs"),/backdrop-filter:blur\(10px\)/);
});
