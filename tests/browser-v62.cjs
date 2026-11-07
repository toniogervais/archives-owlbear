const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=page=>page.frameLocator('#viewer').frameLocator('#app');
const app=page=>page.frames().find(frame=>frame.url().includes('owl-editor=1'));
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let page;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await configure(context,hub(),{sceneReady:true});page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(owl+'/room/one');await page.locator('#archives-tool').click();
  const image=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#26283d');sky.addColorStop(1,'#a47f56');ctx.fillStyle=sky;ctx.fillRect(0,0,900,600);ctx.fillStyle='#e8c28a';ctx.beginPath();ctx.arc(650,160,60,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1a1c28';ctx.beginPath();ctx.moveTo(0,450);ctx.lineTo(260,180);ctx.lineTo(530,480);ctx.lineTo(750,300);ctx.lineTo(900,470);ctx.lineTo(900,600);ctx.lineTo(0,600);ctx.fill();return canvas.toDataURL();
  });
  const scenario={activeBoardId:'one',boards:[{id:'one',name:'Arrivée au relais',links:[],nodes:[
   {id:'station',title:'Le vieux relais',category:'lieu',desc:'Une lumière ambrée éclaire la salle.',bgImg:image,revealed:true,x:120,y:130,w:320,h:210,clues:[{text:'Un voyageur a laissé un message.',revealed:true}]},
   {id:'letter',title:'Le message scellé',category:'objet',desc:'Une enveloppe attend près de la porte.',revealed:true,x:510,y:340,w:300,h:180,clues:[]}
  ]},{id:'two',name:'Les premières pistes',links:[],nodes:[]}],journalPages:[]};
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),editor(page).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(page).locator('.cell-title-txt').filter({hasText:'Le vieux relais'}).waitFor();
  await app(page).evaluate(()=>window.DuneApp.resetView());
  const controls=await app(page).evaluate(()=>Array.from(document.querySelectorAll('#top-hud .top-group:first-child>.clear-act-icon,#top-hud .studio-command')).filter(el=>getComputedStyle(el).display!=='none').map(el=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el);return {id:el.id,x:rect.x,y:rect.y,width:rect.width,height:rect.height,radius:style.borderRadius,label:el.getAttribute('aria-label')}}));
  assert.ok(controls.length>=6);for(const control of controls){assert.ok(control.width>=36&&control.height>=36,control.id);assert.ok(control.label,control.id);assert.ok(parseFloat(control.radius)>=9,control.id)}
  const save=controls.find(control=>control.id==='canvas-save-icon'),trash=controls.find(control=>control.id==='clear-act-button');assert.ok(trash.x>save.x,'destructive command stays apart from primary save');
  await editor(page).locator('#canvas-save-icon').hover();
  await editor(page).locator('.studio-tooltip[data-visible="true"]').waitFor();
  await page.mouse.move(1300,850);
  await page.screenshot({path:'/tmp/archives-studio-desktop-v62.png'});
  // Legacy windows transition in both directions without retaining interaction after closure.
  await editor(page).locator('#cell-catalog-icon').click();await editor(page).locator('#archives-catalogue-modal.open').waitFor();
  const legacy=await app(page).evaluate(async()=>{const el=document.getElementById('archives-catalogue-modal');await new Promise(requestAnimationFrame);return {opacity:getComputedStyle(el).opacity,duration:getComputedStyle(el).transitionDuration,display:getComputedStyle(el).display}});
  assert.ok(legacy.duration.split(',').some(value=>parseFloat(value)>0));assert.equal(legacy.display,'flex');
  await app(page).evaluate(()=>window.ArchivesCatalogue.close());
  const legacyClosed=await app(page).evaluate(()=>({pointer:getComputedStyle(document.getElementById('archives-catalogue-modal')).pointerEvents,open:document.getElementById('archives-catalogue-modal').classList.contains('open')}));
  assert.equal(legacyClosed.open,false);assert.equal(legacyClosed.pointer,'none');
  // The existing image library keeps its controls and has a real fullscreen-image exit fade.
  await editor(page).locator('#cell-catalog-icon').click();
  await editor(page).locator('#archives-catalogue-modal').getByRole('button',{name:'Bibliothèque d’images',exact:false}).click();
  await editor(page).locator('#archives-image-library-files').setInputFiles({name:'Paysage_demo.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
  await app(page).waitForFunction(()=>document.getElementById('archives-image-library-status')?.textContent.includes('ajoutée'));
  await editor(page).locator('#archives-image-library-grid img').first().dblclick();
  await editor(page).locator('#archives-image-full-preview img').waitFor();
  await editor(page).locator('#archives-image-full-preview').getByRole('button',{name:'Fermer l’aperçu complet',exact:true}).click();
  const imageExit=await app(page).evaluate(()=>{const el=document.getElementById('archives-image-full-preview');return {connected:!!el,inert:el?.inert,animations:el?.getAnimations().length}});
  assert.equal(imageExit.inert,true);assert.ok(imageExit.animations>0);
  await editor(page).locator('#archives-image-full-preview').waitFor({state:'detached'});
  await editor(page).locator('#archives-library-popout').getByRole('button',{name:'✕ Fermer',exact:true}).click();
  await editor(page).locator('#archives-library-popout').waitFor({state:'detached'});
  assert.equal(await editor(page).locator('#catalogue-images-panel').evaluate(el=>el.hidden),true,'library content returns to its original container');
  // Native previews have an actual exit fade; cleanup waits only for that short visual transition.
  await editor(page).locator('#archives-dossier-open').click();
  const dossier=editor(page).locator('#archives-player-dossier[open]');await dossier.getByRole('button',{name:'Consulter'}).first().click();
  await editor(page).locator('#archives-dossier-detail[open] img').waitFor();
  await editor(page).locator('#archives-dossier-detail[open]').screenshot({path:'/tmp/archives-studio-image-v62.png'});
  await editor(page).locator('#archives-dossier-detail[open] header button').click();
  await editor(page).locator('#archives-dossier-detail').waitFor({state:'detached'});
  const fade=await app(page).evaluate(async()=>{
   const el=document.getElementById('archives-player-dossier');el.close();await new Promise(requestAnimationFrame);
   return {connected:el.isConnected,open:el.open,inert:el.inert,animations:el.getAnimations().length};
  });
  assert.equal(fade.open,false);assert.equal(fade.inert,true);assert.equal(fade.connected,true);assert.ok(fade.animations>0,'exit opacity transition remains visible');
  await editor(page).locator('#archives-player-dossier').waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'reduce'});await editor(page).locator('#archives-dossier-open').click();
  assert.equal(await app(page).evaluate(()=>window.ArchivesAppearance.enabled()),false);
  assert.ok((await editor(page).locator('#archives-player-dossier').evaluate(el=>getComputedStyle(el).transitionDuration)).split(',').every(value=>parseFloat(value)===0));
  await editor(page).locator('#archives-player-dossier header button').click();await editor(page).locator('#archives-player-dossier').waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await app(page).evaluate(()=>{if(window.DuneApp.getState().fxEnabled)window.DuneApp.toggleFx()});
  assert.equal(await app(page).evaluate(()=>window.ArchivesAppearance.enabled()),false);
  await app(page).evaluate(()=>window.DuneApp.toggleFx());
  // Touch layout: the left toolbar fits, and the campaign preview remains usable.
  await page.setViewportSize({width:390,height:844});
  await app(page).evaluate(()=>{if(!document.getElementById('sidebar').classList.contains('hidden-sidebar'))window.DuneApp.toggleSidebar();window.DuneApp.resetView()});
  const rectangles=await app(page).evaluate(()=>Array.from(document.querySelectorAll('#top-hud button')).filter(el=>getComputedStyle(el).display!=='none'&&el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {id:el.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
  for(const rect of rectangles){assert.ok(rect.left>=0&&rect.right<=390,JSON.stringify(rect));assert.ok(rect.bottom<300,JSON.stringify(rect))}
  await page.screenshot({path:'/tmp/archives-studio-mobile-v62.png'});
  await editor(page).locator('#archives-dossier-open').click();await editor(page).locator('#archives-player-dossier[open]').screenshot({path:'/tmp/archives-studio-dossier-mobile-v62.png'});
  assert.deepEqual(errors,[]);assert.equal(context.pages().length,1);
  console.log('Finition des boutons et onglets, infobulles, fondus natifs et fenêtres existantes, sortie sans interaction, images, FX et mouvement réduit, interface tactile sans débordement.');
 }catch(error){if(page&&!page.isClosed())await page.screenshot({path:'/tmp/archives-v62-failure.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
