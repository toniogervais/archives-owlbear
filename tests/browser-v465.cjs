const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const menuId='fr.archives-imaginaire.bridge/npc-token-sheet-v82';
const marker='fr.archives-imaginaire.bridge/artwork-v58';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
const scenario={activeBoardId:'one',boards:[{id:'one',name:'Patrouille',links:[],nodes:[{
  id:'npc-v465',title:'Agent Lone Star',category:'personnage',revealed:false,x:120,y:100,w:260,h:180,
  desc:'Description privée du scénario',clues:[],
  npcSheet:{professionnalisme:3,attributes:{CON:'5',AGI:'4','RÉA':'3'},combat:{SD:'11'},
    sections:{competences:'Perception 6, Tir 5',armes:'Ares Predator',notes:'GRAND_SECRET_PNJ_465'},
    condition:{physical:{total:10,damage:3},stun:{total:9,damage:1}}}
}]}]};
const gmEditor=page=>page.frames().find(f=>f.url().includes('owl-editor=1'));
const transfer=page=>page.frameLocator('#viewer').frameLocator('#app').locator('#archives-owl-transfer');
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const fixtureHub=hub(),gmContext=await browser.newContext(),playerContext=await browser.newContext();
 await Promise.all([gmContext,playerContext].map(c=>configure(c,fixtureHub,{sceneReady:true})));
 const gm=await gmContext.newPage(),player=await playerContext.newPage(),errors=[];
 gm.on('pageerror',e=>errors.push(e.message));
 gm.setDefaultTimeout(40000);
 try{
  await gm.goto(owl+'/room/characters');await player.goto(owl+'/room/characters?joueur=Alix');
  await gm.waitForFunction(id=>!!window.fixture.contextMenus()[id],menuId);
  const icon=await gm.evaluate(id=>window.fixture.contextMenus()[id].icons[0],menuId);
  assert.deepEqual(icon.filter.roles,['GM'],'menu restricted to MJ');
  assert.equal(await player.evaluate(id=>Boolean(window.fixture.contextMenus()[id]),menuId),false,'player menu must not be registered');
  assert.equal(icon.filter.max,1);
  await gm.locator('#archives-tool').click();
  await gm.frameLocator('#viewer').frameLocator('#app').locator('body').waitFor();
  let frame=gmEditor(gm);
  for(let i=0;!frame&&i<100;i++){await gm.waitForTimeout(100);frame=gmEditor(gm);}
  if(!frame)throw Error('Éditeur MJ non chargé dans Owlbear.');
  await frame.waitForFunction(()=>window.ArchivesCellTransfer&&window.ArchivesRelay&&window.DuneApp);
  await frame.evaluate(data=>window.ArchivesRelay.apply(data),scenario);
  await frame.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=220;
    canvas.getContext('2d').fillRect(0,0,180,220);
    const state=window.DuneApp.getState(),npc=state.nodes.find(n=>n.id==='npc-v465');
    npc.bgImg=canvas.toDataURL('image/png');state.selectedId=npc.id;
    return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-share]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer en Show (joueurs)'}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===1);
  const [item]= (await gm.evaluate(()=>window.fixture.scene())).items;
  assert.equal(item.layer,'CHARACTER');
  assert.equal(item.metadata[marker].hasSheet,true);
  assert.ok(!JSON.stringify(item).includes('GRAND_SECRET_PNJ_465'),'private NPC notes excluded from shared item');
  const playerItem=(await player.evaluate(()=>window.fixture.scene())).items[0];
  assert.equal(playerItem.metadata[marker].hasSheet,true);
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('GRAND_SECRET_PNJ_465'),'private NPC notes excluded from wire');
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item});
  const view=gm.frameLocator('[id="'+modalId+'"]');
  await view.locator('#sheet:not([hidden])').waitFor();
  assert.equal(await view.locator('#title').textContent(),'Agent Lone Star');
  assert.equal(await view.locator('#sheet .stat').count(),16);
  assert.ok((await view.locator('#sheet').textContent()).includes('GRAND_SECRET_PNJ_465'),'MJ sees saved notes');
  assert.ok((await view.locator('#sheet').textContent()).includes('3 / 10'),'damage monitor present');
  const physical=view.locator('.track[data-kind="physical"]');
  const stun=view.locator('.track[data-kind="stun"]');
  await physical.locator('.track-box').nth(5).click();
  await physical.locator('.track-count').getByText('6 / 10').waitFor();
  await physical.getByRole('spinbutton',{name:'Physique — Cases totales'}).fill('12');
  await physical.getByRole('spinbutton',{name:'Physique — Cases totales'}).press('Tab');
  await physical.locator('.track-count').getByText('6 / 12').waitFor();
  await stun.getByRole('spinbutton',{name:'Étourdissement — Dégâts'}).fill('4');
  await stun.getByRole('spinbutton',{name:'Étourdissement — Dégâts'}).press('Tab');
  await stun.locator('.track-count').getByText('4 / 9').waitFor();
  assert.equal(await player.locator('[id="'+modalId+'"]').count(),0,'no player sheet modal');
  assert.ok(!JSON.stringify(await player.evaluate(()=>window.fixture.wire())).includes('6 / 12'),
    'wounds are never sent to players');
  await view.getByRole('button',{name:'Fermer la fiche'}).click();
  await gm.locator('[id="'+modalId+'"]').waitFor({state:'detached'});
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item});
  await view.locator('#sheet:not([hidden])').waitFor();
  await physical.locator('.track-count').getByText('6 / 12').waitFor();
  await stun.locator('.track-count').getByText('4 / 9').waitFor();
  await view.getByRole('button',{name:'Fermer la fiche'}).click();
  await gm.locator('[id="'+modalId+'"]').waitFor({state:'detached'});

  // A later Archives transfer updates other fields without erasing GM wounds.
  await frame.evaluate(()=>{
    const state=window.DuneApp.getState(),npc=state.nodes.find(n=>n.id==='npc-v465');
    npc.npcSheet.attributes.CON='7';state.selectedId=npc.id;
    return window.ArchivesCellTransfer.sendSelected();
  });
  await transfer(gm).locator('[data-share]:not([disabled])').waitFor();
  await transfer(gm).getByRole('button',{name:'Placer en Show (joueurs)'}).click();
  await transfer(gm).waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await window.fixture.scene()).items.length===1);
  const [updatedItem]= (await gm.evaluate(()=>window.fixture.scene())).items;
  await gm.evaluate(({id,item})=>window.fixture.clickMenu(id,item),{id:menuId,item:updatedItem});
  await view.locator('#sheet:not([hidden])').waitFor();
  await view.getByText('7',{exact:true}).first().waitFor();
  await physical.locator('.track-count').getByText('6 / 12').waitFor();
  await stun.locator('.track-count').getByText('4 / 9').waitFor();
  await view.getByRole('button',{name:'Fermer la fiche'}).click();
  await gm.locator('[id="'+modalId+'"]').waitFor({state:'detached'});
  
  // Role changes remove the menu physically, not merely block its actions.
  await gm.evaluate(()=>window.fixture.changeRole('PLAYER'));
  await gm.waitForFunction(id=>!window.fixture.contextMenus()[id],menuId);
  await gm.evaluate(()=>window.fixture.changeRole('GM'));
  await gm.waitForFunction(id=>!!window.fixture.contextMenus()[id],menuId);
  await player.waitForFunction(()=>document.querySelector('iframe#background')!==null);
  assert.equal(await player.evaluate(id=>Boolean(window.fixture.contextMenus()[id]),menuId),false);
  assert.deepEqual(errors,[]);
  console.log('V4.66 — GM-only menu and role changes, editable wounds, persistent state, no player leak, later transfer keeps damage');
 }finally{await gmContext.close();await playerContext.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
