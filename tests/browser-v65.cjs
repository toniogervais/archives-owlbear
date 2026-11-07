const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const cell=(p,id)=>editor(p).locator('#world .node-cell[data-id="'+id+'"]');
const pane=(p,id)=>editor(p).locator('#'+id+'[open]');
const choice=p=>editor(p).locator('#archives-screen-choice');
const debug=s=>{if(process.env.ARCHIVES_DEBUG)console.log(s)};
// A foreground paint refreshes Chromium's OOPIF hit targets after switching
// between the simulated participants' tabs. No click is retried or forced.
async function foreground(page){
 await page.bringToFront();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function decide(p,policy){await foreground(p);await choice(p).locator('[data-screen-policy="'+policy+'"]').click();await choice(p).waitFor({state:'detached'})}
async function closePane(p,id){await foreground(p);await pane(p,id).locator('header button').click();await pane(p,id).waitFor({state:'detached'})}
async function touchDrag(p,locator,dx,dy,during){
 await foreground(p);const rect=await locator.boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,cdp=await p.context().newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:5,radiusY:5}]});
 if(during)await during();
 for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5,radiusX:5,radiusY:5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function localLayout(p){return app(p).evaluate(()=>structuredClone(window.DuneApp.getState().playerLayout.portrait))}
async function openEditor(p,id){await foreground(p);await app(p).evaluate(id=>{window.DuneApp.getState().selectedId=id;window.DuneApp.openActiveEditor()},id)}
async function journal(p){await foreground(p);await editor(p).getByRole('button',{name:'Journal des révélations',exact:true}).click();return editor(p).locator('#journal-modal')}
async function screenFor(gm,name,policy,target){
 await foreground(gm);
 const row=pane(gm,'archives-room-roster').locator('.studio-card').filter({has:editor(gm).getByRole('heading',{name,exact:true})});
 await row.getByRole('combobox',{name:'Écran pour '+name}).selectOption(target);
 await row.getByRole('button',{name:policy==='REQUIRED'?'Imposer la bascule':'Inviter',exact:true}).click();
}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});let gm,alix,bob;
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1440,height:1050},hasTouch:true}),ac=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true}),bc=await browser.newContext({viewport:{width:1024,height:1000},hasTouch:true});
  await Promise.all([gc,ac,bc].map(context=>configure(context,fixtureHub,{sceneReady:true,autoScreenChoice:false})));
  gm=await gc.newPage();alix=await ac.newPage();bob=await bc.newPage();const errors=[];
  for(const page of [gm,alix,bob])page.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await alix.goto(owl+'/room/one?joueur=Alix');await bob.goto(owl+'/room/one?joueur=Bob');
  const image=await gm.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=500;const x=c.getContext('2d');x.fillStyle='#b9394e';x.fillRect(0,0,400,500);x.fillStyle='#325daa';x.fillRect(400,0,400,500);return c.toDataURL()});
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'NOM_MJ_PRIVE_954',links:[],nodes:[
   {id:'portrait',title:'Personnage connu',category:'personnage',desc:'Description publique.',bgImg:image,revealed:true,x:100,y:190,w:300,h:180,clues:[{id:'c',text:'Indice révélé',revealed:true},{id:'s',text:'INDICE_PRIVE_624',revealed:false}]},
   {id:'report',title:'Rapport découvert',category:'objet',desc:'La porte est ouverte.',revealed:true,x:600,y:550,w:250,h:160,clues:[]},
   {id:'empty',title:'LIEU_PRIVE_759',category:'lieu',desc:'DESCRIPTION_PRIVEE_831',revealed:false,x:500,y:220,w:260,h:170,clues:[]}
  ]}],journalPages:[{id:'mj',title:'Carnet du MJ',text:'JOURNAL_PRIVE_MJ_486'}]};
  debug('explicit entry choice');await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await cell(gm,'portrait').waitFor();await decide(gm,'STAY');
  assert.equal(await alix.locator('#invite').count(),0);assert.equal(await bob.locator('#invite').count(),0);
  for(const p of [alix,bob]){await foreground(p);await p.locator('#archives-tool').click();await cell(p,'portrait').waitFor();}
  for(const p of [gm,alix,bob]){
   assert.equal(await p.frameLocator('#viewer').locator('#return').isVisible(),false);
   assert.equal(await editor(p).locator('#archives-home-fab').count(),0);
   assert.equal(await editor(p).getByRole('button',{name:'Owlbear — afficher la carte'}).count(),1);
  }
  debug('full player journal');const log=await journal(alix);
  assert.ok((await log.textContent()).includes('Indice révélé'));
  await app(gm).evaluate(()=>{window.DuneApp.getState().nodes.find(n=>n.id==='portrait').clues.push({id:'new-clue',text:'Nouvel indice pendant le journal',revealed:true});window.DuneApp.commitCellPicture('portrait',{bgZoom:1});});
  await log.getByText('Nouvel indice pendant le journal',{exact:true}).first().waitFor();
  await log.getByRole('button',{name:'📖 Récit continu',exact:true}).click();assert.ok((await log.locator('#journal-narrative-text').textContent()).includes('La porte est ouverte.'));
  assert.ok(!(await log.textContent()).includes('INDICE_PRIVE_624'));
  await log.getByRole('button',{name:'📝 Notes & #Tags',exact:true}).click();await log.locator('#inp-journal-text').fill('NOTE_JOURNAL_ALIX_852');
  await log.locator('[onclick="DuneApp.closeJournal()"]').click();
  debug('touch resize during MJ publication');const gmSize=await app(gm).evaluate(()=>({w:window.DuneApp.getState().nodes[0].w,h:window.DuneApp.getState().nodes[0].h}));
  await touchDrag(alix,cell(alix,'portrait').locator('.resize-handle'),100,75,async()=>{
   await app(gm).evaluate(()=>window.DuneApp.commitCellPicture('portrait',{bgZoom:1.15,bgOffsetX:0,bgOffsetY:0}));
   await app(alix).waitForFunction(()=>!!window.DuneApp.getState().pendingPlayerView);
  });
  const resized=await localLayout(alix);assert.ok(resized.w>gmSize.w+50);assert.ok(resized.h>gmSize.h+30);
  assert.deepEqual(await app(gm).evaluate(()=>({w:window.DuneApp.getState().nodes[0].w,h:window.DuneApp.getState().nodes[0].h})),gmSize);
  const rect=await cell(alix,'portrait').boundingBox();await alix.mouse.move(rect.x+45,rect.y+60);await alix.mouse.down();await alix.mouse.move(rect.x+115,rect.y+115,{steps:6});await alix.mouse.up();
  const own=await localLayout(alix),other=await localLayout(bob);assert.notEqual(own.x,100);
  await touchDrag(gm,cell(gm,'portrait').locator('.resize-handle'),130,90);
  await app(gm).evaluate(()=>{const node=window.DuneApp.getState().nodes.find(n=>n.id==='portrait');node.x+=220;node.y+=80;window.DuneApp.commitCellPicture(node.id,{bgZoom:1.2});});
  await app(alix).waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='portrait').x===320);
  assert.deepEqual(await localLayout(alix),own,'the player position and dimensions do not follow MJ edits');assert.deepEqual(await localLayout(bob),other,'an untouched player cell is also independent');
  await alix.reload();await alix.locator('#archives-tool').click();await cell(alix,'portrait').waitFor();assert.deepEqual(await localLayout(alix),own);
  const restored=await journal(alix);await restored.getByRole('button',{name:'📝 Notes & #Tags',exact:true}).click();assert.equal(await restored.locator('#inp-journal-text').inputValue(),'NOTE_JOURNAL_ALIX_852');await restored.locator('[onclick="DuneApp.closeJournal()"]').click();
  const bobJournal=await journal(bob);await bobJournal.getByRole('button',{name:'📝 Notes & #Tags',exact:true}).click();assert.equal(await bobJournal.locator('#inp-journal-text').inputValue(),'');await bobJournal.locator('[onclick="DuneApp.closeJournal()"]').click();
  debug('picture framing in the real cell preview');await openEditor(gm,'portrait');
  const zoom=editor(gm).locator('#archives-cell-image-zoom');await zoom.waitFor({state:'visible'});await zoom.fill('180');await zoom.dispatchEvent('input');
  await app(gm).waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='portrait').bgZoom===1.8);
  await touchDrag(gm,editor(gm).locator('#active-editor-preview-stage'),65,25);
  const framing=await app(gm).evaluate(()=>{const n=window.DuneApp.getState().nodes.find(n=>n.id==='portrait');return {zoom:n.bgZoom,x:n.bgOffsetX,y:n.bgOffsetY,image:n.bgImg}});
  assert.equal(framing.zoom,1.8);assert.ok(framing.x>.1&&framing.y>.05);assert.equal(framing.image,image);
  assert.ok((await cell(gm,'portrait').locator('.cell-bg-img-layer').getAttribute('style')).includes('scale(1.8)'));
  await editor(gm).locator('#active-editor-modal').screenshot({path:'/tmp/archives-cell-picture-v65.png'});
  await editor(gm).getByRole('button',{name:'Fermer les réglages',exact:true}).click();
  debug('empty preview source choices');await openEditor(gm,'empty');await editor(gm).locator('#active-editor-preview-stage').dblclick();
  const sources=()=>pane(gm,'archives-cell-image-source');
  for(const label of ['Rechercher sur Google','Choisir sur l’ordinateur','Bibliothèque des Archives'])assert.equal(await sources().getByRole('button',{name:label,exact:true}).isVisible(),true);
  await app(gm).evaluate(()=>{window.open=url=>{window.__googleQuery=url;return null;}});await sources().getByRole('button',{name:'Rechercher sur Google',exact:true}).click();
  assert.equal(new URL(await app(gm).evaluate(()=>window.__googleQuery)).hostname,'www.google.com');
  const [localChooser]=await Promise.all([gm.waitForEvent('filechooser'),sources().getByRole('button',{name:'Choisir sur l’ordinateur',exact:true}).click()]);
  await localChooser.setFiles({name:'nouvelle-image.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});await sources().waitFor({state:'detached'});
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='empty').bgImg),image);
  await app(gm).evaluate(()=>window.DuneApp.clearCellBg());
  await editor(gm).locator('#archives-image-library-files').setInputFiles({name:'Image-bibliotheque.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
  await app(gm).waitForFunction(()=>document.getElementById('archives-image-library-status')?.textContent.includes('ajoutée'));
  await editor(gm).locator('#active-editor-preview-stage').dblclick();await sources().getByRole('button',{name:'Bibliothèque des Archives',exact:true}).click();
  await pane(gm,'archives-cell-image-library').getByRole('button',{name:'Utiliser cette image',exact:true}).click();await pane(gm,'archives-cell-image-library').waitFor({state:'detached'});
  assert.equal(await app(gm).evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='empty').bgImg),image);
  await editor(gm).getByRole('button',{name:'Fermer les réglages',exact:true}).click();
  debug('storage estimate in settings');await app(gm).evaluate(()=>Object.defineProperty(navigator,'storage',{configurable:true,value:{estimate:async()=>({usage:8e6,quota:64e6})}}));
  await editor(gm).locator('#settings-fab').click();await editor(gm).locator('[data-storage-available]').filter({hasText:'56 Mo disponibles'}).waitFor();
  await app(gm).evaluate(()=>navigator.storage.estimate=async()=>{throw Error('Capacité masquée par le navigateur.');});
  await editor(gm).locator('#archives-storage-meter').getByRole('button',{name:'Actualiser',exact:true}).click();await editor(gm).locator('[data-storage-available]').filter({hasText:'Capacité indisponible'}).waitFor();await app(gm).evaluate(()=>window.DuneApp.closeSettings());
  debug('individual optional and required invitations');await editor(gm).locator('#archives-roster-open').click();
  for(let attempt=0;attempt<4;attempt++){
  await screenFor(gm,'Alix','OPTIONAL','OWLBEAR');
  await foreground(alix);await alix.frameLocator('#invite').getByRole('button',{name:'Rester sur cet écran',exact:true}).click();await alix.locator('#invite').waitFor({state:'detached',timeout:5000}).catch(async error=>{
   console.error('Invitation debug',await alix.evaluate(()=>({modals:window.fixture.modals().slice(-8)})));
   console.error('Invitation DOM',await alix.frameLocator('#invite').locator('body').evaluate(()=>({acceptDisabled:document.getElementById('accept').disabled,dismissDisabled:document.getElementById('dismiss').disabled,handler:typeof document.getElementById('dismiss').onclick,instruction:document.getElementById('instruction').textContent})));
   throw error;
  });assert.equal(await bob.locator('#invite').count(),0);assert.equal(await alix.locator('#viewer').count(),1);
  }
  await screenFor(gm,'Alix','REQUIRED','OWLBEAR');await foreground(alix);const forced=alix.frameLocator('#invite');await forced.getByRole('button',{name:'Afficher la carte Owlbear',exact:true}).waitFor();
  assert.equal(await forced.locator('#dismiss').isVisible(),false);await forced.locator('#accept').press('Escape');await forced.locator('#veil').click({position:{x:5,y:5}});assert.equal(await alix.locator('#invite').count(),1);
  await forced.getByRole('button',{name:'Afficher la carte Owlbear',exact:true}).click();await alix.locator('#viewer').waitFor({state:'detached'});await alix.locator('#invite').waitFor({state:'detached'});assert.equal(await bob.locator('#viewer').count(),1);
  // A player can neither broadcast an authoritative invitation nor use the MJ RPC.
  await alix.evaluate(()=>window.fixture.publish('fr.archives-imaginaire.bridge/room-v57',{type:'screen',id:crypto.randomUUID(),target:'OWLBEAR',required:true,to:'fixture-Bob'}));
  await app(bob).evaluate(()=>parent.postMessage({protocol:'archives:owlbear:v56',type:'owl-screen-command',id:crypto.randomUUID(),command:{target:'OWLBEAR',policy:'REQUIRED'}},location.origin));assert.equal(await bob.locator('#invite').count(),0);
  await closePane(gm,'archives-room-roster');
  debug('remembered movable choice and independent screen changes');await editor(gm).getByRole('button',{name:'Owlbear — afficher la carte'}).click();await choice(gm).waitFor();
  const start=await choice(gm).locator('header').boundingBox();await gm.mouse.move(start.x+25,start.y+10);await gm.mouse.down();await gm.mouse.move(start.x-185,start.y+110,{steps:8});await gm.mouse.up();
  const remembered=await choice(gm).boundingBox();await decide(gm,'STAY');await gm.locator('#viewer').waitFor({state:'detached'});assert.equal(await bob.locator('#invite').count(),0);assert.equal(await bob.locator('#viewer').count(),1);
  await gm.locator('#archives-tool').click();await choice(gm).waitFor();const again=await choice(gm).boundingBox();assert.ok(Math.abs(remembered.x-again.x)<2&&Math.abs(remembered.y-again.y)<2,'the MJ window returns to its saved position');
  assert.equal(await alix.locator('#invite').count(),0,'opening the Archives first asks the MJ and does not invite automatically');
  await decide(gm,'OPTIONAL');await foreground(alix);await alix.frameLocator('#invite').getByRole('button',{name:'Rester sur cet écran',exact:true}).click();await alix.locator('#invite').waitFor({state:'detached'});
  await editor(gm).getByRole('button',{name:'Owlbear — afficher la carte'}).click();await decide(gm,'REQUIRED');await gm.locator('#viewer').waitFor({state:'detached'});
  await foreground(bob);await bob.frameLocator('#invite').getByRole('button',{name:'Afficher la carte Owlbear',exact:true}).click();await bob.locator('#viewer').waitFor({state:'detached'});
  const wire=JSON.stringify(await gm.evaluate(()=>window.fixture.wire()));for(const secret of ['NOTE_JOURNAL_ALIX_852','NOM_MJ_PRIVE_954','JOURNAL_PRIVE_MJ_486','INDICE_PRIVE_624','LIEU_PRIVE_759','DESCRIPTION_PRIVEE_831'])assert.ok(!wire.includes(secret),'private field never sent: '+secret);
  assert.deepEqual(errors,[]);console.log('V65: journal complet, redimensionnement tactile réel, dispositions personnelles persistantes, cadrage direct, trois sources d’image, stockage estimé, retour unique, invitations ciblées/refusables/obligatoires et fenêtre mémorisée validés.');
 }catch(error){for(const [name,page]of[['gm',gm],['alix',alix],['bob',bob]])if(page)await page.screenshot({path:'/tmp/archives-'+name+'-failure-v65.png'}).catch(()=>{});throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
