const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const edit=p=>p.frameLocator('#viewer').frameLocator('#app');
const transfer=p=>edit(p).locator('#archives-owl-transfer');
const editorFrame=p=>p.frames().find(f=>f.url().includes('owl-editor=1'));
const data={activeBoardId:'one',boards:[{id:'one',name:'Scène de test',links:[],nodes:[
 {id:'npc1',title:'Agent secret',category:'personnage',revealed:false,clues:[],x:80,y:80,w:240,h:180,
  desc:'DOSSIER_NON_REVELE_V468',npcSheet:{attributes:{CON:'6'},sections:{notes:'NOTE_PRIVEE_V468'}}},
 {id:'npc2',title:'Personnage non transféré',category:'personnage',revealed:false,clues:[],x:400,y:80,w:240,h:180}
]}]};
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const hubRef=hub(),gmCtx=await browser.newContext(),playerCtx=await browser.newContext();
 await Promise.all([gmCtx,playerCtx].map(c=>configure(c,hubRef,{sceneReady:true})));
 const gm=await gmCtx.newPage(),player=await playerCtx.newPage(),errors=[];
 gm.on('pageerror',e=>errors.push(e.message));player.on('pageerror',e=>errors.push(e.message));
 gm.setDefaultTimeout(40000);
 try{
  await gm.goto(owl+'/room/hide-show-v468');
  await player.goto(owl+'/room/hide-show-v468?joueur=Charlie');
  await gm.locator('#archives-tool').click();
  await edit(gm).locator('body').waitFor();
  let e=editorFrame(gm);
  for(let i=0;!e&&i<100;i++){await gm.waitForTimeout(100);e=editorFrame(gm);}
  if(!e)throw Error('Owlbear n’a pas ouvert les Archives MJ.');
  await e.waitForFunction(()=>window.ArchivesRelay&&window.DuneApp&&window.ArchivesCellTransfer);
  await e.evaluate(value=>window.ArchivesRelay.apply(value),data);
  await e.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=230;
    canvas.getContext('2d').fillRect(0,0,200,230);
    const s=window.DuneApp.getState(),node=s.nodes.find(n=>n.id==='npc1');
    node.bgImg=canvas.toDataURL('image/png');s.selectedId='npc1';
    return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-submit]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer caché',exact:true}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(()=>window.fixture.local().length===1);
  let id=(await gm.evaluate(()=>window.fixture.local()[0])).id;
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:one:npc1')?.revealed===false);
  assert.equal(await e.evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed),false);

  // Archive Reveal -> Owlbear Show (for a token initially private).
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc1'));
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(x=>x.id===id)?.visible===true,id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:one:npc1')?.revealed===true);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  assert.equal(await e.evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed),true);

  // Archive Hide -> Owlbear Hide; Owlbear keeps the object, not a duplicate.
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc1'));
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(x=>x.id===id)?.visible===false,id);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  assert.equal(await e.evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed),false);

  // Native Owlbear Show -> Archive Reveal; native Hide -> Archive Hide.
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,true),id);
  await e.waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed===true);
  assert.equal(await e.evaluate(()=>window.ArchivesRelay.publicView().boards[0].nodes.some(n=>n.id==='npc1')),true);
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,false),id);
  await e.waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed===false);
  assert.equal(await e.evaluate(()=>window.ArchivesRelay.publicView().boards[0].nodes.some(n=>n.id==='npc1')),false);

  // Manager Hide/Reveal -> cell state, same source of truth.
  await e.evaluate(()=>window.ArchivesCellTransfer.showManager());
  const manager=transfer(gm);
  await manager.getByRole('button',{name:'Révéler',exact:true}).click();
  await e.waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed===true);
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(x=>x.id===id)?.visible===true,id);
  await manager.getByRole('button',{name:'Cacher',exact:true}).click();
  await e.waitForFunction(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc1').revealed===false);
  await gm.waitForFunction(async id=>(await window.fixture.scene()).items.find(x=>x.id===id)?.visible===false,id);
  await manager.getByRole('button',{name:'Fermer le transfert'}).click();

  // A new/never transferred cell is NEVER placed automatically.
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc2'));
  await gm.waitForTimeout(300);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1);
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  assert.equal(await e.evaluate(()=>window.DuneApp.getState().nodes.find(n=>n.id==='npc2').revealed),true);
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('NOTE_PRIVEE_V468'));
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('DOSSIER_NON_REVELE_V468'));
  assert.deepEqual(errors,[]);
  console.log('V4.68 — Archives Masquer/Reveal ↔ Owlbear Hide/Show, manager, no duplicate or automatic transfer, private notes protected');
 }finally{await gmCtx.close();await playerCtx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
