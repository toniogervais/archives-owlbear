const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,configure,hub}=require('./owlbear-fixture.cjs');
const packet={activeBoardId:'a',boards:[{id:'a',name:'Scène 1',nodes:[
 {id:'a',title:'Le témoin',category:'personnage',desc:'Une description publique',revealed:true,x:40,y:220,w:250,h:170,clues:[]},
 {id:'b',title:'Le quai',category:'lieu',revealed:true,x:650,y:400,w:250,h:170,clues:[]}
],links:[]}]};

async function run(browser,mode){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await configure(context,hub(),{sceneReady:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(archives+'/archives-app-v64-v55.html'+(mode==='direct'?'?ro=1':''));
  if(mode==='preview'){
   await page.locator('#archives-role-gm').click();await page.getByRole('button',{name:'REPRENDRE LA PARTIE EN COURS'}).click();
   await page.evaluate(data=>ArchivesRelay.apply(data),packet);await page.locator('#quick-mode-switch').click();
  }else await page.evaluate(data=>ArchivesRelay.apply(data),packet);
  await page.locator('#archives-player-toolbar-bar').waitFor();
  assert.equal(await page.locator('.archives-player-dock').count(),1,'one player toolbar');
  assert.deepEqual(await page.locator('#archives-player-toolbar-bar .player-command').evaluateAll(controls=>controls.filter(control=>{
   const r=control.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   return document.elementFromPoint(x,y)?.closest('button')!==control;
  }).map(control=>control.id)),[],'every command receives the mouse, including the relocated home button');
  const original=await page.evaluate(()=>DuneApp.getState().nodes.map(({id,x,y})=>({id,x,y})));

  // A normal desktop click can span a live snapshot. The original bars used to
  // reinsert every button on each public update, cancelling that native click.
  for(const [id,visible]of [['archives-dossier-open','#archives-player-dossier[open]'],['quick-player-notes','#archives-player-notebook[open]'],['quick-player-journal','#journal-modal.open']]){
   const control=page.locator('#'+id),box=await control.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.evaluate(()=>{
    window.__toolbarChanges=0;window.__toolbarObserver=new MutationObserver(records=>window.__toolbarChanges+=records.filter(r=>r.type==='childList').length);
    window.__toolbarObserver.observe(document.querySelector('#archives-player-toolbar-bar .player-bar-actions'),{childList:true});
    window.dispatchEvent(new Event('archives:public-view'));
   });
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.evaluate(()=>{window.__toolbarObserver.disconnect();return window.__toolbarChanges}),0,'synchronization leaves the command nodes in place');
   await page.mouse.up();await page.locator(visible).waitFor();
   if(id==='quick-player-journal')await page.evaluate(()=>DuneApp.closeJournal());else await page.locator(visible+' header button').click();
  }
  await page.locator('#quick-player-layout').click();
  assert.deepEqual(await page.evaluate(()=>DuneApp.getState().nodes.map(({id,x,y})=>({id,x,y}))),original,'organizing a player view preserves GM positions');
  const layout=await page.evaluate(()=>JSON.stringify(DuneApp.getState().playerLayout));assert.notEqual(layout,'{}','player organization is applied');
  assert.equal(await page.locator('#archives-player-display-open').count(),0,'three-dot options icon is gone');
  assert.equal(await page.locator('#archives-player-arrange').count(),0,'no activation button: cells drag directly');
  const moveCell=await page.locator('.node-cell[data-id="a"]').boundingBox();
  const playerBefore=await page.evaluate(()=>({...DuneApp.getState().playerLayout.a}));
  await page.mouse.move(moveCell.x+90,moveCell.y+75);await page.mouse.down();await page.mouse.move(moveCell.x+152,moveCell.y+109,{steps:6});await page.mouse.up();
  const playerAfter=await page.evaluate(()=>({...DuneApp.getState().playerLayout.a}));
  assert.ok(playerAfter.x>playerBefore.x+20,'dragging with the mouse moves the personal cell');
  assert.deepEqual(await page.evaluate(()=>DuneApp.getState().nodes.map(({id,x,y})=>({id,x,y}))),original,'the GM layout data is untouched');

  await page.locator('#quick-player-center-cell').click();await page.locator('#quick-player-center-all').click();
  await page.getByRole('button',{name:'Réduire la barre des joueurs',exact:true}).click();assert.equal(await page.locator('.player-bar-actions').isVisible(),false);
  await page.getByRole('button',{name:'Déployer la barre des joueurs',exact:true}).click();
  const grip=await page.getByRole('button',{name:'Déplacer la barre des joueurs',exact:true}).boundingBox(),before=await page.locator('.archives-player-dock').boundingBox();
  await page.mouse.move(grip.x+22,grip.y+22);await page.mouse.down();await page.mouse.move(grip.x-200,grip.y+40,{steps:8});await page.mouse.up();
  assert.ok((await page.locator('.archives-player-dock').boundingBox()).x<before.x-100,'mouse grip moves the toolbar');
  await page.locator('#archives-player-icons-toggle').click();assert.equal(await page.locator('.archives-player-dock').isVisible(),false);
  await page.locator('#archives-player-icons-toggle').click();assert.equal(await page.locator('.archives-player-dock').isVisible(),true);
  if(mode==='preview'){
   await page.locator('#quick-mode-switch').click();await page.locator('#archives-player-tools').waitFor({state:'hidden'});assert.equal(await page.locator('#quick-icon-dock').isVisible(),true);
   const popup=page.waitForEvent('popup');await page.evaluate(()=>DuneApp.openPlayerTab());const player=await popup;
   await player.waitForURL(url=>url.searchParams.get('ro')==='1' && /^\d{4}$/.test(url.searchParams.get('v')||''));
   assert.equal(new URL(player.url()).pathname,new URL(page.url()).pathname,'the second screen loads the same application');
   assert.equal(new URL(player.url()).searchParams.get('v'),'4700','the second screen uses the current V4.70 cache version');await player.close();
  }
  assert.deepEqual(errors,[]);console.log('V4.58 desktop '+mode+': one toolbar, click across synchronization, organization, zoom, grip, collapse and hide/restore passed.');
 }finally{await context.close()}
}
(async()=>{const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{for(const mode of ['preview','direct'])await run(browser,mode)}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
