const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=page=>page.frameLocator('#viewer').frameLocator('#app');
const app=page=>page.frames().find(frame=>frame.url().includes('owl-editor=1'));
const dialog=page=>editor(page).locator('#archives-owl-transfer');
const crop=page=>dialog(page).locator('[data-crop]');
async function openToken(page){
 await app(page).evaluate(()=>{window.DuneApp.getState().selectedId='portrait';return window.ArchivesCellTransfer.sendSelected()});
 await dialog(page).locator('[data-submit]:not([disabled])').waitFor();
}
async function place(page,reveal=false){
 await dialog(page).getByRole('button',{name:reveal?'Placer et révéler':'Placer caché',exact:true}).click();
 await dialog(page).waitFor({state:'detached'});
}
const pixel=page=>crop(page).evaluate(canvas=>[...canvas.getContext('2d').getImageData(256,256,1,1).data]);
(async()=>{
 const options=process.env.ARCHIVES_CHROMIUM_OPTIONS;
 const browser=await chromium.launch({headless:true,...(options?JSON.parse(options):{})});
 let gm;
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),pc=await browser.newContext();
  await Promise.all([gc,pc].map(context=>configure(context,fixtureHub,{sceneReady:true})));
  gm=await gc.newPage();const player=await pc.newPage(),errors=[];
  gm.on('pageerror',error=>errors.push(error.message));player.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  const original=await gm.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#e02030';ctx.fillRect(0,0,500,600);ctx.fillStyle='#2040e0';ctx.fillRect(500,0,700,600);
   ctx.fillStyle='#ffe010';ctx.fillRect(1100,0,100,600);ctx.fillStyle='black';ctx.font='20px sans-serif';ctx.fillText('BORD_PRIVE_612',1100,40);
   return canvas.toDataURL();
  });
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Acte privé',links:[],nodes:[{id:'portrait',category:'personnage',title:'PORTRAIT_PRIVE_834',bgImg:original,desc:'SECRET_ORIGINAL_915',revealed:false,x:100,y:100,w:250,h:160}]}]};
  await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'PORTRAIT_PRIVE_834'}).waitFor();
  // An existing user's private artwork survives the schema upgrade.
  await app(gm).evaluate(()=>new Promise((resolve,reject)=>{
   const open=indexedDB.open('archives-imaginaire-private-artwork',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('artwork').createIndex('scope','scope');
   open.onerror=()=>reject(open.error);open.onsuccess=()=>{
    const db=open.result,tx=db.transaction('artwork','readwrite');
    tx.objectStore('artwork').put({legacy:'CONSERVE_298',scope:['fixture-single-room','fixture-MJ','old-scene']},['fixture-single-room','fixture-MJ','legacy']);
    tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error);
   };
  }));
  await openToken(gm);
  assert.equal(await dialog(gm).locator('[data-zoom]').inputValue(),'100');
  assert.equal(await dialog(gm).locator('input[type=checkbox]:visible').count(),0,'no visibility checkbox before transfer');
  assert.deepEqual(await pixel(gm),[32,64,224,255],'centered automatic suggestion');
  let box=await crop(gm).boundingBox();
  await gm.mouse.move(box.x+box.width/2,box.y+box.height/2);await gm.mouse.down();
  await gm.mouse.move(box.x+box.width*.8,box.y+box.height/2,{steps:8});await gm.mouse.up();
  await crop(gm).evaluate(()=>new Promise(requestAnimationFrame));
  assert.deepEqual(await pixel(gm),[224,32,48,255],'drag moves the image inside the fixed token');
  await dialog(gm).locator('[data-zoom]').fill('180');
  await dialog(gm).locator('[data-zoom]').dispatchEvent('input');
  await dialog(gm).locator('[data-zoom-value]').filter({hasText:'180 %'}).waitFor();
  await gm.mouse.move(box.x+box.width/2,box.y+box.height/2);await gm.mouse.wheel(0,-100);
  await dialog(gm).locator('[data-zoom-value]').filter({hasText:'220 %'}).waitFor();
  await gm.mouse.wheel(0,100);await dialog(gm).locator('[data-zoom-value]').filter({hasText:'180 %'}).waitFor();
  assert.deepEqual(await pixel(gm),[224,32,48,255]);
  const expected=await crop(gm).evaluate(async canvas=>{
   const blob=await(await fetch(canvas.toDataURL())).blob();
   return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
  });
  await dialog(gm).screenshot({path:'/tmp/archives-token-desktop-v61.png'});
  await place(gm);
  let uploaded=(await gm.evaluate(()=>window.fixture.uploads()))[0];
  assert.equal(uploaded.hash,expected,'only the exact preview raster is uploaded');
  assert.deepEqual(uploaded.pixels,[224,32,48,255]);assert.equal(uploaded.corner[3],0,'outside the circular token stays transparent');
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1});
  const imageUrl=uploaded.image.url;
  let wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['PORTRAIT_PRIVE_834','SECRET_ORIGINAL_915','BORD_PRIVE_612',imageUrl,original])assert.ok(!wire.includes(secret));
  // Reopening restores the crop; repeating the same pixels uses no asset picker.
  await openToken(gm);assert.equal(await dialog(gm).locator('[data-zoom]').inputValue(),'180');assert.deepEqual(await pixel(gm),[224,32,48,255]);
  await dialog(gm).locator('[data-title]').fill('Portrait montré');
  await place(gm,true);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1});
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].image.url,imageUrl);
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes[0].bgImg),original,'original remains intact');
  const old=await app(gm).evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('archives-imaginaire-private-artwork',2);open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('artwork');const get=tx.objectStore('artwork').get(['fixture-single-room','fixture-MJ','legacy']);get.onsuccess=()=>{resolve(get.result);db.close()};
  }}));assert.equal(old.legacy,'CONSERVE_298');
  // Private cache data is scoped per room/user and never copied into shared items.
  await app(gm).evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('archives-imaginaire-private-artwork',2);open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets'),get=store.getAllKeys();get.onsuccess=()=>{
    const key=get.result[0];const asset=store.get(key);asset.onsuccess=()=>store.put({...asset.result,privateMemo:'CACHE_PRIVE_543'},key);
   };tx.oncomplete=()=>{db.close();resolve()};
  }}));
  await gm.evaluate(()=>window.fixture.setScene());await gm.reload();await gm.locator('#archives-tool').click();
  await editor(gm).locator('.cell-title-txt').filter({hasText:'PORTRAIT_PRIVE_834'}).waitFor();
  await openToken(gm);assert.equal(await dialog(gm).locator('[data-zoom]').inputValue(),'180');
  await place(gm,true);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:0,download:0},'cache works after reload and on another scene');
  assert.deepEqual(Object.keys((await gm.evaluate(()=>window.fixture.scene())).items[0].image).sort(),['height','mime','url','width']);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].image.url,imageUrl);
  // A phone needs only the same zoom and drag controls, including a real touch gesture.
  await gm.setViewportSize({width:390,height:844});await openToken(gm);
  await crop(gm).scrollIntoViewIfNeeded();box=await crop(gm).boundingBox();
  assert.ok(box.width>=180&&box.width<=300);assert.ok(Math.abs(box.width-box.height)<1);
  const cdp=await gc.newCDPSession(gm),zoomBefore=Number(await dialog(gm).locator('[data-zoom]').inputValue());
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  const points=gap=>[{x:cx-gap,y:cy,radiusX:4,radiusY:4,id:1},{x:cx+gap,y:cy,radiusX:4,radiusY:4,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(25)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(40)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await crop(gm).evaluate(()=>new Promise(requestAnimationFrame));
  assert.ok(Number(await dialog(gm).locator('[data-zoom]').inputValue())>zoomBefore,'two-finger zoom works');
  await dialog(gm).screenshot({path:'/tmp/archives-token-mobile-v61.png'});
  await place(gm);
  assert.deepEqual(await gm.evaluate(()=>window.fixture.pickers()),{upload:1,download:1},'new framing imports a new raster');
  wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['SECRET_ORIGINAL_915','CACHE_PRIVE_543','CONSERVE_298',original])assert.ok(!wire.includes(secret),'private source and framing never shared');
  assert.equal(gc.pages().length,1);assert.equal(pc.pages().length,1);assert.deepEqual(errors,[]);
  console.log('Cadrage réel souris/molette/tactile, aperçu identique aux pixels transférés, migration conservée, cadrage et import mémorisés entre scènes et rechargements, aucune fuite de l’original.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-v61-failure.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
