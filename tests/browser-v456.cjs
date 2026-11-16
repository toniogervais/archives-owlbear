const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs'),{backend,initCloud}=require('./cloud-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-editor=1/.test(f.url()));
const pane=p=>editor(p).locator('#archives-campaign-backup');
const until=async(fn,label)=>{for(let n=0;n<160;n++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(label)};
async function bytes(download){const stream=await download.createReadStream(),parts=[];for await(const p of stream)parts.push(p);return Buffer.concat(parts)}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')}),cloud=backend(),fixture=hub(),contexts=[],errors=[];let failUploads=true;
 const receive=async(source,request)=>request.op==='upload'&&failUploads?{error:{message:'ENVOI_TEST_INTERROMPU'}}:cloud.receive(source,request);
 async function device(viewport){
  const c=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000});contexts.push(c);await configure(c,fixture,{sceneReady:true});await c.exposeBinding('cloudFixture',receive);await c.addInitScript(initCloud);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(owl+'/room/one');await p.locator('#archives-tool').click();return p;
 }
 let gm,phone;
 try{
  gm=await device({width:1440,height:1000});
  const picture=await gm.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#2e7d61';x.fillRect(0,0,640,480);x.fillStyle='#e4a344';x.fillRect(90,60,250,230);return c.toDataURL()});
  const scenario={activeBoardId:'a',boards:[{id:'a',name:'ACTE_PRIVE_456',nodes:[{id:'n',title:'Session complète',category:'lieu',desc:'DESCRIPTION_456',gmDescription:'SECRET_456',bgImg:picture,revealed:false,x:100,y:100,w:250,h:190,clues:[{id:'c',text:'INDICE_456',revealed:false}]}],links:[],bgImage:picture}],journalPages:[{id:'j',title:'Session',text:'JOURNAL_456',media:[]}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);await chooser.setFiles({name:'session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await editor(gm).locator('.node-cell[data-id=n]').waitFor();
  await app(gm).waitForFunction(()=>window.ArchivesCellReserve&&window.ArchivesCampaignScope);await app(gm).evaluate(async()=>{
   const {libraryRequest}=await import('./src/v60/request.mjs');await libraryRequest({action:'import',file:new File(['ORIGINAL_DOCUMENT_456'],'original.txt',{type:'text/plain'}),name:'Document original'});
   await ArchivesCellReserve.keep({title:'RESERVE_456',category:'objet',desc:'DESCRIPTION_RESERVE_456',clues:[{text:'SECRET_RESERVE_456'}]});
  });
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'original-image.png',mimeType:'image/png',buffer:Buffer.from(picture.split(',')[1],'base64')});await app(gm).waitForFunction(()=>document.getElementById('archives-image-library-status').textContent.includes('ajoutée'));
  await editor(gm).locator('#canvas-save-icon').click();assert.equal(await pane(gm).locator('#archives-backup-more').evaluate(e=>e.open),false);
  await pane(gm).getByLabel('Nom de la nouvelle campagne en ligne').fill('Ma session complète');
  await pane(gm).getByRole('button',{name:'Enregistrer en ligne',exact:true}).click();
  await pane(gm).locator(':scope > .studio-status[data-result=error]').filter({hasText:'ENVOI_TEST_INTERROMPU'}).waitFor();assert.equal(cloud.versions.length,0,'a rejected upload never appears as a successful online save');assert.equal(cloud.campaigns.length,1);
  failUploads=false;await pane(gm).getByRole('button',{name:'Enregistrer en ligne',exact:true}).click();
  await pane(gm).locator(':scope > .studio-status[data-result=saved]').waitFor();assert.equal(cloud.versions.length,1);assert.equal(cloud.campaigns.length,1,'retry uses the same session instead of creating another empty one');
  const [download]=await Promise.all([gm.waitForEvent('download'),pane(gm).getByRole('button',{name:'Sauvegarder sur cet appareil',exact:true}).click()]);
  const {inspectBackup}=await import('../src/v63/backup.mjs'),copy=await inspectBackup(new Blob([await bytes(download)]));
  assert.equal(copy.summary.cells,1);assert.equal(copy.images.length,1);assert.equal(copy.images[0].data,picture);assert.equal(copy.scenario.boards[0].nodes[0].bgImg,picture);assert.equal(copy.scenario.boards[0].nodes[0].gmDescription,'SECRET_456');assert.equal(copy.scenario.cellReserve[0].node.title,'RESERVE_456');assert.equal(await copy.files[0].blob.text(),'ORIGINAL_DOCUMENT_456');assert.equal(cloud.versions.length,1,'a local file download does not write to the cloud');
  await pane(gm).locator('header button').click();await app(gm).evaluate(()=>{DuneApp.setGmDescription('n','MODIFICATION_MANUELLE_456');window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'))});await new Promise(r=>setTimeout(r,1300));assert.equal(cloud.versions.length,1);
  phone=await device({width:390,height:844});await editor(phone).getByRole('button',{name:'Sauvegardes en ligne',exact:true}).click();await pane(phone).getByRole('button',{name:'Reprendre la dernière sauvegarde',exact:true}).click();await pane(phone).getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();await pane(phone).waitFor({state:'detached'});
  const restored=await app(phone).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs'),files=await libraryRequest({action:'list'}),{openCellReserve}=await import('./src/v74/cell-reserve.mjs'),key=JSON.parse(ArchivesCampaignScope),reserve=await openCellReserve(...key);try{return {state:DuneApp.getState(),files:files.entries,reserve:await reserve.list(),images:await ArchivesImageLibrary.refresh()}}finally{reserve.close()}});
  assert.equal(restored.state.nodes[0].gmDescription,'SECRET_456');assert.equal(restored.state.nodes[0].bgImg,picture);assert.ok(JSON.stringify(restored.state.journalPages).includes('JOURNAL_456'));assert.equal(restored.images[0].data,picture);assert.equal(restored.files.length,1);assert.equal(restored.reserve[0].node.title,'RESERVE_456');
  await app(phone).evaluate(()=>ArchivesCatalogue.libraryPanel('images'));const gallery=editor(phone).locator('#archives-library-popout');await gallery.locator('#archives-image-library-grid img').first().waitFor();assert.equal(await gallery.locator('#archives-image-tools').evaluate(e=>e.open),false);
  const geometry=await gallery.locator('#archives-image-library-grid img').first().evaluate(img=>{const r=img.getBoundingClientRect(),grid=img.closest('#archives-image-library-grid');return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,gridScroll:getComputedStyle(grid).overflowY}});
  assert.ok(geometry.top<geometry.viewport*.5&&geometry.bottom<geometry.viewport&&geometry.height>=160,JSON.stringify(geometry));assert.equal(geometry.gridScroll,'visible','the whole library uses one scroll area');
  await gallery.getByRole('button',{name:/^Agrandir l’image /}).first().tap();await editor(phone).locator('#archives-image-full-preview img').waitFor();await editor(phone).getByRole('button',{name:'Fermer l’aperçu complet',exact:true}).tap();
  await gallery.locator(':scope > div > div:first-child').getByRole('button',{name:'✕ Fermer',exact:true}).tap();await gallery.waitFor({state:'detached'});
  await app(phone).evaluate(()=>ArchivesCellReserve.open());const reserve=editor(phone).locator('#archives-library-popout');await reserve.locator('#archives-reserve-grid article').waitFor();assert.equal(await reserve.locator('#archives-reserve-tools').evaluate(e=>e.open),false);await reserve.getByRole('button',{name:'Lire la fiche',exact:true}).tap();
  const reader=editor(phone).locator('#archives-reserve-reader[open]');assert.ok((await reader.innerText()).includes('DESCRIPTION_RESERVE_456'));assert.equal(await reader.locator('.archives-library-reader-text').evaluate(e=>getComputedStyle(e).overflowY),'visible');await reader.getByRole('button',{name:'Fermer reserve_456',exact:true}).tap();await phone.screenshot({path:'/tmp/archives-v456-bibliotheque-mobile.png'});
  await reserve.locator(':scope > div > div:first-child').getByRole('button',{name:'✕ Fermer',exact:true}).tap();await reserve.waitFor({state:'detached'});await editor(phone).locator('#canvas-save-icon').click();await phone.screenshot({path:'/tmp/archives-v456-sauvegarde-mobile.png'});
  assert.deepEqual(errors,[]);console.log('V4.56: failed upload stays visibly failed, one-click retry, complete local archive and fresh-phone restore retain original images, document, private cell, reserve and journal; manual mode, visible mobile thumbnails, one library scroll and readable cell sheet passed.');
 }catch(error){console.log('PAGE_ERRORS',JSON.stringify(errors));for(const [p,name]of [[gm,'gm'],[phone,'phone']])if(p)await p.screenshot({path:'/tmp/archives-v456-'+name+'-failure.png'}).catch(()=>{});throw error}
 finally{for(const c of contexts)await c.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
