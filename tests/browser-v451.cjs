const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const {mediaId,media,surface,frame,waitMedia,closeMedia}=require('./presented-image.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const until=async(fn,label)=>{for(let i=0;i<180;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(label)};
const graphics=p=>p.evaluate(()=>['#df4532','#325ce0','#38b77c'].map(color=>{const c=document.createElement('canvas');c.width=300;c.height=450;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,c.width,c.height);return c.toDataURL()}));
const scenario=data=>({activeBoardId:'a',boards:[{id:'a',name:'ACTE_SECRET_451',links:[],nodes:data.map((image,i)=>({id:'hidden'+i,title:'NOM_SECRET_451_'+i,category:['personnage','lieu','objet'][i],desc:'DESCRIPTION_SECRETE_451',revealed:false,[['bgImg','image','imageData'][i]]:image,x:100+i*300,y:120,w:250,h:170,clues:[{id:'clue'+i,text:'INDICE_SECRET_451',revealed:false}],gmDetails:[{title:'RUBRIQUE_SECRETE_451',text:'NOTE_SECRETE_451'}]}))},{id:'b',name:'ACTE_INACTIF_SECRET_451',links:[],nodes:[{id:'other',title:'AUTRE_SECRET_451',category:'evenement',desc:'DESCRIPTION_SECRETE_451',bgImg:data[0],revealed:false,x:100,y:100,w:250,h:170,clues:[]}]}]});
async function assertHidden(gm,player,source){
 const privateState=await source.evaluate(()=>DuneApp.getState().boards.map(b=>b.nodes.map(n=>({id:n.id,revealed:n.revealed,clues:n.clues}))));
 assert.ok(privateState.flat().every(n=>n.revealed===false&&n.clues.every(c=>c.revealed===false)));
 if(app(player))assert.equal(await app(player).evaluate(()=>DuneApp.getState().boards.reduce((s,b)=>s+b.nodes.length,0)),0,'no hidden cell is revealed by showing its portrait');
 const wire=JSON.stringify(await player.evaluate(()=>fixture.wire()));
 for(const secret of ['ACTE_SECRET_451','ACTE_INACTIF_SECRET_451','NOM_SECRET_451','AUTRE_SECRET_451','DESCRIPTION_SECRETE_451','INDICE_SECRET_451','RUBRIQUE_SECRETE_451','NOTE_SECRETE_451'])assert.ok(!wire.includes(secret),'leaked '+secret);
}
async function native(browser){
 const fixture=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
 for(const c of [gc,pc])await configure(c,fixture,{sceneReady:true});
 const gm=await gc.newPage(),player=await pc.newPage(),errors=[];for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
 try{
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const data=await graphics(gm),s=scenario(data),[chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await editor(gm).locator('.node-cell[data-id="hidden0"]').waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('#world').waitFor();
  await app(player).waitForFunction(()=>DuneApp.getState().boards.some(b=>b.id==='a'));
  // Context menu on an UNREVEALED cell, with no public cells at all.
  await app(gm).evaluate(()=>DuneApp.openCellContextMenu('hidden0',300,200));await editor(gm).locator('#archives-context-present-image').click();await waitMedia(player,data[0]);await assertHidden(gm,player,app(gm));
  assert.equal(await editor(player).locator('#archives-player-image[open]').count(),0,'a native image has only one presentation surface');
  await closeMedia(player);
  // Every legacy image field works. The brief button does not reveal the cell.
  await app(gm).evaluate(()=>ArchivesCellBrief.open('hidden1'));const brief=editor(gm).locator('#archives-cell-brief[open]');
  await brief.getByRole('button',{name:'Montrer l’image aux joueurs',exact:false}).click();await waitMedia(player,data[1]);const firstFrame=frame(player);
  await brief.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();await app(gm).evaluate(()=>ArchivesCellBrief.open('hidden2'));
  await brief.locator('.brief-picture').click({button:'right'});await editor(gm).locator('#archives-presentation-menu').getByRole('button',{name:'Montrer aux joueurs',exact:true}).click();await waitMedia(player,data[2]);assert.equal(frame(player),firstFrame);
  await brief.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();
  await app(gm).evaluate(()=>DuneApp.openCellContextMenu('hidden1',300,200));await editor(gm).locator('#archives-context-present-image').click();await waitMedia(player,data[1]);
  // Closed Archives canvas: the media still appears while the player is on the map.
  await closeMedia(player);await player.evaluate(()=>document.querySelector('#viewer')?.remove());
  await app(gm).evaluate(()=>ArchivesPresentation.presentCell('other'));await waitMedia(player,data[0]);assert.equal(await player.locator('#viewer').count(),0);
  await closeMedia(player);await assertHidden(gm,player,app(gm));
  // Showing a portrait performs no scenario save and creates no library copy.
  const counts=await gm.frames().find(f=>f.url().includes('/background-v55.html')).evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('archives-imaginaire-files',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('entries').objectStore('entries').count();q.onsuccess=()=>{db.close();resolve(q.result)}}}));assert.equal(counts,0);
  await gm.screenshot({path:'/tmp/archives-v451-hidden-portraits.png'});assert.deepEqual(errors,[]);
  console.log('V4.51 native: repeated hidden-cell images from context menus, all legacy fields, GM brief button and preview; inactive acts; map-only player; one viewer; private names, notes and clues stay hidden; no library duplication.');
 }catch(error){await player.screenshot({path:'/tmp/archives-v451-native-failure.png'}).catch(()=>{});throw error}
 finally{await gc.close();await pc.close()}
}
async function main(browser){
 const fixture=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});for(const c of [gc,pc])await configure(c,fixture,{sceneReady:true});
 const gm=await gc.newPage(),player=await pc.newPage(),errors=[];let map;for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
 try{
  await gm.goto(archives+'/archives.html?resume=1&v=old');await gm.waitForFunction(()=>window.ArchivesPresentation&&window.ArchivesPresentationBridge);assert.equal(new URL(gm.url()).searchParams.get('v'),'4510');
  const data=await graphics(gm);await gm.evaluate(s=>ArchivesRelay.apply(s),scenario(data));
  gm.once('dialog',d=>d.accept(owl+'/room/one'));[map]=await Promise.all([gm.waitForEvent('popup'),gm.getByRole('button',{name:'Owlbear — afficher la carte',exact:true}).click()]);await map.waitForURL(owl+'/room/one');
  await gm.waitForFunction(()=>ArchivesPresentationBridge.connected);await player.goto(owl+'/room/one?joueur=Noa');await player.locator('#archives-tool').click();await editor(player).locator('#world').waitFor();
  await app(player).waitForFunction(()=>DuneApp.getState().boards.some(b=>b.id==='a'));
  for(let i=0;i<3;i++){
   await gm.evaluate(id=>DuneApp.openCellContextMenu(id,300,200),'hidden'+i);await gm.locator('#archives-context-present-image').click();await waitMedia(player,data[i]);await closeMedia(player);
  }
  // Real library selection must keep following the newly chosen image.
  await gm.evaluate(()=>ArchivesCatalogue.libraryPanel('images'));await gm.locator('#archives-image-library-files').setInputFiles(data.map((d,i)=>({name:'FICHIER_PRIVE_451_'+i+'.png',mimeType:'image/png',buffer:Buffer.from(d.split(',')[1],'base64')})));
  await until(()=>gm.locator('#archives-image-library-grid article').count().then(n=>n===3),'three library images');
  for(let i=2;i>=0;i--){const card=gm.locator('#archives-image-library-grid article').filter({has:gm.getByText('FICHIER_PRIVE_451_'+i,{exact:true})});await card.locator('img').click({button:'right'});await gm.locator('#archives-image-library-actions-menu').getByRole('button',{name:'Montrer aux joueurs',exact:false}).click();await waitMedia(player,data[i])}
  await player.screenshot({path:'/tmp/archives-v451-player-presentation.png'});await closeMedia(player);await gm.evaluate(()=>ArchivesCatalogue.close());
  await gm.evaluate(()=>ArchivesPresentation.presentCell('hidden1'));await waitMedia(player,data[1]);await gm.evaluate(()=>ArchivesPlayerImage.hide());await surface(player).waitFor({state:'detached'});
  await assertHidden(gm,player,gm);assert.deepEqual(errors,[]);
  console.log('V4.51 main Archives: launcher version consistent; hidden cells; three different portraits and three real library choices in sequence, close/reopen/stop, independent media transport without opening a GM editor in Owlbear.');
 }catch(error){await player.screenshot({path:'/tmp/archives-v451-main-failure.png'}).catch(()=>{});throw error}
 finally{await gc.close();await pc.close()}
}
async function standalone(browser){
 const c=await browser.newContext({viewport:{width:1100,height:800}});await configure(c,hub());const gm=await c.newPage(),player=await c.newPage();
 try{
  await gm.goto(archives+'/archives.html?resume=1');await gm.waitForFunction(()=>window.ArchivesPlayerImage);
  const data=await graphics(gm);await gm.evaluate(s=>ArchivesRelay.apply(s),scenario(data));
  await player.goto(archives+'/archives-app-v64-v55.html?ro=1&v=4510');await player.waitForFunction(()=>window.ArchivesPlayerImage);
  // The public canvas can be unavailable; image packets contain no boards.
  await gm.evaluate(()=>{window.pictureMessages=[];const c=new BroadcastChannel('jdr_architect_sync_v12');c.onmessage=e=>pictureMessages.push(e.data);window.pictureProbe=c});
  for(let i=0;i<3;i++){
   await gm.evaluate(id=>ArchivesPresentation.presentCell(id),'hidden'+i);
   await player.locator('#archives-player-image[open] img').waitFor();await player.waitForFunction(src=>document.querySelector('#archives-player-image')?.dataset.phase==='open'&&document.querySelector('#archives-player-image img')?.src===src,data[i]);
   await player.getByRole('button',{name:'Fermer l’image',exact:true}).click();await player.locator('#archives-player-image[open]').waitFor({state:'hidden'});
  }
  const packets=await gm.evaluate(()=>pictureMessages.filter(p=>p.type==='archives:player-image:v1'));assert.equal(packets.length,3);assert.ok(packets.every(p=>!p.boards&&p.playerPresentation.image));
  assert.ok((await gm.evaluate(()=>DuneApp.getState().nodes)).every(n=>!n.revealed));console.log('V4.51 standalone: three hidden portraits delivered as independent image packets without a canvas snapshot.');
 }finally{await c.close()}
}
(async()=>{const b=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await native(b);await main(b);await standalone(b)}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
