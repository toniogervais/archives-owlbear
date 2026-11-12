const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const pane=(p,id)=>editor(p).locator('#'+id+'[open]');
const card=(p,name)=>editor(p).locator('#archives-image-library-grid article').filter({has:editor(p).getByText(name,{exact:true})});
const images=p=>app(p).evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('ArchivesImaginaireImageLibrary',1);open.onsuccess=()=>{const db=open.result,r=db.transaction('images').objectStore('images').getAll();r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)};open.onerror=()=>reject(open.error)}));
const until=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(label)};
async function foreground(p){await p.bringToFront();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
async function createFolder(p,name){const transfer=pane(p,'archives-image-transfer-modal');await transfer.getByRole('button',{name:'Nouvelle sous-catégorie',exact:false}).click();await transfer.getByRole('textbox',{name:'Nom de la nouvelle sous-catégorie',exact:true}).fill(name);await transfer.getByRole('button',{name:'Créer la sous-catégorie',exact:true}).click()}
async function closeLibrary(p){await editor(p).locator('#archives-library-popout').getByRole('button',{name:'✕ Fermer',exact:true}).click();await editor(p).locator('#archives-library-popout').waitFor({state:'detached'})}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  const h=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  for(const c of [gc,pc])await configure(c,h,{sceneReady:true});
  const gm=await gc.newPage(),player=await pc.newPage(),errors=[];
  for(const p of [gm,player])p.on('pageerror',e=>{errors.push(e.message);if(process.env.ARCHIVES_DEBUG)console.log(e.stack)});
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Images',links:[],nodes:[
   {id:'npc',title:'CELLULE_MJ_443',category:'personnage',desc:'DESCRIPTION_MJ_443',revealed:false,x:100,y:100,w:260,h:180,bgFit:'cover',bgZoom:3.8,bgOffsetX:.4,bgOffsetY:-.7,clues:[{id:'c',text:'INDICE_MJ_443',revealed:false}]},
   {id:'place',title:'LIEU_MJ_443',category:'lieu',desc:'Le bâtiment',revealed:false,x:450,y:100,w:280,h:190,clues:[]}
  ]}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.node-cell[data-id="npc"]').waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('#world').waitFor();
  const pics=await gm.evaluate(()=>['#994c42','#44995c','#435c99','#b39132'].map((color,index)=>{const c=document.createElement('canvas');c.width=index===1?240:480;c.height=index===1?680:320;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,c.width,c.height);x.fillStyle='#eee';x.fillRect(0,0,c.width,40);x.fillRect(0,c.height-40,c.width,40);x.fillRect(80,70,100,90);return c.toDataURL()}));
  await app(gm).evaluate(()=>ArchivesCatalogue.libraryPanel('images'));
  const portraitNames=['Portrait_A_443','Portrait_B_443','Portrait_C_443'];
  await editor(gm).locator('#archives-image-library-files').setInputFiles(portraitNames.map((name,i)=>({name:name+'.png',mimeType:'image/png',buffer:Buffer.from(pics[i].split(',')[1],'base64')})));
  await until(async()=>await editor(gm).locator('#archives-image-library-grid article').count()===3,'three portraits imported');
  await editor(gm).locator('#archives-image-type-tabs [data-type="lieu"]').click();
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'Lieu_D_443.png',mimeType:'image/png',buffer:Buffer.from(pics[3].split(',')[1],'base64')});
  await card(gm,'Lieu_D_443').waitFor();await closeLibrary(gm);
  // A visible library button in active-cell settings assigns the existing cell, with its description and clues intact.
  await foreground(gm);await app(gm).evaluate(()=>{DuneApp.getState().selectedId='npc';DuneApp.openActiveEditor()});
  const settings=editor(gm).locator('#active-editor-modal.open');await settings.locator('#active-cell-image-library').click();
  const picker=pane(gm,'archives-cell-image-library');assert.equal(await picker.getByRole('combobox',{name:'Type d’image',exact:true}).inputValue(),'personnage');
  assert.equal(await picker.locator('article').count(),3);await picker.getByRole('searchbox').fill('Portrait_B');
  await picker.getByRole('button',{name:'Utiliser cette image',exact:true}).click();await picker.waitFor({state:'detached'});
  const assigned=await app(gm).evaluate(()=>JSON.parse(JSON.stringify(DuneApp.getState().nodes)));
  assert.equal(assigned.length,2);assert.equal(assigned[0].bgImg,pics[1]);assert.equal(assigned[0].title,'CELLULE_MJ_443');assert.equal(assigned[0].desc,'DESCRIPTION_MJ_443');assert.equal(assigned[0].revealed,false);assert.equal(assigned[0].clues[0].text,'INDICE_MJ_443');
  assert.deepEqual([assigned[0].bgFit,assigned[0].bgZoom,assigned[0].bgOffsetX,assigned[0].bgOffsetY],['contain',1,0,0],'a tall library portrait resets the previous crop and fits in full');
  assert.deepEqual([assigned[0].w,assigned[0].h],[260,180],'image fitting keeps the cell dimensions');
  assert.equal(await settings.locator('#active-editor-preview-stage .cell-bg-img-layer').evaluate(el=>el.style.backgroundImage.includes('data:image/png')),true);
  const picture=settings.locator('#active-editor-preview-stage .cell-bg-img-layer'),canvasPicture=editor(gm).locator('#world .node-cell[data-id="npc"] .cell-bg-img-layer');
  assert.equal(await picture.evaluate(el=>getComputedStyle(el).backgroundSize),'contain');assert.equal(await canvasPicture.evaluate(el=>getComputedStyle(el).backgroundSize),'contain');
  await settings.getByRole('button',{name:'Remplir la cellule',exact:true}).click();
  assert.equal(await picture.evaluate(el=>getComputedStyle(el).backgroundSize),'cover','filling is an explicit choice');
  const zoom=settings.locator('#archives-cell-image-zoom');await zoom.fill('240');await zoom.dispatchEvent('input');
  // Reset while the zoom gesture is still pending: its delayed flush cannot bring the old crop back.
  await settings.getByRole('button',{name:'Image entière',exact:true}).click();
  await until(async()=>await zoom.inputValue()==='100','whole portrait resets the zoom control');
  await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='npc').bgOffsetX=.8);
  await settings.getByRole('button',{name:'Image entière',exact:true}).click();
  await gm.waitForTimeout(250);
  assert.deepEqual(await app(gm).evaluate(()=>{const n=DuneApp.getState().nodes.find(n=>n.id==='npc');return [n.bgFit,n.bgZoom,n.bgOffsetX,n.bgOffsetY,n.bgImg]}),['contain',1,0,0,pics[1]]);
  assert.equal(await picture.evaluate(el=>getComputedStyle(el).backgroundSize),'contain');
  await settings.screenshot({path:'/tmp/archives-image-entire-v447.png'});
  await app(gm).evaluate(()=>DuneApp.closeActiveEditor());
  // The existing image picker also offers the library and remembers its target if selection changes while browsing.
  await app(gm).evaluate(()=>{DuneApp.getState().selectedId='place';DuneApp.openImagePicker()});await editor(gm).locator('#image-picker-library').click();
  assert.equal(await picker.getByRole('combobox',{name:'Type d’image',exact:true}).inputValue(),'lieu');assert.equal(await picker.locator('article').count(),1);
  await app(gm).evaluate(()=>{DuneApp.getState().selectedId='npc'});
  await picker.getByRole('button',{name:'Utiliser cette image',exact:true}).click();
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='place').bgImg),pics[3]);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='place').bgFit),'contain','landscape image keeps its full frame');
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='npc').bgImg),pics[1]);
  // Actual Ctrl + left clicks select two portraits; right-click moves the entire selection.
  await app(gm).evaluate(()=>ArchivesCatalogue.libraryPanel('images'));await editor(gm).locator('#archives-image-type-tabs [data-type="personnage"]').click();
  await card(gm,portraitNames[0]).locator('img').click();await card(gm,portraitNames[1]).locator('img').click({modifiers:['Control']});
  assert.equal(await editor(gm).locator('#archives-image-library-grid article[data-selected="true"]').count(),2);assert.equal(await editor(gm).locator('#archives-image-full-preview').count(),0);
  await card(gm,portraitNames[1]).locator('img').click({button:'right'});
  await editor(gm).locator('#archives-image-library-actions-menu').getByRole('button',{name:'Copier / déplacer les 2 images sélectionnées',exact:false}).click();
  await createFolder(gm,'Alliés');await pane(gm,'archives-image-transfer-modal').getByRole('button',{name:'Valider',exact:true}).click();await pane(gm,'archives-image-transfer-modal').waitFor({state:'detached'});

  await until(async()=>await editor(gm).locator('#archives-image-library-grid article').count()===2,'two portraits in Allies');
  let records=await images(gm);assert.equal(records.filter(x=>x.subcategory==='Alliés').length,2);assert.equal(records.find(x=>x.name===portraitNames[0]).data,pics[0]);assert.equal(records.find(x=>x.name===portraitNames[1]).fileName,portraitNames[1]+'.png');assert.equal(records.find(x=>x.name===portraitNames[2]).subcategory,'');
  // Checkboxes provide selection without a modifier and the same transfer works for one image.
  await editor(gm).locator('#archives-image-library-subcategory-tabs [data-subcategory=""]').click();await card(gm,portraitNames[2]).getByRole('checkbox').check();
  await editor(gm).locator('#archives-image-selection-transfer').click();await createFolder(gm,'Ennemis');await pane(gm,'archives-image-transfer-modal').getByRole('button',{name:'Valider',exact:true}).click();
  await until(async()=>(await images(gm)).find(x=>x.name===portraitNames[2]).subcategory==='Ennemis','single portrait moved');
  // Abort the second write: neither image can be partly moved.
  await editor(gm).locator('#archives-image-library-subcategory-tabs [data-subcategory="Alliés"]').click();
  for(const name of portraitNames.slice(0,2))await card(gm,name).getByRole('checkbox').check();
  await editor(gm).locator('#archives-image-selection-transfer').click();await createFolder(gm,'Échec');
  await app(gm).evaluate(()=>{window.__originalImagePut=IDBObjectStore.prototype.put;let count=0;IDBObjectStore.prototype.put=function(value,...args){const req=window.__originalImagePut.call(this,value,...args);if(this.name==='images'&&value.subcategory==='Échec'&&++count===2)this.transaction.abort();return req}});
  await pane(gm,'archives-image-transfer-modal').getByRole('button',{name:'Valider',exact:true}).click();await pane(gm,'archives-image-transfer-modal').getByRole('status').filter({hasText:'Aucune image n’a été déplacée'}).waitFor();
  records=await images(gm);assert.equal(records.filter(x=>x.subcategory==='Alliés').length,2);assert.equal(records.filter(x=>x.subcategory==='Échec').length,0);
  await app(gm).evaluate(()=>{IDBObjectStore.prototype.put=window.__originalImagePut});await pane(gm,'archives-image-transfer-modal').getByRole('button',{name:'Annuler',exact:true}).click();
  // Copying a batch retains originals and exact image data.
  await editor(gm).locator('#archives-image-selection-transfer').click();const transfer=pane(gm,'archives-image-transfer-modal');await transfer.getByRole('button',{name:'Lieux',exact:true}).click();await createFolder(gm,'Portraits de référence');await transfer.getByRole('button',{name:'Copier',exact:true}).click();await transfer.getByRole('button',{name:'Valider',exact:true}).click();await transfer.waitFor({state:'detached'});
  records=await images(gm);assert.equal(records.length,6);assert.equal(records.filter(x=>x.category==='personnage'&&x.subcategory==='Alliés').length,2);assert.deepEqual(records.filter(x=>x.category==='lieu'&&x.subcategory==='Portraits de référence').map(x=>x.data).sort(),pics.slice(0,2).sort());
  await gm.screenshot({path:'/tmp/archives-v443-library.png'});await closeLibrary(gm);
  // Filters in the cell picker include subcategories and can be changed to use another type.
  await app(gm).evaluate(()=>{DuneApp.getState().selectedId='npc';DuneApp.openActiveEditor()});await settings.locator('#active-cell-image-library').click();
  await picker.getByRole('combobox',{name:'Sous-catégorie d’image',exact:true}).selectOption('Ennemis');assert.equal(await picker.locator('article').count(),1);
  await picker.getByRole('combobox',{name:'Type d’image',exact:true}).selectOption('lieu');await picker.getByRole('combobox',{name:'Sous-catégorie d’image',exact:true}).selectOption('Portraits de référence');assert.equal(await picker.locator('article').count(),2);
  await picker.locator('header>button').click();await app(gm).evaluate(()=>DuneApp.closeActiveEditor());
  await gm.reload();await gm.locator('#archives-tool').click();await editor(gm).locator('#world').waitFor();await app(gm).evaluate(()=>ArchivesCatalogue.libraryPanel('images'));
  await editor(gm).locator('#archives-image-library-subcategory-tabs [data-subcategory="Alliés"]').click();assert.equal(await editor(gm).locator('#archives-image-library-grid article').count(),2);
  records=await images(gm);assert.equal(records.length,6);
  assert.deepEqual(await app(gm).evaluate(()=>{const n=DuneApp.getState().nodes.find(n=>n.id==='npc');return [n.bgFit,n.bgZoom,n.bgOffsetX,n.bgOffsetY]}),['contain',1,0,0],'the chosen full-image framing survives reload');
  await app(player).evaluate(()=>{ArchivesImageLibrary.pickForCell('npc');DuneApp.chooseLibraryCellImage()});assert.equal(await pane(player,'archives-cell-image-library').count(),0);
  const wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));for(const secret of [...portraitNames,'Lieu_D_443','CELLULE_MJ_443','DESCRIPTION_MJ_443','INDICE_MJ_443',...pics])assert.ok(!wire.includes(secret),'private image or cell leaked: '+secret.slice(0,40));
  assert.deepEqual(errors,[]);console.log('V4.43: active-cell library access, type/subcategory search, remembered target, Ctrl/click and checkbox batches, single move, atomic rollback, copies, persistence and player guards passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
