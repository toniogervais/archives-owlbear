const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const {backend,initCloud}=require('./cloud-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-editor=1/.test(f.url()));
const backup=p=>editor(p).locator('#archives-campaign-backup');
const online=p=>backup(p).locator('#archives-online-backups');
const confirm=p=>editor(p).locator('#archives-delete-backup-confirm');
const size=cloud=>[...cloud.objects.values()].reduce((total,bytes)=>total+bytes.length,0);
async function until(read,label){for(let n=0;n<160;n++){if(await read())return;await new Promise(resolve=>setTimeout(resolve,100))}throw Error(label)}
async function downloadBytes(download){const stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(part);return Buffer.concat(parts)}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let gm;
 const cloud=backend(),errors=[];
 try{
  const context=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  await configure(context,hub(),{sceneReady:true});await context.exposeBinding('cloudFixture',cloud.receive);await context.addInitScript(initCloud);
  gm=await context.newPage();gm.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await gm.locator('#archives-tool').click();
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Gestion des sauvegardes',nodes:[{id:'secret',title:'SECRET_MJ_448',desc:'Description privée',category:'personnage',revealed:false,x:50,y:50,w:250,h:160,clues:[]}],links:[]}],journalPages:[{text:'JOURNAL_PRIVE_448'}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.node-cell[data-id="secret"]').waitFor();
  await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');await libraryRequest({action:'import',file:new File(['ORIGINAL_PRIVE_448'],'original.txt',{type:'text/plain'}),name:'Document privé',cellKey:'cell:act:secret'})});
  await editor(gm).locator('#canvas-save-icon').click();
  await online(gm).getByLabel('Nom de la nouvelle campagne en ligne').fill('Mes sauvegardes');
  await online(gm).getByRole('button',{name:'Sauvegarder dans une nouvelle campagne',exact:true}).click();
  await until(()=>cloud.versions.length===1,'first cloud copy');
  for(let n=2;n<=3;n++){
   await backup(gm).locator('header button').click();
   await app(gm).evaluate(n=>DuneApp.importCatalogCell({title:'Ajout '+n,category:'objet',clues:[],desc:'',w:250,h:160}),n);
   await editor(gm).locator('#canvas-save-icon').click();await online(gm).getByRole('button',{name:'Enregistrer maintenant',exact:true}).click();
   await until(()=>cloud.versions.length===n,'checkpoint '+n);
  }
  await online(gm).getByRole('button',{name:'Actualiser',exact:true}).click();await online(gm).locator('[data-backup-id]').last().waitFor();
  const originalIds=cloud.versions.map(row=>row.id),before=size(cloud),{inspectBackup}=await import('../src/v63/backup.mjs');
  let [download]=await Promise.all([gm.waitForEvent('download'),backup(gm).getByRole('button',{name:'Sauvegarder sur cet appareil',exact:true}).click()]);
  let restored=await inspectBackup(new Blob([await downloadBytes(download)]));assert.equal(restored.summary.cells,3);assert.equal(await restored.files[0].blob.text(),'ORIGINAL_PRIVE_448');
  assert.equal(cloud.versions.length,3,'local save does not create another online checkpoint');
  const first=online(gm).locator('[data-backup-id="'+originalIds[0]+'"]');
  [download]=await Promise.all([gm.waitForEvent('download'),first.getByRole('button',{name:'Télécharger sur cet appareil',exact:true}).click()]);
  restored=await inspectBackup(new Blob([await downloadBytes(download)]));assert.equal(restored.summary.cells,1,'downloading an older selected version preserves its exact content');
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.length),3,'downloading does not restore or replace the current campaign');
  await first.getByRole('checkbox').check();await online(gm).getByRole('button',{name:'Supprimer la sélection (1)',exact:true}).click();
  await confirm(gm).getByRole('button',{name:'Annuler',exact:true}).click();assert.equal(cloud.versions.length,3);assert.equal(size(cloud),before);
  await online(gm).locator('[data-backup-id="'+originalIds[1]+'"]').getByRole('checkbox').check();
  await online(gm).getByRole('button',{name:'Supprimer la sélection (2)',exact:true}).click();await confirm(gm).getByRole('button',{name:'Supprimer définitivement',exact:true}).click();
  await confirm(gm).waitFor({state:'detached'});assert.deepEqual(cloud.versions.map(row=>row.id),[originalIds[2]]);assert.ok(size(cloud)<before);assert.equal(cloud.jobs.size,0);
  let binding=await app(gm).evaluate(()=>JSON.parse(localStorage.getItem('archives-cloud-backup-v446:'+window.ArchivesCampaignScope)));
  assert.equal(binding.enabled,true);assert.equal(binding.revision,4,'deleting older versions keeps the local writer current');
  cloud.failCleanup(true);
  await online(gm).getByRole('button',{name:'Tout sélectionner',exact:true}).click();await online(gm).getByRole('button',{name:'Supprimer la sélection (1)',exact:true}).click();
  await confirm(gm).getByRole('button',{name:'Supprimer définitivement',exact:true}).click();await confirm(gm).waitFor({state:'detached'});
  assert.equal(cloud.versions.length,0);assert.equal(cloud.jobs.size,1);assert.ok(cloud.objects.size>0,'failed cleanup must remain visible and retryable');
  await online(gm).getByRole('button',{name:'Libérer l’espace restant',exact:true}).waitFor();
  binding=await app(gm).evaluate(()=>JSON.parse(localStorage.getItem('archives-cloud-backup-v446:'+window.ArchivesCampaignScope)));
  assert.equal(binding.enabled,false);assert.equal(binding.fingerprint,null);assert.equal(binding.savedAt,null);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.length),3,'deletion keeps the campaign open on the device');
  cloud.failCleanup(false);await online(gm).getByRole('button',{name:'Libérer l’espace restant',exact:true}).click();await until(()=>cloud.jobs.size===0,'retry completes cleanup');
  assert.equal(cloud.objects.size,0,'Storage bytes are actually reclaimed');assert.equal(cloud.versions.length,0,'cleanup does not recreate the latest deleted copy');
  await online(gm).getByRole('button',{name:'Activer la sauvegarde automatique',exact:true}).click();
  await until(()=>cloud.versions.length===1,'explicit reactivation after full deletion');assert.equal(cloud.versions[0].revision,6);
  assert.ok(!originalIds.includes(cloud.versions[0].id));
  await gm.screenshot({path:'/tmp/archives-backups-management-v448.png'});
  // The script remains directly selectable when Clipboard permissions are refused.
  await online(gm).getByText('Activer ou mettre à jour le stockage',{exact:true}).click();
  await app(gm).evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable')}}}));
  await online(gm).getByRole('button',{name:'Copier le script',exact:true}).click();
  const text=online(gm).getByRole('textbox',{name:'Script SQL des sauvegardes',exact:true});await text.waitFor();assert.ok((await text.inputValue()).includes('archives_delete_backups'));
  assert.equal(await text.evaluate(el=>el.selectionEnd-el.selectionStart),await text.evaluate(el=>el.value.length));
  await app(gm).evaluate(()=>{window.__cloudOffline=true});
  [download]=await Promise.all([gm.waitForEvent('download'),backup(gm).getByRole('button',{name:'Sauvegarder sur cet appareil',exact:true}).click()]);
  restored=await inspectBackup(new Blob([await downloadBytes(download)]));assert.equal(restored.summary.cells,3,'saving on the device works without a cloud connection');
  const wire=JSON.stringify(await gm.evaluate(()=>window.fixture.wire()));for(const secret of ['SECRET_MJ_448','JOURNAL_PRIVE_448','ORIGINAL_PRIVE_448'])assert.ok(!wire.includes(secret));
  assert.deepEqual(errors,[]);console.log('V4.48: current/older local archive exports, cancel/selected/all deletion, actual byte cleanup, failed-cleanup retry, automatic suspension, monotonic reactivation, clipboard fallback and private data verified.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-backups-management-failure-v448.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
