const assert=require('node:assert/strict'),{chromium}=require('playwright'),{archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const roomChannel='fr.archives-imaginaire.bridge/room-v57',mediaId='fr.archives-imaginaire.bridge/media-view-v60';
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const picture=p=>editor(p).locator('#archives-player-image[open]');
const until=async(fn,label)=>{for(let i=0;i<180;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(label)};
const scenario={activeBoardId:'a',boards:[{id:'a',name:'SECRET_ACTE_450',nodes:[{id:'public',title:'Élément partagé',category:'lieu',desc:'Visible',revealed:true,x:100,y:100,w:260,h:180,clues:[]},{id:'hidden',title:'SECRET_CELLULE_450',desc:'SECRET_DESCRIPTION_450',category:'personnage',revealed:false,x:500,y:100,w:250,h:160,clues:[],gmDetails:[{title:'SECRET_RUBRIQUE_450',text:'SECRET_NOTES_450'}]}],links:[]}],journalPages:[{text:'SECRET_JOURNAL_450'}]};
async function graphics(page){return page.evaluate(()=>['#df4532','#325ce0','#38b77c'].map(color=>{const c=document.createElement('canvas');c.width=320;c.height=480;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,c.width,c.height);return c.toDataURL()}))}
async function waitImage(p,data){await picture(p).locator('img').waitFor();await app(p).waitForFunction(src=>{const v=document.getElementById('archives-player-image');return v?.open&&v.dataset.phase==='open'&&v.querySelector('img').src===src},data)}
async function show(main,data){await main.evaluate(data=>ArchivesPlayerImage.show({data}),data)}
async function closeImage(player){await picture(player).getByRole('button',{name:'Fermer l’image',exact:true}).click();await picture(player).waitFor({state:'hidden'})}
async function mainAndLargeView(browser){
 const fixture=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true}),lc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
 for(const c of [gc,pc,lc])await configure(c,fixture,{sceneReady:true});
 const main=await gc.newPage(),player=await pc.newPage(),late=await lc.newPage(),errors=[];for(const p of [main,player,late])p.on('pageerror',e=>errors.push(e.message));
 try{
  await main.goto(archives+'/archives.html?resume=1');await main.waitForFunction(()=>window.ArchivesOwlbearBridge&&window.ArchivesPlayerImage);await main.evaluate(s=>ArchivesRelay.apply(s),scenario);
  const pictures=await graphics(main);
  main.once('dialog',dialog=>dialog.accept(owl+'/room/one'));
  const [map]=await Promise.all([main.waitForEvent('popup'),main.getByRole('button',{name:'Owlbear — afficher la carte',exact:true}).click()]);map.on('pageerror',e=>errors.push(e.message));await map.waitForURL(owl+'/room/one');
  await player.goto(owl+'/room/one?joueur=Alix');await player.locator('#archives-tool').click();
  // No GM editor has been opened inside Owlbear. The main Archives are enough.
  await editor(player).locator('.cell-title-txt').filter({hasText:'Élément partagé'}).waitFor();assert.equal(await map.locator('#viewer').count(),0);
  assert.equal(await editor(player).locator('.archives-bridge-notice:not([hidden])').count(),0);
  await app(player).evaluate(()=>{window.presentationPhases=[];new MutationObserver(records=>{for(const r of records)if(r.target.id==='archives-player-image'&&r.attributeName==='data-phase')presentationPhases.push(r.target.dataset.phase)}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-phase']})});
  // Exercise the real image-library menu, then open-image context menu.
  await main.evaluate(()=>ArchivesCatalogue.libraryPanel('images'));await main.locator('#archives-image-library-files').setInputFiles(pictures.map((data,i)=>({name:'NOM_PRIVE_'+i+'_450.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')})));
  await until(()=>main.locator('#archives-image-library-grid article').count().then(n=>n===3),'library images');
  const first=main.locator('#archives-image-library-grid article').filter({has:main.getByText('NOM_PRIVE_0_450',{exact:true})});
  await first.locator('img').click({button:'right'});await main.locator('#archives-image-library-actions-menu').getByRole('button',{name:'Montrer aux joueurs',exact:false}).click();await waitImage(player,pictures[0]);
  await picture(player).getByRole('button',{name:'Fermer l’image',exact:true}).click();assert.equal(await picture(player).getAttribute('data-phase'),'closing');assert.equal(await picture(player).count(),1,'the modal stays open while its exit fades');await picture(player).waitFor({state:'hidden'});
  const second=main.locator('#archives-image-library-grid article').filter({has:main.getByText('NOM_PRIVE_1_450',{exact:true})});await second.locator('img').dblclick();await main.locator('#archives-image-full-preview img').waitFor();
  await main.locator('#archives-image-full-preview img').click({button:'right'});await main.locator('#archives-presentation-menu').getByRole('button',{name:'Montrer aux joueurs',exact:true}).click();await waitImage(player,pictures[1]);
  await main.getByRole('button',{name:'Fermer l’aperçu complet',exact:true}).click();await main.evaluate(()=>ArchivesCatalogue.close());
  await show(main,pictures[2]);await waitImage(player,pictures[2]);
  // A new image during the old exit fade must cancel the old close operation.
  await picture(player).getByRole('button',{name:'Fermer l’image',exact:true}).click();await show(main,pictures[0]);await waitImage(player,pictures[0]);assert.equal(await editor(player).locator('#archives-player-image').count(),1);
  await closeImage(player);await main.evaluate(()=>DuneApp.commitCellPicture('public',{bgZoom:1.1}));await app(player).waitForFunction(()=>DuneApp.getState().nodes.find(n=>n.id==='public')?.bgZoom===1.1);assert.equal(await picture(player).count(),0);
  await main.evaluate(async data=>Promise.all(data.map(value=>ArchivesPlayerImage.show({data:value}))),pictures);await waitImage(player,pictures[2]);await closeImage(player);
  const phases=await app(player).evaluate(()=>presentationPhases);for(const phase of ['opening','open','closing','closed'])assert.ok(phases.includes(phase),'missing fade phase '+phase);
  // A full player canvas over the existing 18 MiB transport cap used to block
  // every following image and leave a permanent waiting overlay after reopening.
  const png=Buffer.from(pictures[0].split(',')[1],'base64'),large='data:image/png;base64,'+Buffer.concat([png,Buffer.alloc(14*1024*1024)]).toString('base64');
  await main.evaluate(()=>ArchivesPlayerImage.hide());await app(player).waitForFunction(()=>DuneApp.getState().playerPresentation===null);
  await main.evaluate(data=>DuneApp.commitCellPicture('public',{bgImg:data}),large);
  await late.goto(owl+'/room/one?joueur=Noa');await late.locator('#archives-tool').click();await editor(late).locator('#world').waitFor();
  const waiting=editor(late).locator('.archives-bridge-notice:not([hidden])');await waiting.waitFor();assert.equal(await waiting.getAttribute('data-passive'),'true');
  await waiting.getByRole('button',{name:'Fermer le message de connexion',exact:true}).click();await waiting.waitFor({state:'hidden'});
  await show(main,pictures[1]);await waitImage(player,pictures[1]);await waitImage(late,pictures[1]);assert.equal(await editor(late).locator('.archives-bridge-notice:not([hidden])').count(),0);
  // Periodic snapshot failures may not cover an already displayed presentation.
  await app(late).evaluate(()=>parent.postMessage({protocol:'archives:owlbear:v56',type:'owl-player-retry'},location.origin));await waitImage(late,pictures[1]);
  await late.screenshot({path:'/tmp/archives-v450-player-image.png'});await closeImage(late);await show(main,pictures[0]);await waitImage(late,pictures[0]);
  // An authenticated PLAYER cannot forge the GM-only presentation channel.
  const unchanged=await app(late).evaluate(()=>DuneApp.getState().playerPresentation.id);
  const {snapshotChunks}=await import('../src/v57/room.mjs');const parts=await snapshotChunks({boards:[{id:'forged',nodes:[],links:[]}],playerPresentation:{id:crypto.randomUUID(),image:pictures[2],published:true}}),id=crypto.randomUUID(),revision=crypto.randomUUID();
  for(const part of parts)await player.evaluate(({channel,data})=>window.fixture.publish(channel,data),{channel:roomChannel,data:{...part,type:'presentation',id,revision}});
  await app(late).evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await app(late).evaluate(()=>DuneApp.getState().playerPresentation.id),unchanged);
  const wire=JSON.stringify(await player.evaluate(()=>fixture.wire()));for(const secret of ['SECRET_ACTE_450','SECRET_CELLULE_450','SECRET_DESCRIPTION_450','SECRET_RUBRIQUE_450','SECRET_NOTES_450','SECRET_JOURNAL_450','NOM_PRIVE_'])assert.ok(!wire.includes(secret),'private data leaked: '+secret);
  assert.deepEqual(errors,[]);console.log('V4.50 main: source Archives without a second GM editor, multiple/different images, rapid replacements, close races, entry/exit fades, large-canvas independent delivery, dismissible recovered waiting state and GM-only privacy passed.');
 }catch(error){await player.screenshot({path:'/tmp/archives-v450-main-failure.png'}).catch(()=>{});throw error}
 finally{await Promise.all([gc.close(),pc.close(),lc.close()])}
}
async function nativeFiles(browser){
 const fixture=hub(),gc=await browser.newContext(),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});for(const c of [gc,pc])await configure(c,fixture,{sceneReady:true});
 const gm=await gc.newPage(),player=await pc.newPage(),errors=[];for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
 try{
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await editor(gm).locator('.node-cell[data-id="public"]').waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('.node-cell[data-id="public"]').waitFor();
  const pictures=await graphics(gm),ids=await app(gm).evaluate(async data=>{const {libraryRequest}=await import('./src/v60/request.mjs');const ids=[];for(let i=0;i<data.length;i++){const file=new File([Uint8Array.from(atob(data[i].split(',')[1]),c=>c.charCodeAt(0))],'SECRET_FILE_'+i+'.png',{type:'image/png'});ids.push((await libraryRequest({action:'import',file,name:file.name})).entry.id)}return ids},pictures);
  const present=async index=>app(gm).evaluate(async id=>{const {libraryRequest}=await import('./src/v60/request.mjs');await libraryRequest({action:'present',fileId:id,title:'Image partagée'})},ids[index]);
  const viewer=()=>player.frameLocator('[id="'+mediaId+'"]'),frame=()=>player.frames().find(f=>f.url().includes('/media-view-v60.html'));
  async function color(expected){await viewer().locator('#media img').waitFor();await until(async()=>{try{return await frame().evaluate(async expected=>{const img=document.querySelector('#media img');if(!img)return false;await img.decode();const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(img,0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3).join(',')===expected},expected)}catch{return false}},'native presented color '+expected);await frame().waitForFunction(()=>document.body.dataset.phase==='open')}
  await present(0);await color('223,69,50');const firstFrame=frame();
  await present(1);await color('50,92,224');assert.equal(frame(),firstFrame,'a second image reuses the existing presentation surface');
  await present(2);await color('56,183,124');
  await viewer().getByRole('button',{name:'Fermer la présentation',exact:true}).click();await present(0);await color('223,69,50');
  await player.screenshot({path:'/tmp/archives-v450-file-image.png'});
  await viewer().getByRole('button',{name:'Fermer la présentation',exact:true}).click();assert.equal(await frame().evaluate(()=>document.body.dataset.phase),'closing');await player.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});
  await present(1);await color('50,92,224');await viewer().getByRole('button',{name:'Fermer la présentation',exact:true}).click();await player.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);console.log('V4.50 native: repeated image-file presentations, same-surface replacements, close/new-image race, visual fades, closing and re-presenting passed.');
 }catch(error){await player.screenshot({path:'/tmp/archives-v450-native-failure.png'}).catch(()=>{});throw error}
 finally{await Promise.all([gc.close(),pc.close()])}
}
(async()=>{const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await mainAndLargeView(browser);await nativeFiles(browser)}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
