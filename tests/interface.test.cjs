const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const root = path.resolve(__dirname, '..');
const browserSource = fs.readFileSync(path.join(__dirname, 'browser.cjs'),'utf8');
const fixture = browserSource.split('await context.addInitScript(() => {')[1].split('\n    });\n    await context.route')[0];
const source = fs.readFileSync(path.join(root, 'src/v37/host.mjs'),'utf8').replace(/^import .*;\n/gm,'')
  .replaceAll('import.meta.url', JSON.stringify('https://test.invalid/src/v37/host.mjs'));
async function setup(patch = {}) {
  const api = await import('../src/v37/session.mjs');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'archives-host-v37.html'),'utf8'), { url:'https://test.invalid/archives-host-v37.html', runScripts:'outside-only' });
  const w = dom.window;
  w.eval(fixture); Object.assign(w.testState, patch);
  w.OBR = w.fakeObr; w.createClient = () => w.fakeDb;
  w.createSession = api.createSession; w.publicConfig = api.publicConfig;
  // Route interval scheduling through this DOM, so closing it cancels all timers.
  w.watchState = (...args) => api.watchState(...args,w);
  w.eval(source);
  return { dom, w, $: id => w.document.getElementById(id) };
}
async function until(fn) { for (let i=0;i<100;i++) { if(fn())return; await new Promise(r=>setTimeout(r,5)); } throw new Error('UI condition not reached'); }
async function dispose(f) { f.w.dispatchEvent(new f.w.Event('pagehide')); f.dom.window.close(); }
test('UI: campagne retrouvée et retour sans changement de mode', async () => {
  const f = await setup(); try {
    await until(() => !f.$('mode-owlbear').disabled);
    assert.equal(f.$('campaign').value,f.w.testState.id);
    f.$('return-owlbear').click(); await until(() => f.w.testState.closes===1);
    assert.equal(f.w.testState.writes.length,0);
  } finally { await dispose(f); }
});
test('UI: refus serveur laisse les Archives ouvertes, succès confirme puis ferme', async () => {
  const f=await setup({failWrite:true}); try {
    await until(() => !f.$('mode-owlbear').disabled); f.$('mode-owlbear').click();
    await until(() => f.$('session-status').textContent.includes('Écriture refusée'));
    assert.equal(f.w.testState.closes,0);
    f.w.testState.failWrite=false; f.$('mode-owlbear').click();
    await until(() => f.w.testState.closes===1); assert.equal(f.w.testState.mode,'OWLBEAR');
  } finally { await dispose(f); }
});
test('UI: mauvaise scène refuse écriture et retour',async () => {
  const f=await setup({scene:'other'}); try {
    await until(() => !f.$('mode-owlbear').disabled); f.$('mode-owlbear').click();
    await until(() => f.$('session-status').textContent.includes('Active la scène'));
    assert.equal(f.w.testState.writes.length,0); assert.equal(f.w.testState.closes,0);
  } finally { await dispose(f); }
});
test('UI: plusieurs campagnes imposent un choix explicite',async () => {
  const f=await setup({multiple:true}); try {
    await until(() => f.$('session-status').textContent.includes('Plusieurs campagnes'));
    assert.equal(f.$('campaign').value,''); assert.equal(f.$('mode-archives').disabled,true);
    f.$('campaign').value=f.w.testState.id; f.$('campaign').dispatchEvent(new f.w.Event('change'));
    await until(() => !f.$('mode-archives').disabled);
  } finally { await dispose(f); }
});
test('UI: perte de rôle retire immédiatement le canevas',async () => {
  const f=await setup(); try {
    await until(() => !f.$('mode-archives').disabled);
    f.w.testState.role='PLAYER'; f.w.testState.roleListener({role:'PLAYER'});
    assert.equal(f.$('display').hidden,true); assert.equal(f.$('archives-frame').getAttribute('src'),null);
    assert.equal(f.$('mode-archives').disabled,true);
  } finally { await dispose(f); }
});
test('UI: rôle joueur initial ne charge jamais le canevas MJ',async () => {
  const f=await setup({role:'PLAYER'}); try {
    await until(() => f.$('session-status').textContent.includes('réservé'));
    assert.equal(f.$('archives-frame').getAttribute('src'),null); assert.equal(f.$('mode-archives').disabled,true);
  } finally { await dispose(f); }
});
test('UI: messages étrangers ignorés',async () => {
  const f=await setup(); try {
    await until(() => !f.$('mode-archives').disabled);
    f.w.dispatchEvent(new f.w.MessageEvent('message',{origin:'https://other.invalid',source:f.$('archives-frame').contentWindow,data:{type:'archives:return:v37'}}));
    f.w.dispatchEvent(new f.w.MessageEvent('message',{origin:'https://test.invalid',source:f.w,data:{type:'archives:return:v37'}}));
    assert.equal(f.w.testState.closes,0);
  } finally { await dispose(f); }
});
test('UI: hors ligne désactive les commandes, conserve le canevas',async () => {
  const f=await setup(); try {
    await until(() => !f.$('mode-archives').disabled);
    Object.defineProperty(f.w.navigator,'onLine',{value:false,configurable:true});
    f.w.dispatchEvent(new f.w.Event('offline'));
    assert.equal(f.$('mode-archives').disabled,true); assert.equal(f.$('display').hidden,false);
    f.$('mode-archives').click(); assert.equal(f.w.testState.writes.length,0);
  } finally { await dispose(f); }
});
