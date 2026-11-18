const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,hub,configure}=require('./owlbear-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const context=await browser.newContext({viewport:{width:1440,height:920}});
 await configure(context,hub(),{sceneReady:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 try{
  await page.goto(archives+'/archives.html?resume=1');
  await page.waitForFunction(()=>window.DuneApp&&window.ArchivesCellBrief&&window.ArchivesNpcImport&&window.ArchivesNpcSheet);
  const portrait=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=420;c.height=840;const ctx=c.getContext('2d');ctx.fillStyle='#5b2947';ctx.fillRect(0,0,420,840);ctx.fillStyle='#a9c0dd';ctx.fillRect(80,80,240,680);return c.toDataURL();
  });
  const node={id:'npc',title:'Patrouilleur Lone Star',category:'personnage',bgImg:portrait,revealed:true,clues:[],
   x:120,y:100,w:270,h:190,desc:'Un agent de sécurité.',npcSheet:{professionnalisme:3,attributes:{CON:'5'},sections:{competences:'Perception, Armes à feu, Électronique',equipement:'Armure, commlink, radio. '.repeat(35)},condition:{physical:{total:10,damage:1},stun:{total:10,damage:0}}}};
  await page.evaluate(n=>ArchivesRelay.apply({activeBoardId:'acte',boards:[{id:'acte',nodes:[n],links:[]}]}),node);
  await page.evaluate(()=>ArchivesCellBrief.open('npc'));
  const brief=page.locator('#archives-cell-brief[open]'),card=brief.locator('.brief-card[data-node-id="npc"]');
  await card.locator('img.brief-picture').waitFor();
  await card.locator('img.brief-picture').evaluate(img=>img.decode());
  assert.equal(await card.getByRole('button',{name:'Montrer l’image aux joueurs'}).count(),0,'no unnecessary presentation button');
  const imageFit=async()=>card.locator('.brief-figure').evaluate(el=>{
   const img=el.querySelector('img'),frame=el.querySelector('.brief-photo'),fit=getComputedStyle(img).objectFit,box=frame.getBoundingClientRect(),photo=img.getBoundingClientRect();
   return {fit,figure:el.getBoundingClientRect().height,within:photo.width<=box.width+1&&photo.height<=box.height+1,portrait:el.closest('.brief-portrait').getBoundingClientRect().height}
  });
  let desktop=await imageFit();assert.equal(desktop.fit,'contain');assert.ok(desktop.within);
  assert.ok(desktop.figure<=301,'complete portrait adapts to the data');
  await card.locator('img.brief-picture').click({button:'right'});
  const menu=page.locator('#archives-presentation-menu');await menu.getByRole('button',{name:'Montrer aux joueurs'}).waitFor();await page.keyboard.press('Escape');
  for(const width of [820,390,330]){
   await page.setViewportSize({width,height:760});
   await page.waitForTimeout(150);
   const r=await imageFit();
   assert.equal(r.fit,'contain','no crop for '+width);
   assert.ok(r.within,'the image stays in its frame at '+width);
   assert.ok(r.figure>=70,'portrait remains visible on '+width);
   const labels=await card.locator('.npc-stat-label').evaluateAll(e=>e.map(x=>getComputedStyle(x).fontSize));
   assert.ok(labels.every(x=>parseFloat(x)>=7.9&&parseFloat(x)<=10.1),'characteristic font compacts at '+width);
  }
  await page.setViewportSize({width:1440,height:920});
  await card.getByRole('button',{name:'Modifier la fiche PNJ : caractéristiques, équipement et moniteurs'}).click();
  const editor=page.locator('#archives-npc-editor[open]');
  await editor.locator('.npc-import-file').setInputFiles({name:'garde.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({
   npcSheet:{professionnalisme:4,attributes:{CON:'9',AGI:'3','RÉA':'2'},combat:{SD:'8'},sections:{armes:'Colt America L36'},condition:{physical:{total:12,damage:2}}}
  }))});
  await editor.locator('.npc-import-preview').getByText(/champs reconnus/).waitFor();
  assert.equal(await editor.locator('[name="attribute:CON"]').inputValue(),'5','preview does not yet change old value');
  await editor.getByRole('button',{name:'Compléter les champs'}).click();
  assert.equal(await editor.locator('[name="attribute:CON"]').inputValue(),'5','import preserves existing score');
  assert.equal(await editor.locator('[name="attribute:AGI"]').inputValue(),'3');
  assert.equal(await editor.locator('[name="section:armes"]').inputValue(),'Colt America L36');
  assert.equal(await page.evaluate(()=>DuneApp.getState().nodes[0].npcSheet?.attributes?.AGI),undefined,'import does not persist until Save');
  await editor.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await editor.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>DuneApp.getState().nodes[0].npcSheet.attributes.CON),'5');
  assert.equal(await page.evaluate(()=>DuneApp.getState().nodes[0].npcSheet.attributes.AGI),'3');
  await card.getByRole('button',{name:'Modifier la fiche PNJ : caractéristiques, équipement et moniteurs'}).click();
  await editor.locator('.npc-import-file').setInputFiles({name:'statistiques.txt',mimeType:'text/plain',buffer:Buffer.from('Professionnalisme : 5\nCON : 7\nArmes : Pistolet lourd\nSorts : Vision mystique')});
  await editor.locator('.npc-import-preview').getByText(/champs reconnus/).waitFor();
  await editor.getByRole('checkbox',{name:'Remplacer les champs déjà renseignés'}).check();
  await editor.getByRole('button',{name:'Compléter les champs'}).click();
  assert.equal(await editor.locator('[name="attribute:CON"]').inputValue(),'7','optional replacement works');
  assert.equal(await editor.locator('[name="section:sorts"]').inputValue(),'Vision mystique');
  await editor.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await page.reload();await page.waitForFunction(()=>window.ArchivesCellBrief&&window.ArchivesNpcImport&&DuneApp.getState().nodes.some(n=>n.id==='npc'));
  assert.equal(await page.evaluate(()=>DuneApp.getState().nodes[0].npcSheet.attributes.CON),'7','imported values survive reload');
  await page.evaluate(()=>ArchivesCellBrief.open('npc'));
  await page.locator('#archives-cell-brief[open] .brief-picture').waitFor();
  assert.equal(await page.locator('#archives-cell-brief[open] .brief-share-image').count(),0);
  assert.deepEqual(errors,[]);
  console.log('V4.64 — import JSON/TXT preview and optional replacement, red compact statistics, full portrait on PC/tablet/phone, right-click image sharing and persistence passed');
 }finally{await context.close();await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
