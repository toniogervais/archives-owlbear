const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const {backend,initCloud}=require('./cloud-fixture.cjs');
const editor=page=>page.frameLocator('#viewer').frameLocator('#app');
const app=page=>page.frames().find(frame=>frame.url().includes('/archives-app-v64-v55.html'));
const backup=page=>editor(page).locator('#archives-campaign-backup');
const online=page=>backup(page).locator('#archives-online-backups');
async function until(read,label){for(let i=0;i<140;i++){if(await read())return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+label)}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const cloud=backend(),fixture=hub(),errors=[];let gm,second;
 async function device(options={}){
  const context=await browser.newContext(options);await configure(context,fixture,{sceneReady:true});
  await context.exposeBinding('cloudFixture',cloud.receive);await context.addInitScript(initCloud);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));return {context,page};
 }
 try{
  ({page:gm}=await device());await gm.goto(owl+'/room/one');await gm.locator('#archives-tool').click();
  const scenario={boards:[{id:'act',name:'Campagne privée',nodes:[{id:'secret',title:'SECRET_NUAGE_446',desc:'DESCRIPTION_MJ_446',category:'personnage',clues:[{text:'INDICE_MJ_446',revealed:false}],revealed:false,x:50,y:50,w:250,h:160}],links:[]}],activeBoardId:'act',journalPages:[{text:'JOURNAL_MJ_446'}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'SECRET_NUAGE_446'}).waitFor();
  await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');await libraryRequest({action:'import',file:new File(['ORIGINAL_PRIVE_NUAGE_446'],'document.txt',{type:'text/plain'}),name:'Document original',cellKey:'cell:act:secret'})});
  const picture=await gm.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;canvas.getContext('2d').fillRect(0,0,20,20);return canvas.toDataURL()});
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'image-privee.png',mimeType:'image/png',buffer:Buffer.from(picture.split(',')[1],'base64')});
  await app(gm).waitForFunction(()=>document.getElementById('archives-image-library-status')?.textContent.includes('ajoutée'));
  let downloads=0;gm.on('download',()=>downloads++);
  await editor(gm).locator('#canvas-save-icon').click();
  await online(gm).getByLabel('Nom de la nouvelle campagne en ligne').fill('Campagne retrouvée partout');
  await online(gm).getByRole('button',{name:'Sauvegarder dans une nouvelle campagne',exact:true}).click();
  await online(gm).getByRole('button',{name:'Ouvrir cette version…',exact:true}).waitFor();assert.equal(cloud.versions.length,1);assert.equal(downloads,0);
  await backup(gm).locator('header button').click();
  await app(gm).evaluate(()=>DuneApp.importCatalogCell({title:'AJOUT_AUTOMATIQUE_446',category:'objet',clues:[],desc:'',w:250,h:160}));
  await until(()=>cloud.versions.length===2,'automatic checkpoint without a save click');
  ({page:second}=await device({viewport:{width:820,height:1180},isMobile:true,hasTouch:true}));await second.goto(owl+'/room/one');await second.locator('#archives-tool').click();
  await editor(second).getByRole('button',{name:'Importer un scénario'}).waitFor();
  assert.equal(await app(second).evaluate(()=>DuneApp.getState().nodes.length),0);
  await editor(second).getByRole('button',{name:'Sauvegardes en ligne',exact:true}).click();
  await online(second).getByRole('button',{name:'Ouvrir cette version…',exact:true}).first().waitFor();
  assert.equal(await online(second).getByRole('button',{name:'Activer la sauvegarde automatique',exact:true}).isDisabled(),true,'new device cannot overwrite a known online campaign before opening it');
  await online(second).getByRole('button',{name:'Ouvrir cette version…',exact:true}).first().click();
  await backup(second).getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();
  await backup(second).waitFor({state:'detached'});
  assert.equal(await app(second).evaluate(()=>DuneApp.getState().nodes.length),2);
  assert.ok(await app(second).evaluate(()=>JSON.stringify(DuneApp.getState().journalPages).includes('JOURNAL_MJ_446')));
  const file=await app(second).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');const result=await libraryRequest({action:'list'});return result.entries});assert.equal(file.length,1);
  const original=await second.frames().find(frame=>frame.url().includes('/archives-host-v55.html')).evaluate(async id=>{const {openFileLibrary}=await import('./src/v60/files.mjs');const lib=await openFileLibrary('fixture-single-room','fixture-MJ');try{return await(await lib.blob(id)).text()}finally{lib.close()}},file[0].id);
  assert.equal(original,'ORIGINAL_PRIVE_NUAGE_446');
  assert.equal(await app(second).evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('ArchivesImaginaireImageLibrary',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('images'),read=tx.objectStore('images').getAll();tx.oncomplete=()=>{db.close();resolve(read.result.length)}}})),1);
  await until(()=>cloud.versions.length===3,'restored campaign checkpoint');
  await app(gm).evaluate(()=>DuneApp.importCatalogCell({title:'VIEIL_APPAREIL_446',category:'objet',clues:[],desc:'',w:250,h:160}));
  await editor(gm).locator('#canvas-save-icon').click();await online(gm).getByRole('button',{name:'Enregistrer maintenant',exact:true}).click();
  await online(gm).getByText(/Une version plus récente existe en ligne/).first().waitFor();assert.equal(cloud.versions.length,3);
  // Offline work remains local, then retries on the online event.
  await app(second).evaluate(()=>{window.__cloudOffline=true;DuneApp.importCatalogCell({title:'HORS_LIGNE_446',category:'objet',clues:[],desc:'',w:250,h:160})});
  await editor(second).locator('#canvas-save-icon').click();await online(second).getByRole('button',{name:'Enregistrer maintenant',exact:true}).click();
  await online(second).getByText(/Envoi en attente/).waitFor();assert.equal(cloud.versions.length,3);
  await app(second).evaluate(()=>{window.__cloudOffline=false;window.dispatchEvent(new Event('online'))});await until(()=>cloud.versions.length===4,'network return checkpoint');
  await online(second).getByRole('button',{name:'Actualiser',exact:true}).click();
  await online(second).getByRole('button',{name:'Ouvrir cette version…',exact:true}).first().waitFor();
  await second.screenshot({path:'/tmp/archives-cloud-tablet-v446.png'});
  // Corrupt a received block: no partial restore or local campaign loss.
  const latest=cloud.versions.at(-1),path=latest.owner_id+'/'+latest.campaign_id+'/'+latest.id+'/0',bytes=Buffer.from(cloud.objects.get(path));bytes[bytes.length-1]^=1;cloud.objects.set(path,bytes);
  await online(second).getByRole('button',{name:'Ouvrir cette version…',exact:true}).first().click();
  await backup(second).locator('.studio-status').filter({hasText:'endommagée'}).waitFor();
  assert.equal(await app(second).evaluate(()=>DuneApp.getState().nodes.length),3);
  // The same private campaign also opens in the standalone Archives, without an Owlbear room.
  const independent=await device();await independent.page.goto(archives+'/archives-app-v64-v55.html?resume=1');
  await independent.page.locator('#canvas-save-icon').click();
  const independentBackups=independent.page.locator('#archives-campaign-backup');
  const healthy=cloud.versions[1];
  await independentBackups.locator('[data-backup-id="'+healthy.id+'"]').getByRole('button',{name:'Ouvrir cette version…',exact:true}).click();
  await independentBackups.getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();
  await independentBackups.waitFor({state:'detached'});
  assert.equal(await independent.page.evaluate(()=>DuneApp.getState().nodes.length),2);
  assert.ok(await independent.page.evaluate(()=>JSON.stringify(DuneApp.getState().journalPages).includes('JOURNAL_MJ_446')));
  await independent.page.evaluate(()=>DuneApp.startNewScenario(false));
  assert.equal(await independent.page.evaluate(()=>JSON.parse(localStorage.getItem('archives-cloud-backup-v446:standalone')).enabled),false,'a new blank adventure must not overwrite the previous online campaign');
  await independent.context.close();
  const wire=JSON.stringify(await gm.evaluate(()=>window.fixture.wire()));for(const secret of ['SECRET_NUAGE_446','DESCRIPTION_MJ_446','INDICE_MJ_446','JOURNAL_MJ_446','ORIGINAL_PRIVE_NUAGE_446'])assert.ok(!wire.includes(secret),secret+' stays out of player broadcasts');
  assert.deepEqual(errors,[]);
  console.log('V4.46: full campaign saved without downloads; a fresh tablet and standalone Archives restore the campaign; secrets, journal, image library and original files, auto checkpoints, stale device refusal, offline retry and corrupt-copy rejection verified.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-cloud-failure-v446.png'}).catch(()=>{});if(second&&!second.isClosed())await second.screenshot({path:'/tmp/archives-cloud-second-failure-v446.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
