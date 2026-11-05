const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', filename.endsWith('.mjs') || filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.json') ? 'application/json' : filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
  res.end(fs.readFileSync(filename));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await context.addInitScript(() => {
      const id = '12345678-1234-1234-1234-123456789012';
      window.testState = { id, role: 'GM', user: { id: 'owner', email: 'mj@example.invalid' }, mode: 'ARCHIVES', scene: 'scene', writes: [], closes: 0, failWrite: false, failRead: false, multiple: false, roleListener: null, authListener: null };
      const state = window.testState;
      window.fakeDb = {
        auth: {
          getUser: async () => ({ data: { user: state.user } }),
          getSession: async () => ({ data: { session: { user: state.user } } }),
          onAuthStateChange: callback => { state.authListener = callback; return { data: { subscription: { unsubscribe() {} } } }; }
        },
        from(table) {
          let single = false; const filters = {};
          const q = { select() { return q; }, order() { return q; }, eq(key,value) { filters[key] = value; return q; }, maybeSingle() { single = true; return q; },
            then(resolve,reject) {
              if (state.failRead) return Promise.resolve({ error: new Error('Connexion interrompue') }).then(resolve,reject);
              let data = [];
              if (table === 'campaigns') data = [{ id, name: 'Campagne de test', owner_id: 'owner' }];
              if (table === 'owlbear_room_links') data = [{ campaign_id: id, room_id: 'room' }];
              if (state.multiple && table === 'campaigns') data.push({ id: '22345678-1234-1234-1234-123456789012', name: 'Autre campagne', owner_id: 'owner' });
              if (state.multiple && table === 'owlbear_room_links') data.push({ campaign_id: '22345678-1234-1234-1234-123456789012', room_id: 'room' });
              if (table === 'campaign_live_state') data = [{ active_mode: state.mode, mode: state.mode, active_scene_id: state.scene, owlbear_scene_id: state.scene, revision: 1 }];
              if (filters.id) data = data.filter(c => c.id === filters.id);
              return Promise.resolve({ data: single ? data[0] : data }).then(resolve,reject);
            }
          }; return q;
        },
        async rpc(name,args) { state.writes.push({ name,args }); if (state.failWrite) return { error: new Error('Écriture refusée') }; state.mode = args.p_mode; return { data: { revision: 2 } }; },
        channel() { return { on() { return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'),0); return this; } }; },
        removeChannel: async () => {}
      };
      window.fakeObr = { isAvailable: true, onReady: fn => fn(), room: { id: 'room' },
        player: { getRole: async () => state.role, onChange: fn => { state.roleListener = fn; return () => {}; } },
        scene: { isReady: async () => true, getMetadata: async () => ({ 'fr.archives-imaginaire.bridge/scene-key': 'scene' }) },
        modal: { close: async () => { state.closes++; } }
      };
      localStorage.setItem('archives_owlbear_public_config_v27', JSON.stringify({ url: 'https://test.supabase.co', key: 'sb_publishable_example' }));
    });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.endsWith('/assets/index-BfJgTiPE.js')) return route.fulfill({ contentType:'text/javascript', body:'export const O = window.fakeObr;' });
      if (url.endsWith('/assets/index-D5xPhma_.js')) return route.fulfill({ contentType:'text/javascript', body:'export const c = () => window.fakeDb;' });
      if (url.includes('supabase-js')) return route.fulfill({ contentType:'text/javascript', body:'window.supabase = {createClient: () => window.fakeDb};' });
      if (!url.startsWith(origin)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/archives-host-v37.html');
    await page.waitForFunction(() => document.getElementById('mode-owlbear').disabled === false);
    assert.equal(await page.locator('#campaign').inputValue(), '12345678-1234-1234-1234-123456789012');
    const frame = page.frameLocator('#archives-frame');
    await frame.locator('button[aria-label="Retour à Owlbear"]').waitFor({state:'attached'});
    await page.waitForFunction(() => document.getElementById('archives-frame').contentWindow.ArchivesEmbeddedContext?.campaignId === window.testState.id);
    assert.equal(await page.evaluate(() => typeof document.getElementById('archives-frame').contentWindow.DuneApp), 'object');
    // Existing diagnostic receives the same context when it is opened.
    await page.evaluate(() => document.getElementById('archives-frame').contentWindow.ArchivesOwlbearHealth.open());
    await frame.locator('#v45-campaign').waitFor();
    await page.waitForFunction(() => document.getElementById('archives-frame').contentDocument.getElementById('v45-campaign')?.value === window.testState.id);
    assert.equal(await frame.locator('#v45-campaign').isDisabled(), true);
    await frame.locator('#archives-sync-diag-card > button').click();
    // Return alone never writes the shared mode.
    await page.locator('#return-owlbear').click();
    assert.deepEqual(await page.evaluate(() => [testState.closes, testState.writes.length]), [1,0]);
    // Wrong scene cannot switch mode or close the editor.
    await page.evaluate(() => { testState.scene = 'other'; });
    await page.locator('#mode-owlbear').click();
    await page.waitForFunction(() => document.getElementById('session-status').textContent.includes('Active la scène'));
    assert.deepEqual(await page.evaluate(() => [testState.closes, testState.writes.length]), [1,0]);
    // Failed server write must keep the editor open.
    await page.evaluate(() => { testState.scene = 'scene'; testState.failWrite = true; });
    await page.locator('#mode-owlbear').click();
    await page.waitForFunction(() => document.getElementById('session-status').textContent.includes('Écriture refusée'));
    assert.equal(await page.evaluate(() => testState.closes), 1);
    await page.evaluate(() => { testState.failWrite = false; });
    await page.locator('#mode-owlbear').click();
    await page.waitForFunction(() => testState.closes === 2);
    assert.equal(await page.evaluate(() => testState.mode), 'OWLBEAR');
    // Offline mode buttons disabled; local editor remains loaded.
    await context.setOffline(true);
    await page.waitForFunction(() => document.getElementById('mode-archives').disabled);
    assert.equal(await page.locator('#display').isVisible(), true);
    await context.setOffline(false);
    await page.waitForFunction(() => !document.getElementById('mode-archives').disabled);
    // Role revocation removes the preparation frame.
    await page.evaluate(() => { testState.role = 'PLAYER'; testState.roleListener({role:'PLAYER'}); });
    assert.equal(await page.locator('#display').isHidden(), true);
    assert.equal(await page.locator('#mode-archives').isDisabled(), true);
    // Multiple linked campaigns never silently select the first one.
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('mode-archives').disabled);
    await page.evaluate(() => { localStorage.removeItem('archives_owlbear_last_campaign_v33:owner:room'); testState.multiple = true; });
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.getElementById('session-status').textContent.includes('Plusieurs campagnes'));
    assert.equal(await page.locator('#campaign').inputValue(), '');
    assert.equal(await page.locator('#mode-archives').isDisabled(), true);
    await page.locator('#campaign').selectOption('12345678-1234-1234-1234-123456789012');
    await page.waitForFunction(() => !document.getElementById('mode-archives').disabled);
    await page.screenshot({ path: '/tmp/archives-v37-desktop.png' });
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({ path: '/tmp/archives-v37-mobile.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: complete V51 editor, campaign context, return, writes, scene mismatch, offline, role revocation, multiple campaigns, mobile width; no JavaScript errors.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });
