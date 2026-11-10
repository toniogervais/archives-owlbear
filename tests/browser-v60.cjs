const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const {archives,owl,hub,configure}=require("./owlbear-fixture.cjs");
const debug=message=>{if(process.env.ARCHIVES_TEST_VERBOSE)console.log(message)};
const mediaChannel="fr.archives-imaginaire.bridge/media-v60",mediaId="fr.archives-imaginaire.bridge/media-view-v60";
const editor=page=>page.frameLocator("#viewer").frameLocator("#app");
const app=page=>page.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const library=page=>editor(page).locator("#archives-file-library");
const card=(page,title)=>library(page).locator("article").filter({hasText:title});
const viewer=page=>page.frameLocator('[id="'+mediaId+'"]');
const mediaFrame=page=>page.frames().find(f=>f.url().includes("media-view-v60.html"));
const scenario={activeBoardId:"one",boards:[{id:"one",name:"Nom d’acte privé",links:[],nodes:[
 {id:"visible",title:"Rapport montré",desc:"Information publique",revealed:true,x:100,y:100,w:250,h:160,clues:[]},
 {id:"secret",title:"CELLULE_PRIVEE_781",desc:"Dénouement privé",revealed:false,x:400,y:100,w:250,h:160,clues:[]}
]}],journalPages:[{title:"Journal privé",text:"NOTE_PRIVEE_954"}]};
function wav(){
 const count=24000,buffer=Buffer.alloc(44+count*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);
 buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(24000,24);buffer.writeUInt32LE(48000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++)buffer.writeInt16LE(Math.round(1200*Math.sin(i*440/24000*Math.PI*2)),44+i*2);return buffer;
}
function pdf(){
 const text='BT /F1 20 Tf 30 180 Td (PUBLIC PAGE) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length '+text.length+' >>\nstream\n'+text+'\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((value,index)=>{offsets.push(Buffer.byteLength(out));out+=(index+1)+' 0 obj\n'+value+'\nendobj\n'});
 const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n';offsets.slice(1).forEach(offset=>{out+=String(offset).padStart(10,'0')+' 00000 n \n'});
 return Buffer.from(out+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
}
async function addFiles(page,files){
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),library(page).getByRole('button',{name:'Ajouter des fichiers'}).click()]);
 await chooser.setFiles(files);
 await library(page).locator('[data-status]').filter({hasText:/fichier\(s\) enregistré/}).waitFor();
}
async function present(page,title,publicTitle){
 await card(page,title).getByRole('button',{name:'Aperçu et présentation…',exact:true}).click();
 await library(page).locator('[data-preview]:not([hidden])').waitFor();
 assert.equal(await library(page).locator('[data-reveal]').isChecked(),false);
 if(publicTitle)await library(page).locator('[data-title]').fill(publicTitle);
 await library(page).locator('[data-reveal]').check();
 await library(page).getByRole('button',{name:'Présenter aux joueurs',exact:true}).click();
 await card(page,title).getByRole('button',{name:'Arrêter la présentation',exact:true}).waitFor();
}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 let gm;
 try{
  const fixtureHub=hub(),gc=await browser.newContext(),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true}),lc=await browser.newContext();
  await Promise.all([gc,pc,lc].map(context=>configure(context,fixtureHub,{sceneReady:true,inviteReadyDelay:200})));
  gm=await gc.newPage();const player=await pc.newPage(),errors=[];
  gm.on('pageerror',error=>errors.push(error.message));player.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator('.cell-title-txt').filter({hasText:'CELLULE_PRIVEE_781'}).waitFor();
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();
  await editor(player).locator('.cell-title-txt').filter({hasText:'Rapport montré'}).waitFor();
  await app(gm).evaluate(()=>window.ArchivesCatalogue.open());
  await editor(gm).getByRole('button',{name:'Documents et autres',exact:true}).click();
  await library(gm).locator('[data-status]').filter({hasText:'Ajoute un fichier'}).waitFor();
  assert.equal(await editor(player).locator('#catalogue-documents').count(),0);
  assert.equal(await app(player).evaluate(()=>!!window.ArchivesFileLibrary),false);
  debug('importing files');
  await addFiles(gm,[
   {name:'ENREGISTREMENT_PRIVE_466.wav',mimeType:'audio/wav',buffer:wav()},
   {name:'DOCUMENT_PRIVE_833.pdf',mimeType:'application/pdf',buffer:pdf()},
   {name:'TEXTE_PRIVE_427.txt',mimeType:'text/plain',buffer:Buffer.from('Un document privé, à révéler volontairement.')}
  ]);
  assert.equal(await library(gm).locator('article').count(),3);
  let wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['ENREGISTREMENT_PRIVE_466','DOCUMENT_PRIVE_833','TEXTE_PRIVE_427','CELLULE_PRIVEE_781','NOTE_PRIVEE_954'])assert.ok(!wire.includes(secret),'hidden library content: '+secret);
  assert.equal(await player.locator('[id="'+mediaId+'"]').count(),0);
  await card(gm,'ENREGISTREMENT_PRIVE_466').getByRole('button',{name:'Aperçu et présentation…',exact:true}).click();
  assert.equal(await library(gm).locator('[data-reveal]').isChecked(),false);
  await library(gm).getByRole('button',{name:'Garder privé',exact:true}).click();
  assert.equal(await player.locator('[id="'+mediaId+'"]').count(),0);
  await library(gm).getByRole('button',{name:'Fermer la bibliothèque de documents'}).click();
  // Linking a file to a private cell is itself kept entirely on the GM device.
  await app(gm).evaluate(()=>{window.DuneApp.getState().selectedId='secret';return window.ArchivesFileLibrary.openCell()});
  await library(gm).getByRole('button',{name:'Voir toute la bibliothèque',exact:true}).click();
  await card(gm,'ENREGISTREMENT_PRIVE_466').getByRole('button',{name:'Lier à cette cellule',exact:true}).click();
  await library(gm).locator('[data-status]').filter({hasText:'Document lié'}).waitFor();
  await library(gm).getByRole('button',{name:'Voir seulement les documents liés',exact:true}).click();
  assert.equal(await library(gm).locator('article').count(),1);
  // Read-only role cannot forge a private-library RPC, even with a known ID.
  const hiddenId=await card(gm,'ENREGISTREMENT_PRIVE_466').getAttribute('data-file-id');
  await app(player).evaluate(fileId=>{window.__libraryReplies=[];addEventListener('message',event=>{if(event.data?.type==='owl-file-result')window.__libraryReplies.push(event.data)});parent.postMessage({protocol:'archives:owlbear:v56',type:'owl-file-command',id:crypto.randomUUID(),command:{action:'get',fileId}},location.origin)},hiddenId);
  await library(gm).getByRole('button',{name:'Fermer la bibliothèque de documents'}).click();
  await gm.reload();await gm.locator('#archives-tool').click();
  await editor(gm).locator('.cell-title-txt').filter({hasText:'CELLULE_PRIVEE_781'}).waitFor();
  await app(gm).evaluate(()=>{window.DuneApp.getState().selectedId='secret';return window.ArchivesFileLibrary.openCell()});
  assert.equal(await library(gm).locator('article').count(),1,'linked original survives reload');
  assert.deepEqual(await app(player).evaluate(()=>window.__libraryReplies),[]);
  debug('presenting audio');
  await present(gm,'ENREGISTREMENT_PRIVE_466','Enregistrement montré');
  await viewer(player).locator('#play:not([disabled])').waitFor({timeout:20000});
  assert.equal(await viewer(player).locator('#title').textContent(),'Enregistrement montré');
  await player.screenshot({path:'/tmp/archives-media-player-v60.png'});
  assert.ok((await viewer(player).locator('audio').getAttribute('src')).startsWith('blob:'));
  assert.ok((await viewer(player).locator('audio').boundingBox()).width>=250,"audio controls remain visible on a tablet");
  await viewer(player).locator('#play').click();
  assert.equal(await mediaFrame(player).evaluate(()=>document.querySelector('audio').paused),false);
  // A late player receives only the active, explicitly released media.
  debug('late player');
  const late=await lc.newPage();late.on('pageerror',error=>errors.push(error.message));
  await late.goto(owl+'/room/one?joueur=Noa');
  await viewer(late).locator('#play:not([disabled])').waitFor({timeout:20000});
  assert.equal(await viewer(late).locator('#title').textContent(),'Enregistrement montré');
  wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));
  for(const secret of ['ENREGISTREMENT_PRIVE_466','DOCUMENT_PRIVE_833','TEXTE_PRIVE_427','CELLULE_PRIVEE_781','NOTE_PRIVEE_954'])assert.ok(!wire.includes(secret),'private metadata never broadcast: '+secret);
  let packets=await player.evaluate(()=>window.fixture.wire());
  const show=packets.find(packet=>packet.op==='broadcast'&&packet.value.channel===mediaChannel&&packet.value.data.type==='show').value.data;
  // Neither a player announcement nor a request for another private ID is honored.
  await player.evaluate(({channel,show})=>window.fixture.publish(channel,{...show,id:crypto.randomUUID(),title:'FORGED_PLAYER_MEDIA'}),{channel:mediaChannel,show});
  const before=packets.filter(packet=>packet.op==='broadcast'&&packet.value.data.type==='data').length;
  await player.evaluate(({channel,fileId})=>window.fixture.publish(channel,{type:'request',id:fileId,version:crypto.randomUUID(),to:'fixture-MJ'}),{channel:mediaChannel,fileId:hiddenId});
  assert.equal(await viewer(late).locator('#title').textContent(),'Enregistrement montré');
  assert.equal((await player.evaluate(()=>window.fixture.wire())).filter(packet=>packet.op==='broadcast'&&packet.value.data.type==='data').length,before);
  await library(gm).screenshot({path:'/tmp/archives-library-v60.png'});
  await card(gm,'ENREGISTREMENT_PRIVE_466').getByRole('button',{name:'Aperçu et présentation…',exact:true}).click();
  assert.equal(await library(gm).locator('[data-reveal]').isChecked(),false);
  await library(gm).getByRole('button',{name:'Arrêter la présentation',exact:true}).click();
  await player.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});await late.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});
  debug('PDF token');
  // Original PDF in the library can become a native round token.
  await library(gm).getByRole('button',{name:'Voir toute la bibliothèque',exact:true}).click();
  await card(gm,'DOCUMENT_PRIVE_833').getByRole('button',{name:'Aperçu et transfert…',exact:true}).click();
  const transfer=editor(gm).locator('#archives-owl-transfer');await transfer.locator('[data-submit]:not([disabled])').waitFor();
  await transfer.locator('[data-kind]').selectOption('TOKEN');
  await transfer.getByRole('button',{name:'Placer et révéler',exact:true}).click();
  await transfer.waitFor({state:'detached'});
  const item=(await gm.evaluate(()=>window.fixture.scene())).items[0];assert.equal(item.layer,'CHARACTER');assert.equal(item.image.width,2048);

  await app(gm).evaluate(()=>window.ArchivesFileLibrary.open());
  // Produce a real VP8 WebM in the browser, not a fake video placeholder.
  debug('recording video');
  const video=await app(gm).evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;const context=canvas.getContext('2d');const stream=canvas.captureStream(10);
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),parts=[];
   recorder.ondataavailable=event=>parts.push(event.data);
   const result=new Promise(resolve=>{recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());resolve(Array.from(new Uint8Array(await new Blob(parts,{type:'video/webm'}).arrayBuffer())))}});
   recorder.start();context.fillStyle='#3c1b78';context.fillRect(0,0,240,160);context.fillStyle='#ffe1a0';context.font='24px sans-serif';context.fillText('Film du MJ',30,80);setTimeout(()=>recorder.stop(),450);return result;
  });
  await addFiles(gm,[{name:'VIDEO_PRIVEE_662.webm',mimeType:'video/webm',buffer:Buffer.from(video)}]);
  await library(gm).locator('[data-kind]').selectOption('VIDEO');assert.equal(await library(gm).locator('article').count(),1);
  debug('presenting video');
  await present(gm,'VIDEO_PRIVEE_662','Film montré');
  await viewer(player).locator('#play:not([disabled])').waitFor({timeout:20000});
  assert.equal(await viewer(player).locator('video').count(),1);assert.equal(await viewer(player).locator('#title').textContent(),'Film montré');
  assert.ok((await viewer(player).locator('video').boundingBox()).width>=250,"video is legible on a tablet");
  await viewer(player).locator('#play').click();
  assert.ok((await mediaFrame(player).evaluate(()=>document.querySelector('video').videoWidth))>0);
  // A screen switch removes the media window and keeps the normal central invitation.
  await library(gm).getByRole('button',{name:'Fermer la bibliothèque de documents'}).click();
  await editor(gm).getByRole('button',{name:'Owlbear — afficher la carte'}).click();
  await player.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher la carte Owlbear',exact:true}).click();
  await player.locator('#viewer').waitFor({state:'detached'});
  // Revoking the MJ role closes the presentation and removes the private editor.
  await gm.locator('#archives-tool').click();
  await editor(gm).locator('.cell-title-txt').filter({hasText:'CELLULE_PRIVEE_781'}).waitFor();
  await app(gm).evaluate(()=>window.ArchivesFileLibrary.open());
  await present(gm,'ENREGISTREMENT_PRIVE_466','Dernière présentation');
  await viewer(player).locator('#play:not([disabled])').waitFor({timeout:20000});
  await gm.evaluate(()=>window.fixture.changeRole('PLAYER'));
  await player.locator('[id="'+mediaId+'"]').waitFor({state:'detached'});
  await gm.frameLocator('#viewer').locator('#app').waitFor({state:'hidden'});
  assert.equal(await gm.frameLocator('#viewer').locator('#app').getAttribute('src'),null);
  assert.equal(gc.pages().length,1);assert.equal(pc.pages().length,1);assert.equal(lc.pages().length,1);
  assert.deepEqual(errors,[]);
  console.log('Bibliothèque privée persistante, documents liés, PDF vers token, audio et vraie vidéo WebM, lecteur joueur tardif, arrêt et bascule, rejet des commandes joueur et aucune fuite des noms privés.');
 }catch(error){if(gm&&!gm.isClosed())await gm.screenshot({path:'/tmp/archives-v60-failure.png'}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
