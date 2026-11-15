const {surface,waitMedia,closeMedia}=require('./presented-image.cjs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const pane=(p,id)=>editor(p).locator('#'+id+'[open]');
const mediaId='fr.archives-imaginaire.bridge/media-view-v60';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX3cAAAAASUVORK5CYII=';
const until=async(fn,message)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(message)};
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let gm;
 try {
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1540,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  for(const c of [gc,pc])await configure(c,fixtureHub,{sceneReady:true});
  // Exercise the documented Google callbacks without a real engine/account or sending GM data to Google.
  await gc.route('https://cse.google.com/cse.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.google={search:{cse:{element:{render(){},getElement(){return {execute(query){const result={image:{url:'https://pictures.test/original.png'}};window.__gcse.searchCallbacks.image.ready('archives',query,[],[result]);const div=document.createElement('div');div.textContent='Résultat Google simulé';document.getElementById('results').replaceChildren(div);window.__gcse.searchCallbacks.image.rendered('archives',query,[],[div]);}}}}}}};window.__gcse.initializationCallback();`}));
  await gc.route('https://pictures.test/original.png',route=>route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(image.split(',')[1],'base64')}));
  gm=await gc.newPage();const player=await pc.newPage(),errors=[],popups=[];
  for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));gm.on('popup',p=>popups.push(p.url()));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const kinds=['personnage','groupe','lieu','objet','ressource','evenement'];
  const nodes=kinds.map((category,i)=>({id:'n'+i,title:'Cellule '+i,category,desc:'Description générale '+i,bgImg:image,revealed:true,x:80+i*340,y:140,w:250+i*60,h:160+i*35,clues:[{id:'clue'+i,text:'INDICE_PRIVE_449_'+i,revealed:false}]}));
  nodes.push({id:'child',title:'Enfant du groupe',category:'objet',parentId:'n1',revealed:false,x:12,y:20,w:250,h:160,clues:[]});
  const scenario={activeBoardId:'a',bgImage:image,boards:[{id:'a',name:'NOM_ACTE_SECRET_449',nodes,links:[{id:'l1',from:'n0',to:'n1',revealed:false,clues:[]},{id:'l2',from:'n0',to:'n2',revealed:true,clues:[]}]},{id:'b',name:'REVELATION_FINALE_449',nodes:[],links:[]}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await editor(gm).locator('.node-cell[data-id="n0"]').waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('.node-cell[data-id="n0"]').waitFor();
  assert.equal(await editor(player).locator('#tabs-bar').innerText(),'Scène 1');
  // Private named categories can be edited on every cell type and appear only in the brief.
  for(let i=0;i<kinds.length;i++){
   await app(gm).evaluate(id=>{DuneApp.getState().selectedId=id;DuneApp.openActiveEditor()},'n'+i);
   await editor(gm).locator('#archives-gm-details-trigger').click();const details=pane(gm,'archives-gm-details');
   await details.getByRole('button',{name:'Nouvelle catégorie',exact:false}).click();await details.getByLabel('Nom de la catégorie',{exact:true}).fill('DESCRIPTION_PRIVEE_449_'+i);await details.getByLabel('Informations de la catégorie',{exact:true}).fill('VOIX_ET_ATTITUDE_PRIVEE_449_'+i);
   await details.getByRole('button',{name:'Enregistrer',exact:true}).click();await app(gm).evaluate(()=>DuneApp.closeActiveEditor());
  }
  await app(gm).evaluate(()=>ArchivesCellBrief.open('n0'));const brief=pane(gm,'archives-cell-brief');
  assert.equal(await brief.locator('.brief-card-header').count(),0);assert.equal(await brief.locator('.brief-figure h2').textContent(),'Cellule 0');assert.equal(await brief.locator('.brief-gm-field h3').textContent(),'DESCRIPTION_PRIVEE_449_0');
  assert.ok((await brief.locator('.brief-figure').boundingBox()).height<=260);
  await brief.locator('.brief-picture').click({button:'right'});await editor(gm).locator('#archives-presentation-menu').getByRole('button',{name:'Montrer aux joueurs',exact:true}).click();
  await waitMedia(player,image);await closeMedia(player);
  for(let i=1;i<4;i++)await app(gm).evaluate(id=>ArchivesCellBrief.open(id),'n'+i);
  await gm.screenshot({path:'/tmp/archives-v449-fiches.png'});await brief.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();
  // Layout reserves expanded group sizes and keeps every top-level bounding rectangle separated.
  await app(gm).evaluate(async()=>{DuneApp.autoLayout();await Promise.all([...document.querySelectorAll('#nodes-layer .node-cell')].flatMap(cell=>cell.getAnimations()).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
  let previous='',steady=0;
  await until(async()=>{
   const rects=await editor(gm).locator('#nodes-layer>.node-cell').evaluateAll(cells=>cells.map(c=>{const r=c.getBoundingClientRect();return {id:c.dataset.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
   const current=JSON.stringify(rects);steady=current===previous?steady+1:0;previous=current;
   if(steady<3)return false;
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(!(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y))return false}return true;
  },'layout must settle with no overlapping rectangles: '+previous);
  const boxes=await editor(gm).locator('#nodes-layer>.node-cell').evaluateAll(cells=>cells.map(c=>{const r=c.getBoundingClientRect();return {id:c.dataset.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'layout overlap '+a.id+' '+b.id)}
  await editor(gm).locator('#archives-select-trigger').click();
  for(const id of ['n0','n1'])await editor(gm).locator('#nodes-layer .node-cell[data-id="'+id+'"]').click({position:{x:25,y:75}});
  assert.deepEqual((await app(gm).evaluate(()=>ArchivesSelection.selected)).sort(),['n0','n1']);
  await editor(gm).locator('#nodes-layer .node-cell[data-id="n0"]').click({button:'right'});await editor(gm).locator('#archives-selection-menu').getByRole('button',{name:'Copier vers un autre acte…',exact:true}).click();
  const copy=pane(gm,'archives-selection-copy');await copy.getByLabel('Acte de destination').selectOption('b');await copy.getByRole('button',{name:'Copier vers cet acte',exact:true}).click();
  const result=await app(gm).evaluate(()=>{const b=DuneApp.getState().boards.find(b=>b.id==='b');return {nodes:b.nodes,links:b.links}});assert.equal(result.nodes.length,3);assert.equal(result.links.length,1);assert.ok(result.nodes.every(n=>!n.revealed));assert.ok(result.nodes.find(n=>n.title==='Enfant du groupe').parentId);assert.ok(result.nodes.find(n=>n.title==='Cellule 0').gmDetails.length);
  await editor(gm).locator('#nodes-layer .node-cell[data-id="n0"]').click({button:'right'});await editor(gm).locator('#archives-selection-menu').getByRole('button',{name:'Dupliquer la sélection',exact:true}).click();
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.length),10);assert.equal((await app(gm).evaluate(()=>ArchivesSelection.selected)).length,3);
  await gm.screenshot({path:'/tmp/archives-v449-selection.png'});await editor(gm).locator('#archives-select-trigger').click();
  await editor(gm).locator('#archives-select-trigger').click();
  const a=await editor(gm).locator('#nodes-layer .node-cell[data-id="n0"]').boundingBox(),b=await editor(gm).locator('#nodes-layer .node-cell[data-id="n1"]').boundingBox();
  await gm.mouse.move(Math.min(a.x,b.x)-20,Math.min(a.y,b.y)-35);await gm.mouse.down();await gm.mouse.move(Math.max(a.x+a.width,b.x+b.width)+20,Math.max(a.y+a.height,b.y+b.height)+20,{steps:10});await gm.mouse.up();
  const rectangle=await app(gm).evaluate(()=>ArchivesSelection.selected);assert.ok(rectangle.includes('n0')&&rectangle.includes('n1'),'rectangle selection follows the zoomed canvas');await editor(gm).locator('#archives-select-trigger').click();
  await app(gm).evaluate(()=>{const r=document.querySelector('#nodes-layer .node-cell[data-id="n0"]').getBoundingClientRect();DuneApp.openCellContextMenu('n0',r.left+40,r.top+40)});
  await editor(gm).locator('#archives-context-present-image').click();await waitMedia(player,image);await closeMedia(player);

  // The same settings control clears the background persistently.
  await app(gm).evaluate(()=>DuneApp.openSettings());await editor(gm).getByRole('button',{name:'Supprimer l’image du canevas',exact:true}).click();assert.equal(await app(gm).evaluate(()=>DuneApp.getState().bgImage),'');await app(gm).evaluate(()=>DuneApp.closeSettings());
  // Google remains in the app: configure once, query, choose the original image, no popup.
  await app(gm).evaluate(()=>{DuneApp.getState().selectedId='n0';DuneApp.openImagePicker();DuneApp.runImageSearch()});
  await editor(gm).locator('#archives-google-cx').fill('test-engine-449');await editor(gm).locator('#archives-google-save').click();
  const google=editor(gm).frameLocator('#image-search-frame');await google.getByRole('button',{name:'Utiliser cette image',exact:true}).click();await editor(gm).locator('#image-picker-modal.open').waitFor({state:'hidden'});
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='n0').bgImg),image);assert.deepEqual(popups,[]);
  // Open a private original text document, then show it via context menu; markup stays inert.
  await app(gm).evaluate(async()=>{const {libraryRequest}=await import('./src/v60/request.mjs');await libraryRequest({action:'import',file:new File(['Document montré <script>inactif</script>'],'NOM_FICHIER_PRIVE_449.txt',{type:'text/plain'}),name:'NOM_FICHIER_PRIVE_449.txt'});await ArchivesFileLibrary.open()});
  const files=pane(gm,'archives-file-library');await files.locator('article').filter({hasText:'NOM_FICHIER_PRIVE_449'}).getByRole('button',{name:'Aperçu et transfert…',exact:true}).click();
  const transfer=pane(gm,'archives-owl-transfer');await transfer.locator('[data-preview]:not([hidden])').waitFor();await transfer.locator('[data-preview]').click({button:'right'});
  await editor(gm).locator('#archives-presentation-menu').getByRole('button',{name:'Montrer aux joueurs',exact:true}).click();
  const viewer=player.frameLocator('[id="'+mediaId+'"]');await viewer.locator('pre').waitFor();assert.equal(await viewer.locator('pre').textContent(),'Document montré <script>inactif</script>');await player.screenshot({path:'/tmp/archives-v449-presentation.png'});await viewer.getByRole('button',{name:'Fermer la présentation',exact:true}).click();
  const wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));for(const secret of ['NOM_ACTE_SECRET_449','REVELATION_FINALE_449','DESCRIPTION_PRIVEE_449','VOIX_ET_ATTITUDE_PRIVEE_449','NOM_FICHIER_PRIVE_449','INDICE_PRIVE_449'])assert.ok(!wire.includes(secret),'private data leak '+secret);
  assert.equal(await editor(player).locator('#archives-select-trigger').isVisible(),false);assert.equal(await editor(player).locator('#archives-gm-details-trigger').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('V4.49: all private categories, smaller titled portraits, multiple-selection copies/duplicates/groups/links, non-overlapping layout, act-name privacy, context presentations/close, background removal and sandboxed Google choice verified.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-v449-failure.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
