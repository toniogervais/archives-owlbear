const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const menuId='fr.archives-imaginaire.bridge/token-visibility-v83';
const assetKey='fr.archives-imaginaire.bridge/artwork-v58';
const scenario={activeBoardId:'test',boards:[{id:'test',name:'Test visibilité',links:[],nodes:[{
  id:'guard',title:'Garde de sécurité',category:'personnage',revealed:false,
  desc:'CONFIDENTIEL_SCENARIO_467',x:80,y:120,w:250,h:180,clues:[],
  npcSheet:{attributes:{CON:'4'},sections:{notes:'SECRET_FICHE_467'},
    condition:{physical:{total:10,damage:1}}}
}]}]};
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const transfer=p=>editor(p).locator('#archives-owl-transfer');
const frame=p=>p.frames().find(f=>f.url().includes('owl-editor=1'));
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const fixtureHub=hub(),gmContext=await browser.newContext(),playerContext=await browser.newContext();
 await Promise.all([gmContext,playerContext].map(c=>configure(c,fixtureHub,{sceneReady:true})));
 const gm=await gmContext.newPage(),player=await playerContext.newPage();
 const errors=[];gm.on('pageerror',e=>errors.push('MJ: '+e.message));player.on('pageerror',e=>errors.push('joueur: '+e.message));
 gm.setDefaultTimeout(40000);player.setDefaultTimeout(40000);
 try{
  await gm.goto(owl+'/room/tokens-v467');
  await player.goto(owl+'/room/tokens-v467?joueur=Alix');
  await gm.waitForFunction(id=>!!window.fixture.contextMenus()[id],menuId);
  assert.equal(await player.evaluate(id=>Boolean(window.fixture.contextMenus()[id]),menuId),false);
  await gm.locator('#archives-tool').click();
  await editor(gm).locator('body').waitFor();
  let e=frame(gm);
  for(let i=0;!e&&i<100;i++){await gm.waitForTimeout(100);e=frame(gm);}
  if(!e)throw Error('Archives MJ non chargées dans Owlbear.');
  await e.waitForFunction(()=>!!window.ArchivesCellTransfer&&!!window.ArchivesRelay&&!!window.DuneApp);
  await e.evaluate(value=>window.ArchivesRelay.apply(value),scenario);
  await e.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=300;
    canvas.getContext('2d').fillRect(0,0,240,300);
    const s=window.DuneApp.getState(),n=s.nodes.find(n=>n.id==='guard');
    n.bgImg=canvas.toDataURL('image/png');s.selectedId=n.id;
    return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-submit]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer en Hide (joueurs)',exact:true}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===1);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  const [hidden]=(await gm.evaluate(()=>window.fixture.scene())).items;
  assert.equal(hidden.layer,'CHARACTER','native Owlbear character layer');
  assert.equal(hidden.visible,false,'the token is in the native Hide state');
  assert.equal(hidden.metadata[assetKey].privateForGM,false);
  assert.equal(hidden.metadata[assetKey].kind,'TOKEN');
  assert.equal((await player.evaluate(()=>window.fixture.local())).length,0);
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items.filter(item=>item.visible).length,0);
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('SECRET_FICHE_467'));
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.private===false);
  assert.equal(await e.evaluate(()=>window.ArchivesTokenSync.bySource('cell:test:guard').revealed),false);

  // Owlbear native Show/Hide works for the very first hidden token.
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item:hidden});
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(item=>item.id===id)?.visible===true,hidden.id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);
  let [shared]=(await gm.evaluate(()=>window.fixture.scene())).items;
  assert.equal(shared.id,hidden.id,'same stable ID when revealed');
  assert.equal(shared.layer,'CHARACTER');
  assert.equal(shared.visible,true);
  assert.equal(shared.metadata[assetKey].privateForGM,false);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);

  // Native Owlbear Hide leaves a single shared item. Native Show works again.
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,false),hidden.id);
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(i=>i.id===id)?.visible===false,hidden.id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===false);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0,'no private duplicate during native Hide');
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1,'native Show keeps its target');
  assert.equal(await e.evaluate(()=>window.ArchivesTokenSync.bySource('cell:test:guard').private),false);
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,true),hidden.id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);

  // Extension's contextual Hide/Reveal is also reversible and tracked.
  shared=(await gm.evaluate(()=>window.fixture.scene())).items[0];
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item:shared});
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===false);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].visible,false);
  shared=(await gm.evaluate(()=>window.fixture.scene())).items[0];
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item:shared});
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);
  await gm.evaluate(id=>window.fixture.moveShared(id,{x:277,y:344}),hidden.id);
  await e.waitForFunction(()=>{
    const p=window.ArchivesTokenSync?.bySource('cell:test:guard')?.position;
    return p?.x===277&&p?.y===344;
  });

  // A new transfer must not reset the token moved manually within Owlbear.
  await e.evaluate(()=>{
    const s=window.DuneApp.getState(),n=s.nodes.find(x=>x.id==='guard');
    n.title='Garde actualisé';s.selectedId=n.id;return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-submit]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer en Hide (joueurs)',exact:true}).click();
  await transfer(gm).waitFor({state:'detached'});
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===false);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  shared=(await gm.evaluate(()=>window.fixture.scene())).items[0];
  assert.equal(shared.visible,false);
  assert.deepEqual(shared.position,{x:277,y:344});
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('Garde actualisé'));

  await gm.evaluate(id=>window.fixture.setSharedVisible(id,true),hidden.id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);
  shared=(await gm.evaluate(()=>window.fixture.scene())).items[0];
  assert.equal(shared.name,'Garde actualisé');
  assert.deepEqual(shared.position,{x:277,y:344});

  // A page reload reconstructs synchronization without duplicating the token.
  await gm.reload();await gm.locator('#archives-tool').waitFor();
  await gm.locator('#archives-tool').click();
  await editor(gm).locator('body').waitFor();
  let again=frame(gm);
  for(let i=0;!again&&i<100;i++){await gm.waitForTimeout(100);again=frame(gm);}
  if(!again)throw Error('Archives non rechargées.');
  await again.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:test:guard')?.revealed===true);
  assert.deepEqual(await again.evaluate(()=>window.ArchivesTokenSync.bySource('cell:test:guard').position),{x:277,y:344});
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1);
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('SECRET_FICHE_467'));
  assert.deepEqual(errors,[]);
  console.log('V4.69: native Hide/Show from initial token placement, GM context, stable ID/position and private sheets');
 }finally{await gmContext.close();await playerContext.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
