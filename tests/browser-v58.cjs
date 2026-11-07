const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const {archives,owl,hub,configure}=require("./owlbear-fixture.cjs");
const editor=page=>page.frameLocator("#viewer").frameLocator("#app");
const frame=page=>page.frames().find(f=>f.url().includes("owl-editor=1"));
const dialog=page=>editor(page).locator("#archives-owl-transfer");
const managerRow=(page,name)=>dialog(page).locator(".record").filter({hasText:name});
const scenario={activeBoardId:"act-one",boards:[{id:"act-one",name:"Acte privé",links:[],nodes:[
 {id:"hidden-character",title:"Personnage secret",category:"personnage",desc:"Description à ne pas inclure dans le token",secret:"Coffre : 528-secret",clues:[{text:"Indice privé 963",revealed:false}],revealed:false,x:100,y:100,w:250,h:160},
 {id:"visible-report",title:"Rapport visible",category:"objet",desc:"Une information révélée",clues:[],revealed:true,x:450,y:100,w:250,h:160}
]}],journalPages:[{title:"Journal privé",text:"Fin de campagne secrète"}]};
function samplePdf(){
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
  '',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
  '',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
 ];
 const a='BT /F1 24 Tf 30 300 Td (PAGE ONE PRIVATE) Tj ET',b='BT /F1 24 Tf 30 300 Td (PAGE TWO PUBLIC) Tj ET';
 objects[3]='<< /Length '+a.length+' >>\nstream\n'+a+'\nendstream';
 objects[5]='<< /Length '+b.length+' >>\nstream\n'+b+'\nendstream';
 let output='%PDF-1.4\n',offsets=[0];
 objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(output));output+=(index+1)+' 0 obj\n'+object+'\nendobj\n'});
 const xref=Buffer.byteLength(output);output+='xref\n0 8\n0000000000 65535 f \n';
 offsets.slice(1).forEach(offset=>{output+=String(offset).padStart(10,'0')+' 00000 n \n'});
 output+='trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(output);
}
async function waitLocal(page,count){await page.waitForFunction(count=>window.fixture.local().length===count,count)}
async function waitShared(page,count){await page.waitForFunction(async count=>(await window.fixture.scene()).items.length===count,count)}
async function closeDialog(page){if(await dialog(page).count())await dialog(page).getByRole('button',{name:'Fermer le transfert'}).click()}
async function openCharacter(page){
 await frame(page).evaluate(async()=>{window.DuneApp.getState().selectedId='hidden-character';await window.ArchivesCellTransfer.sendSelected()});
 await dialog(page).locator('[data-submit]:not([disabled])').waitFor();
}
(async()=>{
 const options=process.env.ARCHIVES_CHROMIUM_OPTIONS;
 const browser=await chromium.launch({headless:true,...(options?JSON.parse(options):{})});
 try{
  const fixtureHub=hub(),gmContext=await browser.newContext(),playerContext=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  await Promise.all([gmContext,playerContext].map(context=>configure(context,fixtureHub,{sceneReady:true})));
  const gm=await gmContext.newPage(),player=await playerContext.newPage();
  const errors=[];gm.on('console',msg=>{if(msg.type()==='warning'&&/privé|transfert/i.test(msg.text()))errors.push(msg.text())});
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');
  await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'Personnage secret'}).waitFor();
  await frame(gm).evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=300;canvas.height=500;const ctx=canvas.getContext('2d');ctx.fillStyle='#c63526';ctx.fillRect(0,0,300,500);ctx.fillStyle='#2b4ba6';ctx.fillRect(30,40,240,350);
   window.fixtureImage=canvas.toDataURL('image/png');window.DuneApp.getState().nodes.find(n=>n.id==='hidden-character').bgImg=window.fixtureImage;
  });
  await openCharacter(gm);
  assert.equal(await dialog(gm).locator('[data-kind]').inputValue(),'TOKEN');
  assert.equal(await dialog(gm).locator('[data-reveal]').isChecked(),false);
  assert.deepEqual(await dialog(gm).locator('[data-preview]').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight})),{width:512,height:512});
  assert.ok(!(await dialog(gm).textContent()).includes('528-secret'));
  await dialog(gm).getByRole('button',{name:'Transférer en gardant caché',exact:true}).click();
  await managerRow(gm,'Personnage secret').getByRole('button',{name:'Révéler',exact:true}).waitFor();
  await waitLocal(gm,1);await waitShared(gm,0);
  const hidden=await gm.evaluate(()=>window.fixture.local()[0]);
  assert.equal(hidden.layer,'CHARACTER');assert.equal(hidden.grid.dpi,512);assert.match(hidden.image.url,/^https:\/\/images\.owlbear\.test/);
  assert.equal((await player.evaluate(()=>window.fixture.local())).length,0);
  let wire=await player.evaluate(()=>window.fixture.wire());
  assert.ok(!JSON.stringify(wire).includes('Personnage secret'),'hidden title never shared');
  assert.ok(!JSON.stringify(wire).includes(hidden.image.url),'hidden artwork URL never shared');
  assert.equal((await player.evaluate(()=>window.fixture.uploads())).length,0);
  await gm.evaluate(id=>window.fixture.moveLocal(id,{x:123,y:456}),hidden.id);
  await closeDialog(gm);
  // A real reload exercises IndexedDB restoration of privately prepared items.
  await gm.reload();await gm.locator('#archives-tool').waitFor();await waitLocal(gm,1);
  assert.deepEqual((await gm.evaluate(()=>window.fixture.local()[0])).position,{x:123,y:456});
  await gm.locator('#archives-tool').click();
  await editor(gm).locator('.cell-title-txt').filter({hasText:'Personnage secret'}).waitFor();
  await frame(gm).evaluate(()=>window.ArchivesCellTransfer.showManager());
  await managerRow(gm,'Personnage secret').getByRole('button',{name:'Révéler',exact:true}).click();
  await waitShared(gm,1);await waitLocal(gm,0);
  let item=(await gm.evaluate(()=>window.fixture.scene())).items[0];
  assert.equal(item.id,hidden.id);assert.deepEqual(item.position,{x:123,y:456});assert.equal(item.image.url,hidden.image.url);assert.equal(item.visible,true);
  assert.equal((await player.evaluate(()=>window.fixture.scene())).items[0].id,item.id);
  await closeDialog(gm);
  // A changed transfer stays private by default, updates the same item, and keeps placement.
  await frame(gm).evaluate(()=>{const node=window.DuneApp.getState().nodes.find(n=>n.id==='hidden-character');node.bgImg='';node.title='Nouvelle identité cachée'});
  await openCharacter(gm);
  await dialog(gm).getByRole('button',{name:'Transférer en gardant caché',exact:true}).click();
  await managerRow(gm,'Nouvelle identité cachée').getByRole('button',{name:'Révéler',exact:true}).waitFor();
  await waitShared(gm,0);await waitLocal(gm,1);
  assert.equal((await gm.evaluate(()=>window.fixture.local()[0])).id,item.id);
  assert.deepEqual((await gm.evaluate(()=>window.fixture.local()[0])).position,{x:123,y:456});
  wire=await player.evaluate(()=>window.fixture.wire());assert.ok(!JSON.stringify(wire).includes('Nouvelle identité cachée'));
  await managerRow(gm,'Nouvelle identité cachée').getByRole('button',{name:'Révéler',exact:true}).click();
  await waitShared(gm,1);await closeDialog(gm);
  // A non-character image from the library can be turned into a token.
  await frame(gm).evaluate(async()=>{const c=document.createElement('canvas');c.width=300;c.height=500;c.getContext('2d').fillRect(0,0,300,500);await window.ArchivesCellTransfer.sendImage({id:'object-library',name:'Document devenu pion',category:'objet',data:c.toDataURL()})});
  await dialog(gm).locator('[data-submit]:not([disabled])').waitFor();assert.equal(await dialog(gm).locator('[data-kind]').inputValue(),'DOCUMENT');
  await dialog(gm).locator('[data-kind]').selectOption('TOKEN');
  await dialog(gm).locator('[data-reveal]').check();
  await dialog(gm).getByRole('button',{name:'Transférer et révéler',exact:true}).click();
  await managerRow(gm,'Document devenu pion').getByRole('button',{name:'Cacher',exact:true}).waitFor();await waitShared(gm,2);
  item=(await gm.evaluate(()=>window.fixture.scene())).items.find(item=>item.name==='Document devenu pion');assert.equal(item.layer,'CHARACTER');assert.equal(item.image.width,512);await closeDialog(gm);
  // Text document is rasterized; only its chosen representation enters Owlbear.
  await frame(gm).evaluate(()=>window.ArchivesCellTransfer.sendFile(new File(['Rapport destiné aux joueurs.'],'rapport.txt',{type:'text/plain'}),'Rapport publié'));
  await dialog(gm).locator('[data-submit]:not([disabled])').waitFor();assert.equal(await dialog(gm).locator('[data-include]').isChecked(),true);
  await dialog(gm).locator('[data-reveal]').check();await dialog(gm).getByRole('button',{name:'Transférer et révéler',exact:true}).click();
  await managerRow(gm,'Rapport publié').getByRole('button',{name:'Cacher',exact:true}).waitFor();await waitShared(gm,3);
  item=(await gm.evaluate(()=>window.fixture.scene())).items.find(item=>item.name==='Rapport publié');assert.equal(item.layer,'PROP');assert.equal(item.image.width,1200);await closeDialog(gm);
  // Actual PDF.js worker, selected second page, no original PDF sharing.
  await frame(gm).evaluate(bytes=>window.ArchivesCellTransfer.sendFile(new File([new Uint8Array(bytes)],'deux-pages.pdf',{type:'application/pdf'}),'Page publique'),Array.from(samplePdf()));
  await dialog(gm).locator('[data-submit]:not([disabled])').waitFor({timeout:20000});
  assert.equal(await dialog(gm).locator('[data-page]').getAttribute('max'),'2');
  const firstPage=await dialog(gm).locator('[data-preview]').getAttribute('src');
  await dialog(gm).locator('[data-page]').fill('2');await dialog(gm).locator('[data-page]').dispatchEvent('change');
  await dialog(gm).locator('[data-submit]:not([disabled])').waitFor();
  assert.notEqual(await dialog(gm).locator('[data-preview]').getAttribute('src'),firstPage);
  await dialog(gm).screenshot({path:'/tmp/archives-transfer-pdf-v58.png'});
  await dialog(gm).locator('[data-reveal]').check();await dialog(gm).getByRole('button',{name:'Transférer et révéler',exact:true}).click();
  await managerRow(gm,'Page publique').getByRole('button',{name:'Cacher',exact:true}).waitFor();await waitShared(gm,4);
  wire=await player.evaluate(()=>window.fixture.wire());assert.ok(!JSON.stringify(wire).includes('PAGE ONE PRIVATE'));assert.ok(!JSON.stringify(wire).includes('528-secret'));
  await managerRow(gm,'Page publique').getByRole('button',{name:'Cacher',exact:true}).click();await waitShared(gm,3);await waitLocal(gm,1);await closeDialog(gm);
  // Scene changes invalidate an already-open transfer, before any new upload.
  await openCharacter(gm);const uploadsBefore=(await gm.evaluate(()=>window.fixture.uploads())).length;
  await gm.evaluate(()=>window.fixture.setScene());
  await dialog(gm).getByRole('button',{name:'Transférer en gardant caché',exact:true}).click();
  await dialog(gm).locator('[data-status]').filter({hasText:'La scène a changé'}).waitFor();
  assert.equal((await gm.evaluate(()=>window.fixture.uploads())).length,uploadsBefore);await closeDialog(gm);
  // Players cannot forge a transfer command to their host, even by bypassing UI.
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  const pf=()=>player.frames().find(f=>f.url().includes('owl-view=1'));
  await editor(player).locator('.cell-title-txt').filter({hasText:'Rapport visible'}).waitFor();
  await pf().evaluate(()=>window.parent.postMessage({protocol:'archives:owlbear:v56',type:'owl-transfer-command',id:crypto.randomUUID(),command:{action:'context'}},location.origin));
  assert.equal((await player.evaluate(()=>window.fixture.uploads())).length,0);await waitShared(player,0);
  assert.equal(await pf().evaluate(()=>window.DuneApp.getState().strictReadOnly),true);
  await gm.evaluate(()=>window.fixture.changeRole('PLAYER'));
  await gm.frameLocator('#viewer').locator('#app').waitFor({state:'hidden'});
  assert.equal(await gm.frameLocator('#viewer').locator('#app').getAttribute('src'),null);await waitLocal(gm,0);
  assert.equal(gmContext.pages().length,1);assert.equal(playerContext.pages().length,1);
  assert.deepEqual(errors,[]);
  console.log('Owlbear simulé : personnages et documents en tokens, PDF page choisie, fichiers cachés strictement locaux, sauvegarde et déplacement, révélation/retrait, scène et rôles contrôlés, aucun code joueur.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
