const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=page=>page.frameLocator('#viewer').frameLocator('#app');
const app=page=>page.frames().find(frame=>/owl-(?:editor|view)=1/.test(frame.url()));
const pane=(page,id)=>editor(page).locator('#'+id+'[open]');
async function closePane(page,id){await pane(page,id).locator('header button').click();await pane(page,id).waitFor({state:'detached'})}
async function notes(page){await page.bringToFront();await editor(page).getByRole('button',{name:'Mes notes',exact:true}).click();return pane(page,'archives-player-notebook').getByRole('textbox',{name:'Mes notes personnelles'})}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let gm,player,bobPage;
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  await Promise.all([gc,pc].map(context=>configure(context,fixtureHub,{sceneReady:true})));
  gm=await gc.newPage();player=await pc.newPage();const errors=[];
  for(const page of [gm,player])page.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  const image=await gm.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=500;const ctx=c.getContext('2d');ctx.fillStyle='#b43d63';ctx.fillRect(0,0,400,500);ctx.fillStyle='#365fa4';ctx.fillRect(400,0,400,500);return c.toDataURL()});
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Nom MJ privé',links:[],nodes:[
   {id:'portrait',title:'Portrait du personnage',category:'personnage',bgImg:image,desc:'DESCRIPTION_MJ_856',secret:'SECRET_MJ_663',revealed:false,x:100,y:100,w:250,h:160,clues:[]},
   {id:'report',title:'Document connu',category:'objet',desc:'Information révélée.',revealed:true,x:400,y:100,w:250,h:160,clues:[]}
  ]},{id:'secret-act',name:'ACTE_SECRET_902',nodes:[],links:[]}],journalPages:[{text:'JOURNAL_MJ_273'}]};
  await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'Portrait du personnage'}).waitFor();
  await app(gm).evaluate(()=>{window.DuneApp.getState().selectedId='portrait';window.DuneApp.openActiveEditor()});
  await editor(gm).locator('#archives-v45-transfer-button').click();
  await gm.waitForFunction(()=>window.fixture.local().length===1);
  // The first native import still needs Owlbear's folder and image pickers.
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1});
  assert.equal(await editor(gm).locator('#archives-owl-transfer').count(),0,'direct action skips the preview and its extra submit');
  const hidden=await gm.evaluate(()=>window.fixture.local()[0]);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,0);
  assert.equal(hidden.layer,'POPOVER');assert.equal(hidden.image.width,2048);
  await editor(gm).locator('#archives-owl-direct-reveal:not([disabled])').click();
  await gm.waitForFunction(()=>window.fixture.local().length===0);
  await gm.waitForFunction(async()=> (await window.fixture.scene()).items.length===1);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1},'existing crop places directly, without either native picker');
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].id,hidden.id,'same character is updated without duplicating it');
  await editor(gm).locator('#archives-owl-frame').click();
  await pane(gm,'archives-owl-transfer').locator('[data-submit]:not([disabled])').waitFor();
  await pane(gm,'archives-owl-transfer').locator('[data-zoom]').fill('175');
  await pane(gm,'archives-owl-transfer').locator('[data-zoom]').dispatchEvent('input');
  await pane(gm,'archives-owl-transfer').getByRole('button',{name:'Placer caché',exact:true}).click();
  await pane(gm,'archives-owl-transfer').waitFor({state:'detached'});
  await gm.waitForFunction(()=>window.fixture.local().length===1);
  const framed=await gm.evaluate(()=>window.fixture.local()[0].image.url);
  assert.notEqual(framed,hidden.image.url);assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:2,download:2});
  await editor(gm).locator('#archives-owl-direct-reveal:not([disabled])').click();
  await gm.waitForFunction(async framed=>(await window.fixture.scene()).items[0]?.image.url===framed,framed);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:2,download:2},'direct placement reuses the manually adjusted framing');
  await app(gm).evaluate(()=>window.DuneApp.closeActiveEditor());
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'Portrait-bibliotheque.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
  await app(gm).waitForFunction(()=>document.getElementById('archives-image-library-status')?.textContent.includes('ajoutée'));
  await app(gm).evaluate(()=>window.ArchivesCatalogue.libraryPanel('images'));
  const libraryCard=editor(gm).locator('#archives-image-library-grid article').filter({hasText:'Portrait-bibliotheque'});
  await libraryCard.getByRole('button',{name:'Owlbear · Placer caché',exact:true}).click();
  await gm.waitForFunction(()=>window.fixture.local().length===1);
  assert.equal(await editor(gm).locator('#archives-owl-transfer').count(),0,'library character also skips a mandatory preview');
  await libraryCard.getByRole('button',{name:'Owlbear · Placer et révéler',exact:true}).click();
  await gm.waitForFunction(async()=> (await window.fixture.scene()).items.length===2);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:2,download:2},'same rendered portrait is reused across sources');
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(player).locator('.cell-title-txt').filter({hasText:'Document connu'}).waitFor();
  const top=editor(player).locator('#top-hud .hud-row>.top-group:first-child');
  assert.deepEqual(await top.locator(':scope>button').evaluateAll(items=>items.map(x=>x.id).sort()),['archives-dossier-open','quick-player-journal','quick-player-notes']);
  assert.equal(await top.locator('#tabs-bar button:not(.tab-btn)').count(),0);
  for(const id of ['canvas-save-icon','cell-catalog-icon','clear-act-button','archives-batch-open','archives-roster-open'])assert.equal(await editor(player).locator('#'+id).count(),0);
  await app(player).evaluate(()=>{const button=document.createElement('button');button.id='late-gm-button';document.querySelector('#top-hud .top-group').append(button)});
  assert.equal(await editor(player).locator('#late-gm-button').count(),0,'later insertions also follow the player allowlist');
  await (await notes(player)).fill('NOTE_PERSONNELLE_ALIX_624');
  await pane(player,'archives-player-notebook').getByRole('status').filter({hasText:'Notes enregistrées'}).waitFor();
  await closePane(player,'archives-player-notebook');
  await app(gm).evaluate(()=>{window.DuneApp.importCatalogCell({title:'Mise à jour publique',category:'objet',desc:'Nouvelle information',clues:[],w:250,h:160});window.DuneApp.toggleSelectedReveal()});
  await editor(player).locator('.cell-title-txt').filter({hasText:'Mise à jour publique'}).waitFor();
  assert.equal(await (await notes(player)).inputValue(),'NOTE_PERSONNELLE_ALIX_624','MJ snapshots do not overwrite personal notes');
  await closePane(player,'archives-player-notebook');
  await player.screenshot({path:'/tmp/archives-player-essential-controls-v64.png'});
  await player.reload();await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(player).getByRole('button',{name:'Mes notes',exact:true}).waitFor();
  assert.equal(await (await notes(player)).inputValue(),'NOTE_PERSONNELLE_ALIX_624','own notes survive a reload');
  const bob=await pc.newPage();bobPage=bob;await bob.goto(owl+'/room/one?joueur=Bob');await bob.bringToFront();await bob.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(bob).getByRole('button',{name:'Mes notes',exact:true}).waitFor();
  assert.equal(await (await notes(bob)).inputValue(),'','another player on the same browser has a separate notebook');
  const wire=JSON.stringify(await gm.evaluate(()=>window.fixture.wire()));
  for(const secret of ['NOTE_PERSONNELLE_ALIX_624','DESCRIPTION_MJ_856','SECRET_MJ_663','JOURNAL_MJ_273','ACTE_SECRET_902',image])assert.ok(!wire.includes(secret),'private content never sent: '+secret.slice(0,30));
  assert.deepEqual(errors,[]);
  console.log('V64 Chromium: direct character placement, crop reuse, player toolbar allowlist, scoped personal notes and privacy passed.');
 }catch(error){if(gm)await gm.screenshot({path:'/tmp/archives-gm-failure-v64.png'}).catch(()=>{});if(player)await player.screenshot({path:'/tmp/archives-player-failure-v64.png'}).catch(()=>{});if(bobPage){await bobPage.screenshot({path:'/tmp/archives-bob-failure-v64.png'}).catch(()=>{});for(const frame of bobPage.frames())console.error('Bob frame',frame.url(),await frame.evaluate(()=>document.body.innerText.slice(0,700)).catch(()=>''));}throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
