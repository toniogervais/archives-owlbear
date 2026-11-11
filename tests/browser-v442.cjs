const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const pane=(p,id)=>editor(p).locator('#'+id+'[open]');
const until=async(fn,message)=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(message)};
const closePane=async(p,id)=>{await pane(p,id).locator('header>button').click();await pane(p,id).waitFor({state:'detached'})};
const library=async(p,command)=>app(p).evaluate(async command=>{const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest(command)},command);
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1540,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  for(const c of [gc,pc])await configure(c,fixtureHub,{sceneReady:true});
  const gm=await gc.newPage(),player=await pc.newPage(),errors=[];
  for(const p of [gm,player])p.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  const kinds=['personnage','groupe','lieu','objet','ressource','evenement'];
  const nodes=kinds.map((category,i)=>({id:'cell-'+i,title:'Fiche '+category,category,desc:'Description '+category,x:150+i*150,y:200,w:230,h:160,revealed:true,clues:[{id:'clue-'+i,text:'SECRET_'+i,revealed:false}]}));
  nodes.push({id:'private',title:'CELLULE_PRIVEE_442',category:'personnage',desc:'DESCRIPTION_PRIVEE_442',revealed:false,x:100,y:480,w:240,h:150,clues:[]});
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'',nodes,links:[]}]};
  await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.node-cell[data-id="cell-0"]').waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(player).locator('#archives-dossier-open').waitFor();
  await gm.bringToFront();
  // Wheel zoom keeps precisely the same world point under a real pointer, including the sidebar offset.
  await app(gm).evaluate(()=>{if(document.getElementById('sidebar').classList.contains('hidden-sidebar'))DuneApp.toggleSidebar()});
  const vp=await editor(gm).locator('#viewport').boundingBox(),point={x:Math.floor(vp.x+vp.width*.79),y:Math.floor(vp.y+vp.height*.78)};
  const world=()=>app(gm).evaluate(()=>{const s=DuneApp.getState(),r=document.getElementById('viewport').getBoundingClientRect();return {x:(Math.floor(r.left+r.width*.79)-r.left-s.panX)/s.zoom,y:(Math.floor(r.top+r.height*.78)-r.top-s.panY)/s.zoom,zoom:s.zoom}});
  const before=await world();await gm.mouse.move(point.x,point.y);await gm.mouse.wheel(0,-100);
  await app(gm).waitForFunction(z=>DuneApp.getState().zoom!==z,before.zoom);
  const after=await world();assert.ok(Math.abs(after.x-before.x)<.0001&&Math.abs(after.y-before.y)<.0001,'wheel must anchor at cursor');
  await gm.mouse.wheel(0,100);await app(gm).waitForFunction(z=>DuneApp.getState().zoom!==z,after.zoom);
  const back=await world();assert.ok(Math.abs(back.x-before.x)<.0001&&Math.abs(back.y-before.y)<.0001,'zoom out must anchor too');
  // Unnamed acts cannot wrap the trash button underneath the row.
  const toolbar=await app(gm).evaluate(()=>{const trash=document.getElementById('clear-act-button').getBoundingClientRect(),save=document.getElementById('canvas-save-icon').getBoundingClientRect(),tab=document.querySelector('#tabs-bar .tab-btn');return {trash:trash.y,save:save.y,label:tab.textContent}});
  assert.equal(toolbar.label,'Acte sans nom');assert.ok(Math.abs(toolbar.trash-toolbar.save)<2);
  // Four independent cards. A fifth cannot be added, and removing a card frees a slot.
  await app(gm).evaluate(()=>ArchivesCellBrief.open('cell-0'));
  const briefs=pane(gm,'archives-cell-brief');
  for(let i=1;i<4;i++){await briefs.locator('#archives-brief-picker').selectOption('cell-'+i);await briefs.locator('#archives-brief-add').click()}
  assert.equal(await briefs.locator('.brief-card').count(),4);assert.equal(await briefs.locator('#archives-brief-add').isDisabled(),true);
  const boxes=await briefs.locator('.brief-card').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
  assert.ok(boxes.every(b=>b.w>=280&&b.h>300));assert.ok(boxes.every(b=>Math.abs(b.y-boxes[0].y)<2));assert.ok(boxes[3].x>boxes[2].x);
  await briefs.locator('.brief-card[data-node-id="cell-1"] input[type=checkbox]').check();
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='cell-1').clues[0].revealed),true);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='cell-0').clues[0].revealed),false);
  await app(gm).evaluate(()=>ArchivesCellBrief.open('cell-4'));assert.equal(await briefs.locator('.brief-card').count(),4);
  await briefs.getByRole('button',{name:'Retirer la fiche Fiche objet',exact:true}).click();
  await briefs.locator('#archives-brief-picker').selectOption('cell-4');await briefs.locator('#archives-brief-add').click();
  await gm.screenshot({path:'/tmp/archives-v442-four-briefs.png'});
  await briefs.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();
  for(const size of [{width:1540,height:1000},{width:900,height:420}]){
    await gm.setViewportSize(size);
    await app(gm).evaluate(()=>{const r=document.getElementById('viewport').getBoundingClientRect();DuneApp.openCellContextMenu('cell-0',r.right-1,r.bottom-1)});
    await editor(gm).locator('#cell-ctx-menu.open').waitFor();
    await until(()=>app(gm).evaluate(()=>{const r=document.getElementById('cell-ctx-menu').getBoundingClientRect();return r.x>=7&&r.y>=7&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7}),'context menu entirely visible');
    await app(gm).evaluate(()=>DuneApp.closeContextMenus());
  }
  await gm.setViewportSize({width:1540,height:1000});
  await player.bringToFront();await editor(player).locator('#archives-dossier-open').click();
  const dossier=pane(player,'archives-player-dossier');
  assert.equal(await dossier.locator('select').count(),0);
  for(const kind of kinds){await dossier.locator('button[data-kind="'+kind+'"]').click();assert.equal(await dossier.locator('[data-dossier-id]').count(),1)}
  await dossier.locator('button[data-kind=""]').click();
  await dossier.getByRole('searchbox').fill('SECRET_1');assert.equal(await dossier.locator('[data-dossier-id]').count(),1);
  await dossier.getByRole('searchbox').fill('SECRET_0');assert.equal(await dossier.locator('[data-dossier-id]').count(),0);
  await dossier.getByRole('searchbox').fill('');
  assert.equal(await editor(player).locator('.archives-cell-brief-trigger').count(),0);
  // A private library file, even with a known ID, cannot be fetched through the public dossier RPC.
  const hidden=await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');return libraryRequest({action:'import',file:new File(['CONTENU_PRIVE_442'],'FICHIER_PRIVE_442.txt',{type:'text/plain'}),name:'FICHIER_PRIVE_442.txt',cellKey:'CELLULE_PRIVEE_442'})});
  const hiddenRead=await app(player).evaluate(async fileId=>{try{const {request}=await import('./src/v63/ui.mjs?v=4420');await request('dossier',{action:'get',fileId});return true}catch{return false}},hidden.entry.id);assert.equal(hiddenRead,false);
  // GM explicitly adds a document to Autre; the original private filename and linked cells never cross the wire.
  await gm.bringToFront();await editor(gm).locator('#archives-dossier-open').click();
  const gmDossier=pane(gm,'archives-player-dossier');await gmDossier.locator('[data-kind="autre"]').click();
  await gmDossier.getByRole('button',{name:'Ajouter un fichier dans Autre'}).click();
  const add=pane(gm,'archives-dossier-add');await add.locator('input[type=file]').setInputFiles({name:'ORIGINAL_MJ_442.txt',mimeType:'text/plain',buffer:Buffer.from('Document public avec <script>inactif</script>.')});
  await add.getByRole('textbox',{name:'Nom montré aux joueurs'}).fill('Rapport pour les joueurs');await add.getByRole('button',{name:'Partager dans Autre',exact:true}).click();
  await add.waitFor({state:'detached'});
  await player.bringToFront();await dossier.locator('[data-kind="autre"]').click();
  const report=dossier.locator('[data-dossier-id]').filter({hasText:'Rapport pour les joueurs'});await report.waitFor();await report.getByRole('button',{name:'Consulter',exact:true}).click();
  const detail=pane(player,'archives-dossier-detail');await detail.locator('pre').waitFor();assert.equal(await detail.locator('pre').textContent(),'Document public avec <script>inactif</script>.');assert.equal(await detail.locator('script').count(),0);
  await closePane(player,'archives-dossier-detail');
  // Audio stays in the dossier and is read on demand, without starting an extra modal or playback.
  const audio=await app(gm).evaluate(async()=>{
    const bytes=new Uint8Array(8044),v=new DataView(bytes.buffer),text=(o,s)=>[...s].forEach((c,i)=>bytes[o+i]=c.charCodeAt(0));
    text(0,'RIFF');v.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,bytes.length-44,true);
    for(let i=44;i<bytes.length;i+=2)v.setInt16(i,Math.sin(i/8)*6000,true);
    const {libraryRequest}=await import('./src/v60/request.mjs');const result=await libraryRequest({action:'import',file:new File([bytes],'SON_PRIVE_442.wav',{type:'audio/wav'}),name:'SON_PRIVE_442.wav',title:'Message audio public',cellKey:'CELLULE_PRIVEE_442'});await libraryRequest({action:'dossier-share',fileId:result.entry.id});return result;
  });
  const sound=dossier.locator('[data-dossier-id]').filter({hasText:'Message audio public'});await sound.waitFor();await sound.getByRole('button',{name:'Consulter',exact:true}).click();
  const audioDetail=pane(player,'archives-dossier-detail');await audioDetail.locator('audio').waitFor();
  const playback=await audioDetail.locator('audio').evaluate(async audio=>{await new Promise((resolve,reject)=>{if(audio.readyState>=2)return resolve();audio.onloadeddata=resolve;audio.onerror=reject});const paused=audio.paused;await audio.play();return {paused,playing:!audio.paused,muted:audio.muted,volume:audio.volume}});
  assert.ok(playback.paused&&playback.playing&&!playback.muted&&playback.volume>0);
  await closePane(player,'archives-dossier-detail');
  await library(gm,{action:'dossier-unshare',fileId:audio.entry.id});await sound.waitFor({state:'detached'});
  // A large public catalog is chunked below Owlbear's 16 KB message limit.
  await app(gm).evaluate(seedId=>new Promise((resolve,reject)=>{
    const open=indexedDB.open('archives-imaginaire-files',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{
      const db=open.result,tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),request=store.getAll();
      request.onsuccess=()=>{
        const seed=request.result.find(entry=>entry.id===seedId);
        for(let i=0;i<40;i++){const id=crypto.randomUUID();store.put({...seed,id,name:'CATALOG_PRIVATE_'+i+'.txt',title:'Catalogue '+i+' '+('文'.repeat(100)),dossier:{version:crypto.randomUUID()}},[...seed.scope,id])}
      };tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
    }
  }),hidden.entry.id);
  await until(async()=>await dossier.locator('[data-dossier-id]').count()===41,'large shared catalog received without message overflow');
  const wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['FICHIER_PRIVE_442','CONTENU_PRIVE_442','CELLULE_PRIVEE_442','DESCRIPTION_PRIVEE_442','ORIGINAL_MJ_442','SON_PRIVE_442','SECRET_0','CATALOG_PRIVATE'])assert.ok(!wire.includes(secret),'private data leaked: '+secret);
  assert.deepEqual(errors,[]);
  console.log('V4.42: cursor zoom, unnamed acts, four independent GM briefs, bounded menus, icon filters, safe on-demand documents/audio and withdrawal passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
