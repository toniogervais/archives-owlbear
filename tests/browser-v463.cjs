const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,hub,configure}=require('./owlbear-fixture.cjs');
const data={activeBoardId:'a',boards:[{id:'a',name:'Acte Shadowrun',links:[],nodes:[
 {id:'pnj1',title:'Patrouilleur Lone Star',category:'personnage',revealed:true,x:100,y:130,w:260,h:180,desc:'Un garde en patrouille.',clues:[]},
 {id:'pnj2',title:'Rigger Minuteman',category:'personnage',revealed:true,x:480,y:130,w:260,h:180,desc:'Un opérateur.',clues:[]},
 {id:'lieu1',title:'Garage',category:'lieu',revealed:true,x:700,y:440,w:260,h:180,clues:[]}
]}]};
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const context=await browser.newContext({viewport:{width:1360,height:900}});
 await configure(context,hub(),{sceneReady:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(40000);
 try{
  await page.goto(archives+'/archives.html?resume=1');
  await page.waitForFunction(()=>window.DuneApp&&window.ArchivesCellBrief&&window.ArchivesNpcSheet);
  await page.evaluate(s=>ArchivesRelay.apply(s),data);
  await page.evaluate(()=>ArchivesCellBrief.open('pnj1'));
  const brief=page.locator('#archives-cell-brief[open]');
  await brief.locator('.brief-card[data-node-id="pnj1"] .npc-sheet').waitFor();
  assert.equal(await brief.locator('.npc-professionalism strong').innerText(),'—','no fabricated professionalism score');
  assert.equal(await brief.locator('.npc-attributes .npc-stat').count(),10);
  assert.equal(await brief.locator('.npc-combat .npc-stat').count(),6);
  assert.equal(await brief.locator('.brief-card[data-node-id="pnj1"] .npc-track-box').count(),0,'health monitors need a manually assigned capacity');
  // La fiche se redessine après l'ouverture : une étiquette détachée renvoie
  // momentanément une couleur vide. Tester le style du nœud courant, connecté.
  await page.waitForFunction(() => {
    const label=document.querySelector('#archives-cell-brief[open] .npc-stat-label');
    return !!label?.isConnected && getComputedStyle(label).color==='rgb(255, 107, 127)';
  });
  const cssColor=await brief.locator('.npc-stat-label').first().evaluate(el=>getComputedStyle(el).color);
  assert.equal(cssColor,'rgb(255, 107, 127)','red characteristic labels, as requested');
  await brief.getByRole('button',{name:'Modifier la fiche PNJ : caractéristiques, équipement et moniteurs'}).click();
  const editor=page.locator('#archives-npc-editor[open]');
  await editor.locator('[name="npc-professionnalisme"]').fill('3');
  await editor.locator('[name="attribute:CON"]').fill('5');
  await editor.locator('[name="attribute:VOL"]').fill('4');
  await editor.locator('[name="attribute:ESS"]').fill('4,7');
  await editor.locator('[name="combat:I/DI"]').fill('7/2');
  await editor.locator('[name="section:armes"]').fill('Pistolet Colt America');
  await editor.locator('[name="section:equipement"]').fill('Commlink de sécurité');
  await editor.locator('[name="track-total:physical"]').fill('11');
  await editor.locator('[name="track-total:stun"]').fill('10');
  await editor.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await editor.waitFor({state:'hidden'});
  await page.waitForFunction(()=>DuneApp.getState().nodes[0].npcSheet?.condition.physical.total===11);
  await brief.locator('.npc-track-box').first().waitFor();
  const physical=brief.locator('.npc-track').first();
  await physical.locator('input[type=checkbox]').nth(2).check();
  await page.waitForFunction(()=>DuneApp.getState().nodes[0].npcSheet?.condition.physical.damage===3);
  assert.equal(await physical.locator('input:checked').count(),3,'checking the third box records three wounds');
  const saved=await page.evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='pnj1').npcSheet);
  assert.equal(saved.professionnalisme,3);assert.equal(saved.attributes.CON,'5');assert.equal(saved.attributes.ESS,'4,7');
  assert.equal(saved.sections.armes,'Pistolet Colt America');assert.equal(saved.condition.physical.damage,3);
  assert.ok(!JSON.stringify(await page.evaluate(()=>ArchivesRelay.publicView())).includes('Pistolet Colt America'),'NPC sheet is not in player snapshot');
  await page.reload();await page.waitForFunction(()=>window.ArchivesCellBrief&&window.ArchivesNpcSheet&&DuneApp.getState().nodes.some(n=>n.id==='pnj1'));
  await page.evaluate(()=>ArchivesCellBrief.open('pnj1'));
  const reopened=page.locator('#archives-cell-brief[open]');
  await reopened.locator('.npc-track-box').first().waitFor();
  assert.equal(await reopened.locator('.npc-professionalism strong').innerText(),'3');
  assert.equal(await reopened.locator('.npc-track').first().locator('input:checked').count(),3,'wounds survive a new session/reload');
  assert.ok((await reopened.innerText()).includes('Pistolet Colt America'));
  await page.evaluate(()=>ArchivesCellBrief.open('pnj2'));await page.evaluate(()=>ArchivesCellBrief.open('lieu1'));
  assert.equal(await reopened.locator('.brief-card').count(),3);
  assert.equal(await reopened.locator('.brief-card[data-node-id="pnj2"] .npc-sheet').count(),1);
  assert.equal(await reopened.locator('.brief-card[data-node-id="lieu1"] .npc-sheet').count(),0,'no NPC sheet on places');
  assert.deepEqual(errors,[]);
  console.log('V4.63: full NPC sheet edit, Shadowrun labels in red, condition checkboxes, game-session persistence, private player transport and multi-brief layout passed.');
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
