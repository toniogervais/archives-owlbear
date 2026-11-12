const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=page=>page.frameLocator('#viewer').frameLocator('#app');
const app=page=>page.frames().find(frame=>/owl-(?:editor|view)=1/.test(frame.url()));
const pane=(page,id)=>editor(page).locator('#'+id+'[open]');
const debug=message=>{if(process.env.ARCHIVES_DEBUG)console.log(message)};
async function downloadBytes(download){const stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(part);return Buffer.concat(parts)}
async function addPrivateFile(page,name,text,cellKey=''){
 return app(page).evaluate(async({name,text,cellKey})=>{
  const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'import',file:new File([text],name,{type:'text/plain'}),name,cellKey});
 },{name,text,cellKey});
}
async function closePane(page,id){await pane(page,id).locator('header button').click();await pane(page,id).waitFor({state:'detached'})}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let gm,player;
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  await Promise.all([gc,pc].map(context=>configure(context,fixtureHub,{sceneReady:true,inviteReadyDelay:100})));
  gm=await gc.newPage();player=await pc.newPage();const errors=[];
  gm.on('pageerror',error=>errors.push(error.message));player.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  const images=await gm.evaluate(()=>['#ad3949','#315e9d'].map(color=>{const canvas=document.createElement('canvas');canvas.width=400;canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,400,600);ctx.fillStyle='#edce9b';ctx.fillRect(100,150,200,250);return canvas.toDataURL()}));
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Campagne MJ',links:[],nodes:[
   {id:'alix-portrait',title:'PERSONNAGE_PRIVE_483',category:'personnage',bgImg:images[0],desc:'DESCRIPTION_PRIVEE_781',revealed:false,x:100,y:100,w:250,h:160,clues:[{text:'INDICE_SECRET_913',revealed:false}]},
   {id:'second-portrait',title:'SECOND_PRIVE_697',category:'personnage',bgImg:images[1],desc:'AUTRE_SECRET_648',revealed:false,x:420,y:100,w:250,h:160,clues:[]},
   {id:'report',title:'Rapport public',category:'objet',desc:'Description accessible aux joueurs.',revealed:true,x:100,y:360,w:250,h:160,clues:[{text:'Adresse découverte',revealed:true},{text:'INDICE_SECRET_913',revealed:false}]}
  ]}],journalPages:[{text:'JOURNAL_PRIVE_588'}]};
  await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'PERSONNAGE_PRIVE_483'}).waitFor();
  debug('presence and dossier');
  await editor(gm).locator('#archives-roster-open').click();
  await pane(gm,'archives-room-roster').locator('[data-player="fixture-Alix"]').filter({hasText:'Invitation en attente'}).waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(player).locator('.cell-title-txt').filter({hasText:'Rapport public'}).waitFor();
  await pane(gm,'archives-room-roster').locator('[data-player="fixture-Alix"] .studio-chip').filter({hasText:'Archives',exact:true}).waitFor();
  await closePane(gm,'archives-room-roster');
  await editor(player).locator('#archives-dossier-open').click();
  assert.equal(await pane(player,'archives-player-dossier').locator('.studio-card').count(),1);
  await pane(player,'archives-player-dossier').getByRole('button',{name:'Consulter',exact:true}).click();
  assert.ok((await pane(player,'archives-dossier-detail').textContent()).includes('Adresse découverte'));
  assert.ok(!(await pane(player,'archives-dossier-detail').textContent()).includes('INDICE_SECRET_913'));
  await closePane(player,'archives-dossier-detail');await closePane(player,'archives-player-dossier');
  // A player cannot bypass the private campaign interface with a forged RPC.
  await app(player).evaluate(()=>{window.__campaignReplies=[];addEventListener('message',event=>{if(event.data?.type==='owl-campaign-result')window.__campaignReplies.push(event.data)});parent.postMessage({protocol:'archives:owlbear:v56',type:'owl-campaign-command',id:crypto.randomUUID(),command:{action:'export'}},location.origin)});
  debug('batch');
  await editor(gm).locator('#archives-batch-open').click();
  const batch=()=>pane(gm,'archives-batch-transfer');
  await batch().locator('input[data-source-key="cell:act:alix-portrait"]').check();
  await batch().locator('input[data-source-key="cell:act:second-portrait"]').check();
  await batch().getByRole('button',{name:'Préparer la sélection (2)',exact:true}).click();
  await batch().getByRole('button',{name:'Placer le lot caché',exact:true}).waitFor({state:'visible'});
  const first=batch().locator('.batch-card').filter({has:editor(gm).locator('input[aria-label="Nom dans Owlbear de PERSONNAGE_PRIVE_483"]')});
  await first.locator('input:not([type])').fill('Portrait montré');
  await first.locator('input[type=range]').fill('140');await first.locator('input[type=range]').dispatchEvent('input');
  await gm.screenshot({path:'/tmp/archives-batch-desktop-v63.png'});
  await batch().getByRole('button',{name:'Placer le lot caché',exact:true}).click();
  await batch().waitFor({state:'detached'});
  await gm.waitForFunction(()=>window.fixture.local().length===2);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1},'one pair of native choices for two new renders');
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,0);
  const local=await gm.evaluate(()=>window.fixture.local());assert.notDeepEqual(local[0].position,local[1].position);
  let wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['PERSONNAGE_PRIVE_483','SECOND_PRIVE_697','DESCRIPTION_PRIVEE_781','AUTRE_SECRET_648','INDICE_SECRET_913','JOURNAL_PRIVE_588',images[0],images[1]])assert.ok(!wire.includes(secret),'private batch source: '+secret.slice(0,50));
  debug('backup export');
  const original=await addPrivateFile(gm,'DOCUMENT_PRIVE_427.txt','ORIGINAL_PRIVE_945','cell:act:alix-portrait');
  const audio=await app(gm).evaluate(async()=>{
    const bytes=new Uint8Array(2044),view=new DataView(bytes.buffer),text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i)};
    text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
    const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'import',file:new File([bytes],'SON_PRIVE_262.wav',{type:'audio/wav'}),name:'SON_PRIVE_262.wav'});
  });
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'BIBLIOTHEQUE_PRIVEE_859.png',mimeType:'image/png',buffer:Buffer.from(images[0].split(',')[1],'base64')});
  await app(gm).waitForFunction(()=>document.getElementById('archives-image-library-status')?.textContent.includes('ajoutée'));
  // The campaign export must not include records owned by another room or account.
  await app(gm).evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('archives-imaginaire-files',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction(['entries','files'],'readwrite'),id=crypto.randomUUID(),entry={id,title:'AUTRE_COMPTE_285',name:'AUTRE_COMPTE_285.txt',scope:['another-room','another-owner'],mime:'text/plain',kind:'DOCUMENT',size:3,hash:'a'.repeat(64),links:[]};tx.objectStore('entries').put(entry,['another-room','another-owner',id]);tx.objectStore('files').put(new Blob(['bad']),['another-room','another-owner',id]);tx.oncomplete=()=>{db.close();resolve()}}}));
  await editor(gm).locator('#canvas-save-icon').click();
  const backup=()=>pane(gm,'archives-campaign-backup');
  const [download]=await Promise.all([gm.waitForEvent('download'),backup().getByRole('button',{name:'Enregistrer la campagne',exact:true}).click()]);
  const bytes=await downloadBytes(download),{inspectBackup}=await import('../src/v63/backup.mjs'),decoded=await inspectBackup(new Blob([bytes]));
  assert.equal(decoded.scenario.boards[0].nodes.length,3);assert.equal(decoded.files.length,2);assert.equal(decoded.images.length,1);
  assert.equal(decoded.presets.find(item=>item.source==='cell:act:alix-portrait').value.crop.zoom,1.4);
  assert.equal(await decoded.files.find(file=>file.entry.id===original.entry.id).blob.text(),'ORIGINAL_PRIVE_945');
  assert.ok(!bytes.toString().includes('AUTRE_COMPTE_285'));
  debug('reject corrupt backup');
  const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;
  let [restoreChooser]=await Promise.all([gm.waitForEvent('filechooser'),backup().getByRole('button',{name:'Restaurer une campagne…',exact:true}).click()]);
  await restoreChooser.setFiles({name:'corrompue.archives',mimeType:'application/octet-stream',buffer:corrupted});
  await backup().locator('.studio-status').filter({hasText:'endommagé'}).waitFor();
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.length),3);
  await closePane(gm,'archives-campaign-backup');
  await app(gm).evaluate(()=>window.DuneApp.importCatalogCell({title:'APRES_SAUVEGARDE_847',category:'objet',clues:[],desc:'Ajout plus récent',w:250,h:160}));
  await addPrivateFile(gm,'AJOUT_RECENT_393.txt','Fichier ajouté après la copie.');
  await editor(gm).locator('#canvas-save-icon').click();
  [restoreChooser]=await Promise.all([gm.waitForEvent('filechooser'),backup().getByRole('button',{name:'Restaurer une campagne…',exact:true}).click()]);
  await restoreChooser.setFiles({name:'campagne.archives',mimeType:'application/octet-stream',buffer:bytes});
  await backup().getByRole('button',{name:'Restaurer cette campagne',exact:true}).waitFor();
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.length),4,'inspection changes nothing');
  debug('restore and recovery');
  await app(gm).evaluate(async id=>{const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'present',fileId:id,title:'Son partagé avant restauration'})},audio.entry.id);
  await player.locator('[id="fr.archives-imaginaire.bridge/media-view-v60"]').waitFor();
  // A failed database write must roll back the libraries and leave the current scenario intact.
  await gm.frames().find(frame=>frame.url().includes('/archives-host-v55.html')).evaluate(()=>{
    const put=IDBObjectStore.prototype.put;let fail=true;
    IDBObjectStore.prototype.put=function(...args){if(fail&&this.name==='entries'&&this.transaction.db.name==='archives-imaginaire-files'){fail=false;throw Error('Stockage de test interrompu.')}return put.apply(this,args)};
  });
  await backup().getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();
  await backup().locator('.studio-status').filter({hasText:'Stockage de test interrompu'}).waitFor();
  await player.locator('[id="fr.archives-imaginaire.bridge/media-view-v60"]').waitFor({state:'detached'});
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.length),4);
  const unchanged=await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'list'})});
  assert.equal(unchanged.entries.length,3,'failed restoration leaves the recent files intact');
  await backup().getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();
  await backup().waitFor({state:'detached'});
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.length),3);
  assert.ok((await app(gm).evaluate(()=>JSON.stringify(window.DuneApp.getState().journalPages))).includes('JOURNAL_PRIVE_588'));
  const restoredFiles=await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'list'})});
  assert.equal(restoredFiles.entries.length,3,'restoring merges files without removing recent originals');
  await editor(gm).locator('#canvas-save-icon').click();await backup().getByText('Récupérer une version précédente',{exact:true}).click();
  await backup().getByRole('button',{name:'Copie précédant la dernière restauration',exact:true}).click();
  await backup().getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();await backup().waitFor({state:'detached'});
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.length),4,'automatic recovery preserves the state before restoration');
  // Revealing one rendered token does not publish its source cell or the other token.
  debug('public dossier and focus');
  await app(gm).evaluate(()=>window.ArchivesCellTransfer.showManager());
  const transfer=()=>pane(gm,'archives-owl-transfer');
  await transfer().locator('.record').filter({hasText:'Portrait montré'}).getByRole('button',{name:'Révéler',exact:true}).click();
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===1);
  await closePane(gm,'archives-owl-transfer');
  await editor(player).locator('#archives-dossier-open').click();
  await pane(player,'archives-player-dossier').locator('h3').filter({hasText:'Portrait montré',exact:true}).waitFor();
  for(const secret of ['PERSONNAGE_PRIVE_483','SECOND_PRIVE_697','DESCRIPTION_PRIVEE_781','INDICE_SECRET_913','ORIGINAL_PRIVE_945'])assert.ok(!(await pane(player,'archives-player-dossier').textContent()).includes(secret));
  assert.deepEqual(await app(player).evaluate(()=>window.__campaignReplies),[]);
  await closePane(player,'archives-player-dossier');
  await app(gm).evaluate(()=>{window.DuneApp.getState().selectedId='alix-portrait';window.DuneApp.openActiveEditor()});
  await editor(gm).locator('#active-editor-modal').getByRole('button',{name:'Voir dans Owlbear',exact:true}).click();
  await gm.locator('#viewer').waitFor({state:'detached'});
  assert.equal((await gm.evaluate(()=>window.fixture.focus())).length,1);assert.equal((await player.evaluate(()=>window.fixture.focus())).length,0);
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher la carte Owlbear',exact:true}).click();
  await player.locator('#viewer').waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.wire()).some(packet=>packet.op==='broadcast'&&packet.value.data.type==='player-screen-state'&&packet.value.data.screen==='OWLBEAR'&&!packet.value.data.pending));
  await player.close();await gm.locator('#archives-tool').click();await editor(gm).locator('#archives-roster-open').click();
  await pane(gm,'archives-room-roster').locator('[data-player="fixture-Alix"]').filter({hasText:'Déconnecté'}).waitFor();
  assert.equal(gc.pages().length,1);assert.equal(pc.pages().length,0);assert.deepEqual(errors,[]);
  console.log('Campagne complète et originaux vérifiés, cadrages sauvegardés, restauration contrôlée et récupération, lot natif en une importation, dossier filtré, états des joueurs et recentrage dans le même onglet.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-v63-failure.png'}).catch(()=>{});if(player&&!player.isClosed())await player.screenshot({path:'/tmp/archives-player-v63-failure.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
