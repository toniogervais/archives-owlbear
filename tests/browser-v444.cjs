const {media,surface,waitMedia,closeMedia}=require('./presented-image.cjs');
const assert=require('node:assert/strict'),{chromium}=require('playwright'),{owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const until=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(label)};
const background=p=>p.frames().find(f=>f.url().includes('background-v55.html'));
const local=p=>p.evaluate(()=>window.fixture.local()),shared=p=>p.evaluate(async()=>(await window.fixture.scene()).items);
const records=p=>background(p).evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('archives-imaginaire-private-artwork',2);open.onsuccess=()=>{const db=open.result,r=db.transaction('artwork').objectStore('artwork').getAll();r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)};open.onerror=()=>reject(open.error)}));
async function transfer(p,image,reveal){
 await app(p).evaluate(image=>ArchivesCellTransfer.sendImage(image),image);
 const dialog=editor(p).locator('#archives-owl-transfer[open]');await dialog.locator('[data-submit]:not([disabled])').waitFor();
 await dialog.getByRole('button',{name:reveal?'Placer en Show (joueurs)':'Placer en Hide (joueurs)',exact:true}).click();await dialog.waitFor({state:'detached'});
}
async function openArchives(p){await p.locator('#archives-tool').click();await editor(p).locator('#world').waitFor();await app(p).waitForFunction(()=>!!window.ArchivesCellTransfer)}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  const h=hub(),gc=await browser.newContext({viewport:{width:1280,height:900}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});for(const c of [gc,pc])await configure(c,h,{sceneReady:true});
  const gm=await gc.newPage(),player=await pc.newPage(),errors=[];if(process.env.ARCHIVES_DEBUG)gm.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('BROWSER',m.text())});for(const p of [gm,player])p.on('pageerror',e=>{errors.push(e.message);if(process.env.ARCHIVES_DEBUG)console.log(e.stack)});
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await openArchives(gm);
  const pictures=await gm.evaluate(()=>['#a54832','#3257a5'].map(color=>{const c=document.createElement('canvas');c.width=400;c.height=500;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,400,500);return c.toDataURL()}));
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'SECRET_ACTE_444',links:[],nodes:[{id:'secret',title:'SECRET_CELLULE_444',category:'personnage',revealed:false,bgImg:pictures[1],desc:'SECRET_DESCRIPTION_444',x:100,y:100,w:250,h:160,clues:[]}]}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.node-cell[data-id="secret"]').waitFor();await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('#world').waitFor();
  // Le Hide natif conserve le pion Owlbear, invisible pour les joueurs, sans doublon local.
  const image={id:'source-image-444',name:'SECRET_TOKEN_444',category:'personnage',data:pictures[0]};
  await transfer(gm,image,false);
  await until(async()=>(await shared(gm)).length===1,'token native Hide created');
  let hidden=(await shared(gm))[0],id=hidden.id;
  assert.equal(hidden.layer,'CHARACTER');assert.equal(hidden.visible,false);
  assert.equal((await local(gm)).length,0,'native Hide has no local duplicate');
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items.filter(item=>item.visible).length,0);
  await gm.reload();await openArchives(gm);
  await until(async()=>(await shared(gm)).length===1,'native Hide persists on reload');
  assert.equal((await shared(gm))[0].visible,false);
  await gm.evaluate(id=>window.fixture.deleteShared([id]),id);
  await until(async()=>!(await records(gm)).some(r=>r.id===id),'native hidden deletion persisted');
  await gm.reload();await openArchives(gm);
  assert.equal((await shared(gm)).length,0,'deleted token never resurrects');
  await transfer(gm,image,true);
  await until(async()=>(await shared(gm)).length===1,'Show placement works');
  id=(await shared(gm))[0].id;assert.equal((await shared(gm))[0].visible,true);
  await gm.evaluate(id=>window.fixture.deleteShared([id]),id);
  await until(async()=>!(await records(gm)).some(r=>r.id===id),'native revealed deletion persisted');
  await transfer(gm,image,false);
  await until(async()=>(await shared(gm)).length===1,'new native hidden token');
  id=(await shared(gm))[0].id;
  for(let i=0;i<2;i++){
    await transfer(gm,image,true);
    await until(async()=>(await shared(gm)).length===1&&(await shared(gm))[0].visible===true,'Show existing token');
    assert.equal((await shared(gm))[0].id,id,'stable ID in Show');
    await transfer(gm,image,false);
    await until(async()=>(await shared(gm)).length===1&&(await shared(gm))[0].visible===false,'Hide existing token');
    assert.equal((await shared(gm))[0].id,id,'stable ID in Hide');
  }
  // Losing GM role must not create a public ghost, or reveal a hidden item.
  await gm.evaluate(()=>window.fixture.changeRole('PLAYER'));
  await until(async()=>(await local(gm)).length===0,'role demotion');
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items.filter(item=>item.visible).length,0);
  await gm.evaluate(()=>window.fixture.changeRole('GM'));
  await until(async()=>(await shared(gm)).length===1,'native token retained');
  assert.equal((await shared(gm))[0].visible,false);
  await openArchives(gm); // Owlbear closes the editor on loss of GM role.
  // Image menu measures its real height; short screens scroll rather than clip.
  await app(gm).evaluate(()=>ArchivesCatalogue.libraryPanel('images'));await editor(gm).locator('#archives-image-library-files').setInputFiles([
   {name:'SECRET_FICHIER_PUBLIC_444.png',mimeType:'image/png',buffer:Buffer.from(pictures[0].split(',')[1],'base64')},{name:'SECRET_FICHIER_PRIVE_444.png',mimeType:'image/png',buffer:Buffer.from(pictures[1].split(',')[1],'base64')}
  ]);await until(async()=>await editor(gm).locator('#archives-image-library-grid article').count()===2,'two library images');
  const publicCard=editor(gm).locator('#archives-image-library-grid article').filter({has:editor(gm).getByText('SECRET_FICHIER_PUBLIC_444',{exact:true})});
  for(const size of [{width:1280,height:900},{width:700,height:400}]){
   await gm.setViewportSize(size);await publicCard.locator('img').dispatchEvent('contextmenu',{clientX:size.width-3,clientY:size.height-3});
   const menu=editor(gm).locator('#archives-image-library-actions-menu');await until(()=>menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=7&&r.top>=7&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7}),'whole library context menu visible');
   await menu.getByRole('button',{name:'Supprimer',exact:false}).scrollIntoViewIfNeeded();assert.equal(await menu.getByRole('button',{name:'Supprimer',exact:false}).isVisible(),true);await editor(gm).locator('#archives-image-library-search').click();
  }
  await gm.setViewportSize({width:1280,height:900});await publicCard.locator('img').click({button:'right'});await editor(gm).locator('#archives-image-library-actions-menu').getByRole('button',{name:'Montrer aux joueurs',exact:false}).click();
  const shown=surface(player);await waitMedia(player,pictures[0]);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes[0].revealed),false);await editor(gm).locator('#archives-image-library-status').filter({hasText:'Image présentée'}).waitFor();
  const late=await pc.newPage();late.on('pageerror',e=>errors.push(e.message));await late.goto(owl+'/room/one?joueur=Bob');await waitMedia(late,pictures[0]);
  await closeMedia(player);assert.equal(await shown.count(),0);
  await app(gm).evaluate(()=>DuneApp.commitCellPicture('secret',{bgZoom:1.1}));assert.equal(await shown.count(),0,'a regular campaign update must not reopen a dismissed image');
  await app(gm).evaluate(()=>ArchivesImageLibrary.showToPlayers([...document.querySelectorAll('#archives-image-library-grid article')].find(el=>el.querySelector('strong').textContent==='SECRET_FICHIER_PUBLIC_444').dataset.imageCard));await waitMedia(player,pictures[0]);
  await app(gm).evaluate(()=>ArchivesImageLibrary.hideFromPlayers());await shown.waitFor({state:'hidden'});await surface(late).waitFor({state:'detached'});
  // Ending a presentation while its image loads cancels the pending publication.
  await app(gm).evaluate(async()=>{const result=ArchivesPlayerImage.show({data:document.querySelector('#archives-image-library-grid img').src});ArchivesPlayerImage.hide();await result});assert.equal(await shown.count(),0);
  const wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));for(const secret of ['SECRET_ACTE_444','SECRET_CELLULE_444','SECRET_DESCRIPTION_444','SECRET_FICHIER_PRIVE_444',pictures[1]])assert.ok(!wire.includes(secret),'private data leak: '+secret.slice(0,40));
  assert.deepEqual(errors,[]);console.log('Stabilisation: Hide/Show natif, suppression définitive, stabilité des tokens, rôle MJ, menus et présentation ciblée.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
