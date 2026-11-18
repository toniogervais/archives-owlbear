const assert=require('node:assert/strict'),{chromium}=require('playwright'),{archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const {media,surface,frame,waitMedia,closeMedia}=require('./presented-image.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const until=async(fn,label)=>{for(let i=0;i<400;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30))}throw Error(label)};
const board={activeBoardId:'a',boards:[{id:'a',name:'SECRET_ACTE_452',nodes:[],links:[]}]};
async function openGM(gm){await gm.goto(owl+'/room/one');await gm.locator('#archives-tool').click();const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(board))});await app(gm).waitForFunction(()=>DuneApp.getState().activeBoardId==='a')}
async function transfer(browser){
 const base=hub(),shows=[],requests=[];let paused=false,unblock,blockedId,dropId,dropped=false;
 const fixture=async(args,op,value)=>{
  if(op==='broadcast'&&value.channel==='fr.archives-imaginaire.bridge/media-v60'){
   const d=value.data;if(d.type==='show'&&!d.to&&!shows.includes(d.id))shows.push(d.id);if(d.type==='request')requests.push(d.id);
   if(d.type==='data'&&d.id===shows[1]&&d.index===1&&!paused){paused=true;blockedId=d.id;await new Promise(r=>unblock=r)}
   if(d.type==='data'&&d.id===dropId&&d.index===0&&!dropped){dropped=true;return}
  }
  return base(args,op,value);
 };
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:820,height:1180}}),browser.newContext({viewport:{width:820,height:1180}})]);
 for(const c of contexts){await configure(c,fixture,{sceneReady:true,directFiles:false});await c.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>original(fn,delay===20000?2500:delay,...args)})}
 const [gc,pc,qc]=contexts,gm=await gc.newPage(),p=await pc.newPage(),q=await qc.newPage(),errors=[];for(const page of [gm,p,q]){page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message))}
 try{
  await openGM(gm);await p.goto(owl+'/room/one?joueur=Alix');await q.goto(owl+'/room/one?joueur=Noa');
  // Les pages ont charge, mais les extensions peuvent encore installer leur
  // abonnement au canal. Attendre les signaux 'active' des deux joueurs.
  await until(async()=>{
    const entries=await gm.evaluate(()=>window.fixture.wire());
    return entries.filter(e=>e.op==='broadcast'&&e.value.channel==='fr.archives-imaginaire.bridge/media-v60'&&e.value.data?.type==='active').length>=2;
  },'deux lecteurs Owlbear actifs');
  const data=await gm.evaluate(()=>['#d94331','#335bdb','#39b780'].map((color,i)=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');if(i){let seed=i+31;const image=x.createImageData(c.width,c.height);for(let k=0;k<image.data.length;k+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;image.data[k]=seed&255;image.data[k+1]=(seed>>>8)&255;image.data[k+2]=(seed>>>16)&255;image.data[k+3]=255}x.putImageData(image,0,0)}x.fillStyle=color;x.fillRect(i?350:0,i?200:0,i?200:c.width,i?200:c.height);return c.toDataURL()}));
  assert.ok(data[1].length>1000000,'the transfer test uses a detailed photo-sized image');
  const show=async source=>{const result=await app(gm).evaluate(data=>ArchivesPlayerImage.show({data}),source);assert.equal(result,true,'la publication doit etre confirmee par les Archives MJ');};
  await show(data[0]);await waitMedia(p,data[0]);await waitMedia(q,data[0]);
  await show(data[1]);await until(()=>blockedId===shows[1],'second photo is still downloading');
  await show(data[2]);await until(()=>requests.filter(id=>id===shows[2]).length===2,'both players requested the third photo while the second was blocked');
  await frame(p).waitForFunction(()=>document.querySelector('#media img')===null);unblock();
  await waitMedia(p,data[2]);await waitMedia(q,data[2]);
  // Lose the first data packet once. Each player must recover automatically.
  const before=shows.length;const pending=show(data[0]);await until(()=>shows.length>before,'next publication');dropId=shows.at(-1);await pending;
  await until(()=>dropped,'one packet lost');await waitMedia(p,data[0]);await waitMedia(q,data[0]);assert.ok(requests.filter(id=>id===dropId).length>=3,'an automatic retry was sent without a player clicking Retry');
  await p.screenshot({path:'/tmp/archives-v452-photo-recovered.png'});await closeMedia(p);await show(data[1]);await waitMedia(p,data[1]);await waitMedia(q,data[1]);
  await closeMedia(p);await closeMedia(q);assert.deepEqual(errors,[]);console.log('V4.52: two players, detailed megabyte images, switching while a previous chunk is blocked, recovery after packet loss, close/reopen, exact received bytes and painted pixels passed.');
 }catch(e){await p.screenshot({path:'/tmp/archives-v452-transfer-failure.png'}).catch(()=>{});throw e}
 finally{unblock?.();for(const c of contexts)await c.close()}
}
async function reserve(browser){
 const fixture=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext();for(const c of [gc,pc])await configure(c,fixture,{sceneReady:true});
 const gm=await gc.newPage(),player=await pc.newPage(),errors=[];for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
 try{
  await openGM(gm);await player.goto(owl+'/room/one?joueur=Alix');await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('#world').waitFor({state:'attached'});
  const original=await gm.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=200;const x=c.getContext('2d');x.fillStyle='#26ab65';x.fillRect(0,0,160,200);return c.toDataURL()});
  const open=async()=>{await app(gm).evaluate(()=>ArchivesCellReserve.open());await editor(gm).locator('#archives-reserve-grid').waitFor()};await open();
  for(const [i,category]of ['lieu','objet','evenement'].entries()){
   await editor(gm).getByRole('button',{name:'Nouvelle cellule',exact:true}).click();const form=editor(gm).locator('#archives-reserve-editor[open]');await form.getByLabel('Nom de la cellule',{exact:true}).fill('RESERVE_PRIVEE_452_'+i);await form.getByLabel('Type de cellule',{exact:true}).selectOption(category);await form.getByLabel('Description générale',{exact:true}).fill('DESCRIPTION_PRIVEE_452');
   if(!i){await form.locator('#archives-reserve-image-file').setInputFiles({name:'image.png',mimeType:'image/png',buffer:Buffer.from(original.split(',')[1],'base64')});await form.getByRole('button',{name:'Ajouter un indice',exact:true}).click();await form.getByLabel('Texte de l’indice').fill('INDICE_PRIVE_452');await form.getByRole('button',{name:'Nouvelle catégorie MJ',exact:true}).click();await form.getByLabel('Nom de la catégorie MJ').fill('VOIX_PRIVEE_452');await form.getByLabel('Informations réservées au MJ').fill('NOTE_PRIVEE_452')}
   await form.getByRole('button',{name:'Enregistrer dans la réserve',exact:true}).click();await form.waitFor({state:'hidden'});await until(()=>editor(gm).locator('#archives-reserve-grid article').count().then(n=>n===i+1),'reserve saved');assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.length),0);
  }
  await gm.reload();await gm.locator('#archives-tool').click();await editor(gm).locator('#world').waitFor({state:'attached'});await app(gm).waitForFunction(()=>window.ArchivesCellReserve&&window.ArchivesCampaignScope);await open();await until(()=>editor(gm).locator('#archives-reserve-grid article').count().then(n=>n===3),'reserve survives reload');
  const card=editor(gm).locator('#archives-reserve-grid article').filter({hasText:'RESERVE_PRIVEE_452_0'});await card.getByRole('button',{name:'Modifier',exact:true}).click();const form=editor(gm).locator('#archives-reserve-editor[open]');assert.equal(await form.getByLabel('Texte de l’indice').inputValue(),'INDICE_PRIVE_452');assert.equal(await form.locator('.reserve-preview').getAttribute('src'),original);await form.getByLabel('Description générale',{exact:true}).fill('DESCRIPTION_PRIVEE_452_MODIFIEE');await form.getByRole('button',{name:'Enregistrer dans la réserve',exact:true}).click();await form.waitFor({state:'hidden'});
  await card.getByRole('button',{name:'Ajouter à l’acte',exact:true}).click();await card.getByRole('button',{name:'Ajouter à l’acte',exact:true}).click();const nodes=await app(gm).evaluate(()=>DuneApp.getState().nodes);assert.equal(nodes.length,2);assert.ok(nodes.every(n=>!n.revealed&&!n.clues[0].revealed));assert.notEqual(nodes[0].id,nodes[1].id);assert.notEqual(nodes[0].clues[0].id,nodes[1].clues[0].id);assert.equal(nodes[0].bgImg,original);assert.equal(nodes[0].gmDetails[0].text,'NOTE_PRIVEE_452');
  const backup=await app(gm).evaluate(async()=>{const {campaignRequest}=await import('./src/v71/campaign-io.mjs');const out=await campaignRequest({action:'export',snapshot:ArchivesRelay.snapshot()});return [...new Uint8Array(await out.blob.arrayBuffer())]});
  const {inspectBackup}=await import('../src/v63/backup.mjs'),decoded=await inspectBackup(new Blob([Uint8Array.from(backup)]));assert.equal(decoded.summary.reserve,3);assert.equal(decoded.scenario.cellReserve.find(r=>r.node.title==='RESERVE_PRIVEE_452_0').node.bgImg,original);
  const other=await browser.newContext({viewport:{width:1280,height:960}});await configure(other,hub(),{sceneReady:true});const restored=await other.newPage();
  try{
   await openGM(restored);await app(restored).waitForFunction(()=>window.ArchivesCellReserve&&window.ArchivesCampaignScope);
   await app(restored).evaluate(async bytes=>{const {campaignRequest}=await import('./src/v71/campaign-io.mjs');const incoming=await campaignRequest({action:'inspect',file:new Blob([Uint8Array.from(bytes)])});await campaignRequest({action:'restore',token:incoming.token,previous:ArchivesRelay.snapshot()})},backup);
   await app(restored).evaluate(()=>ArchivesCellReserve.open());await until(()=>editor(restored).locator('#archives-reserve-grid article').count().then(n=>n===3),'a fresh device restores the reserve from the full backup');
   assert.equal(await app(restored).evaluate(()=>DuneApp.getState().nodes.length),2);assert.equal(await editor(restored).locator('#archives-reserve-grid article img').first().getAttribute('src'),original);
  }finally{await other.close()}
  await card.getByRole('button',{name:'Supprimer',exact:true}).click();await editor(gm).locator('#archives-reserve-delete[open]').getByRole('button',{name:'Supprimer cette cellule',exact:true}).click();await until(()=>editor(gm).locator('#archives-reserve-grid article').count().then(n=>n===2),'reserve deletion');assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.length),2);
  const wire=JSON.stringify(await player.evaluate(()=>fixture.wire()));for(const secret of ['RESERVE_PRIVEE_452','DESCRIPTION_PRIVEE_452','INDICE_PRIVE_452','VOIX_PRIVEE_452','NOTE_PRIVEE_452'])assert.ok(!wire.includes(secret),'reserve leak: '+secret);
  await gm.screenshot({path:'/tmp/archives-v452-reserve.png'});assert.deepEqual(errors,[]);console.log('V4.52 reserve: prepare place/object/event off canvas, original image, private clues and GM categories, reload persistence, edit, repeated hidden insertion with new IDs, delete without deleting instances, full backup inclusion and player privacy passed.');
 }catch(e){await gm.screenshot({path:'/tmp/archives-v452-reserve-failure.png'}).catch(()=>{});throw e}
 finally{await gc.close();await pc.close()}
}
(async()=>{const b=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await transfer(b);await reserve(b)}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
