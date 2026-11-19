const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const transfer=p=>editor(p).locator('#archives-owl-transfer');
const frame=p=>p.frames().find(f=>f.url().includes('owl-editor=1'));
const scenario={activeBoardId:'one',boards:[{id:'one',name:'Deux visibilités distinctes',links:[],nodes:[
 {id:'npc1',title:'Garde révélé',category:'personnage',revealed:true,clues:[],x:80,y:80,w:240,h:180,
  desc:'DOSSIER_CONFIDENTIEL_V469',npcSheet:{attributes:{CON:'6'},sections:{notes:'NOTE_MJ_SECRETE_V469'}}},
 {id:'npc2',title:'Garde non révélé',category:'personnage',revealed:false,clues:[],x:400,y:80,w:240,h:180}
]}]};
async function waitNative(page,id,visible){
 await page.waitForFunction(async ({id,visible})=>
   (await window.fixture.scene()).items.find(item=>item.id===id)?.visible===visible,{id,visible});
}
async function cellState(frame,id){
 return frame.evaluate(id=>window.DuneApp.getState().nodes.find(node=>node.id===id).revealed,id);
}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const fixtureHub=hub(),gmCtx=await browser.newContext(),playerCtx=await browser.newContext();
 await Promise.all([gmCtx,playerCtx].map(c=>configure(c,fixtureHub,{sceneReady:true})));
 const gm=await gmCtx.newPage(),player=await playerCtx.newPage(),errors=[];
 gm.on('pageerror',e=>errors.push('MJ: '+e.message));player.on('pageerror',e=>errors.push('Joueur: '+e.message));
 gm.setDefaultTimeout(40000);player.setDefaultTimeout(40000);
 try{
  await gm.goto(owl+'/room/two-independent-states');
  await player.goto(owl+'/room/two-independent-states?joueur=Alice');
  await gm.locator('#archives-tool').click();
  await editor(gm).locator('body').waitFor();
  let e=frame(gm);
  for(let i=0;!e&&i<100;i++){await gm.waitForTimeout(100);e=frame(gm);}
  if(!e)throw Error('Éditeur MJ introuvable.');
  await e.waitForFunction(()=>window.ArchivesRelay&&window.DuneApp&&window.ArchivesCellTransfer);
  // Importer comme un vrai MJ : le relais Owlbear peut livrer un snapshot
  // initial concurrent et remplacer une injection directe de test.
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'etats-independants.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await e.waitForFunction(()=>['npc1','npc2'].every(id=>window.DuneApp.getState().nodes.some(n=>n.id===id)));
  await e.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=220;canvas.height=270;
    canvas.getContext('2d').fillRect(0,0,220,270);
    const state=window.DuneApp.getState();
    state.nodes[0].bgImg=canvas.toDataURL('image/png');
    state.nodes[1].bgImg=canvas.toDataURL('image/png');
    state.selectedId='npc1';
    return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-submit]:not([disabled])').waitFor();

  // A REVEALED Archive cell can create a native hidden Owlbear token.
  await transfer(gm).getByRole('button',{name:'Placer en Hide (joueurs)',exact:true}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===1);
  let [token]=(await gm.evaluate(()=>window.fixture.scene())).items;
  const id=token.id;
  assert.equal(token.layer,'CHARACTER');
  assert.equal(token.visible,false,'actual native Owlbear Hide');
  assert.equal((await gm.evaluate(()=>window.fixture.local())).length,0);
  assert.equal(await cellState(e,'npc1'),true,'Archive cell is still revealed');
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items.filter(item=>item.visible).length,0);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:one:npc1')?.revealed===false);

  // Changing ONLY the Archive cell must not change the Owlbear token.
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc1'));
  assert.equal(await cellState(e,'npc1'),false);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].visible,false);
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc1'));
  assert.equal(await cellState(e,'npc1'),true);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].visible,false);

  // Show via Archives, independent of cell status.
  await e.evaluate(()=>window.ArchivesCellTransfer.setTokenVisibility('cell:one:npc1',true));
  await waitNative(gm,id,true);
  assert.equal(await cellState(e,'npc1'),true);
  await e.evaluate(()=>window.DuneApp.toggleRevealById('npc1'));
  assert.equal(await cellState(e,'npc1'),false);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items[0].visible,true);
  assert.equal(await e.evaluate(()=>window.ArchivesRelay.publicView().boards[0].nodes.some(n=>n.id==='npc1')),false,
    'the hidden Archive cell stays hidden in Archive player view');
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items.filter(item=>item.visible).length,1,
    'the Owlbear player sees only the Show token');

  // Native Owlbear Hide/Show changes only the token, never the Archive cell.
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,false),id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:one:npc1')?.revealed===false);
  assert.equal(await cellState(e,'npc1'),false);
  await gm.evaluate(id=>window.fixture.setSharedVisible(id,true),id);
  await e.waitForFunction(()=>window.ArchivesTokenSync?.bySource('cell:one:npc1')?.revealed===true);
  assert.equal(await cellState(e,'npc1'),false);

  // From the cell right-click action: Hide/Show without reimporting its image.
  const uploads=(await gm.evaluate(()=>window.fixture.uploads())).length;
  await e.evaluate(()=>document.getElementById('archives-ctx-owl-hide').click());
  await waitNative(gm,id,false);
  assert.equal(await cellState(e,'npc1'),false);
  await e.evaluate(()=>document.getElementById('archives-ctx-owl-show').click());
  await waitNative(gm,id,true);
  assert.equal(await cellState(e,'npc1'),false);
  assert.equal((await gm.evaluate(()=>window.fixture.uploads())).length,uploads);
  assert.equal((await gm.evaluate(()=>window.fixture.scene())).items.length,1);

  // The transfer manager also changes only Owlbear's visibility.
  await e.evaluate(()=>window.ArchivesCellTransfer.showManager());
  await transfer(gm).getByRole('button',{name:'Hide',exact:true}).click();
  await waitNative(gm,id,false);
  assert.equal(await cellState(e,'npc1'),false);
  await transfer(gm).getByRole('button',{name:'Show',exact:true}).click();
  await waitNative(gm,id,true);
  assert.equal(await cellState(e,'npc1'),false);
  await transfer(gm).getByRole('button',{name:'Fermer le transfert'}).click();

  // Inverse: unrevealed Archive cell, Show immediately on first placement.
  await e.evaluate(()=>window.ArchivesCellTransfer.sendCell(
    window.DuneApp.getState().nodes.find(n=>n.id==='npc2'),'one'));
  await transfer(gm).locator('[data-share]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer en Show (joueurs)',exact:true}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===2);
  const tokens=(await gm.evaluate(()=>window.fixture.scene())).items;
  assert.equal(tokens.find(t=>t.name==='Garde non révélé').visible,true);
  assert.equal(await cellState(e,'npc2'),false);

  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('NOTE_MJ_SECRETE_V469'));
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('DOSSIER_CONFIDENTIEL_V469'));
  assert.deepEqual(errors,[]);
  console.log('V4.69 — Hide/Show indépendant des cellules, native Owlbear Hide, menu Archives, gestionnaire, joueur normal, sans réimport.');
 }finally{await gmCtx.close();await playerCtx.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
