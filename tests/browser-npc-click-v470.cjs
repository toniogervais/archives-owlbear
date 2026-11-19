const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>f.url().includes('owl-editor=1'));
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
const marker='fr.archives-imaginaire.bridge/artwork-v58';
const menuId='fr.archives-imaginaire.bridge/npc-token-sheet-v82';
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const h=hub(),gc=await browser.newContext(),pc=await browser.newContext();
 await Promise.all([gc,pc].map(x=>configure(x,h,{sceneReady:true})));
 const gm=await gc.newPage(),player=await pc.newPage(),errors=[];
 gm.on('pageerror',e=>errors.push('MJ '+e.message));player.on('pageerror',e=>errors.push('Joueur '+e.message));
 gm.setDefaultTimeout(40000);
 try{
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  await gm.waitForFunction(id=>!!window.fixture.contextMenus()[id],menuId);
  assert.equal(await player.evaluate(id=>Boolean(window.fixture.contextMenus()[id]),menuId),false);
  await gm.locator('#archives-tool').click();await editor(gm).locator('#world').waitFor();
  const frame=app(gm);await frame.waitForFunction(()=>window.ArchivesCellTransfer&&window.ArchivesRelay);
  const scenario={activeBoardId:'act',boards:[{id:'act',name:'Fiche clic',links:[],nodes:[{
   id:'blank-npc',category:'personnage',title:'Personnage sans fiche',desc:'SECRET_MJ_V470',
   revealed:false,x:80,y:140,w:240,h:170,clues:[],npcSheet:null
  }]}]};
  await frame.evaluate(data=>ArchivesRelay.apply(data),scenario);
  await frame.evaluate(()=>{
   const n=DuneApp.getState().nodes.find(x=>x.id==='blank-npc'),c=document.createElement('canvas');
   c.width=180;c.height=220;c.getContext('2d').fillRect(0,0,180,220);n.bgImg=c.toDataURL('image/png');
   DuneApp.getState().selectedId=n.id;return ArchivesCellTransfer.sendSelected();
  });
  const transfer=editor(gm).locator('#archives-owl-transfer');
  await transfer.locator('[data-submit]:not([disabled])').waitFor();
  await transfer.getByRole('button',{name:'Placer en Hide (joueurs)',exact:true}).click();
  await transfer.waitFor({state:'detached'});
  await gm.waitForFunction(async()=>(await fixture.scene()).items.length===1);
  const [token]=(await gm.evaluate(()=>fixture.scene())).items;
  assert.equal(token.visible,false,'the new NPC is still Hide in Owlbear');
  assert.equal(token.metadata[marker].hasSheet,true,'even a blank NPC has its clickable private sheet');
  assert.equal(token.layer,'CHARACTER');
  assert.equal((await player.evaluate(()=>fixture.scene())).items.filter(x=>x.visible).length,0);

  // Left-click selection preserves Owlbear's native token operations:
  // the character sheet opens only from the explicit menu command.
  await gm.evaluate(id=>fixture.selectToken(id),token.id);
  const view=gm.frameLocator('[id="'+modalId+'"]');
  await gm.waitForTimeout(350);
  assert.deepEqual(await gm.evaluate(()=>fixture.selected()),[token.id]);
  assert.equal(await gm.locator('[id="'+modalId+'"]').count(),0,
    'selecting a token must not cover Owlbear native controls');

  // The MJ can open the private sheet from Owlbear's normal context menu.
  await gm.evaluate(({id,item})=>fixture.clickMenu(id,item),{id:menuId,item:token});
  await view.locator('#sheet:not([hidden])').waitFor();
  assert.equal(await view.locator('#title').textContent(),'Personnage sans fiche');
  assert.equal(await view.locator('#sheet .stat').count(),16);
  assert.equal(await view.locator('#sheet .track').count(),2,'les deux compteurs de points de vie sont affichés');
  const physical=view.locator('.track[data-kind="physical"]');
  await physical.getByRole('spinbutton',{name:'Physique — Cases totales'}).fill('12');
  await physical.getByRole('spinbutton',{name:'Physique — Cases totales'}).press('Tab');
  await physical.locator('.track-box').nth(3).click();
  await physical.locator('.track-count').getByText('4 / 12').waitFor();
  const stun=view.locator('.track[data-kind="stun"]');
  await stun.getByRole('spinbutton',{name:'Étourdissement — Cases totales'}).fill('9');
  await stun.getByRole('spinbutton',{name:'Étourdissement — Cases totales'}).press('Tab');
  await stun.locator('.track-box').nth(1).click();
  await stun.locator('.track-count').getByText('2 / 9').waitFor();
  await view.getByRole('button',{name:'Fermer la fiche'}).click();
  await gm.locator('[id="'+modalId+'"]').waitFor({state:'detached'});
  assert.deepEqual(await gm.evaluate(()=>fixture.selected()),[token.id],
    'closing the sheet must not deselect the Owlbear token');

  // Repeated left and right selection operations must not open the sheet.
  await gm.evaluate(()=>fixture.selectToken(null));
  await gm.evaluate(id=>fixture.selectToken(id),token.id);
  await gm.waitForTimeout(350);
  assert.equal(await gm.locator('[id="'+modalId+'"]').count(),0);
  assert.deepEqual(await gm.evaluate(()=>fixture.selected()),[token.id]);

  // Reopen it from the same menu, without losing injuries or Hide/Show.
  await gm.evaluate(({id,item})=>fixture.clickMenu(id,item),{id:menuId,item:token});
  await view.locator('#sheet:not([hidden])').waitFor();
  await physical.locator('.track-count').getByText('4 / 12').waitFor();
  await stun.locator('.track-count').getByText('2 / 9').waitFor();
  assert.equal((await gm.evaluate(()=>fixture.scene())).items[0].visible,false,'reading a sheet never Shows a hidden token');
  assert.equal(await player.locator('[id="'+modalId+'"]').count(),0);
  assert.ok(!JSON.stringify(await player.evaluate(()=>fixture.wire())).includes('SECRET_MJ_V470'));
  await view.getByRole('button',{name:'Fermer la fiche'}).click();
  await gm.locator('[id="'+modalId+'"]').waitFor({state:'detached'});
  assert.deepEqual(await gm.evaluate(()=>fixture.selected()),[token.id]);

  // A PLAYER selecting the same token never opens the private interface.
  await player.evaluate(id=>fixture.selectToken(id),token.id);
  await player.waitForTimeout(350);
  assert.equal(await player.locator('[id="'+modalId+'"]').count(),0);
  assert.equal(await player.evaluate(id=>!!fixture.contextMenus()[id],menuId),false);
  assert.deepEqual(errors,[]);
  console.log('V4.71: ordinary Owlbear selection, GM-only context menu sheet, saved physical/stun health and player privacy.');
 }finally{await gc.close();await pc.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
