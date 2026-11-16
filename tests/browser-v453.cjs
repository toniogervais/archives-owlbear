const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs'),{backend,initCloud}=require('./cloud-fixture.cjs');
const {media,frame,waitMedia,closeMedia}=require('./presented-image.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const until=async(fn,label)=>{for(let i=0;i<400;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30))}throw Error(label)};
async function openGM(p,scenario){await p.goto(owl+'/room/one');await p.locator('#archives-tool').click();const [chooser]=await Promise.all([p.waitForEvent('filechooser'),editor(p).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await app(p).waitForFunction(()=>DuneApp.getState().activeBoardId==='a')}
async function originalImages(browser){
 const base=hub(),drops=new Set(),requests=[];let count,publication;const fixture=async(args,op,value)=>{
  if(op==='broadcast'&&value.channel==='fr.archives-imaginaire.bridge/media-v60'){
   const d=value.data;if(d.type==='show'&&!d.to){publication=d.id;count=Math.ceil(d.size/9000)}
   if(d.type==='request')requests.push(d);
   if(d.type==='data'&&d.id===publication&&d.index>=Math.floor(count/4)&&d.index%4!==0&&!drops.has(d.index)){drops.add(d.index);return}
  }
  return base(args,op,value);
 };
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:820,height:1180}}),browser.newContext({viewport:{width:820,height:1180}})]);
 for(const c of contexts)await configure(c,fixture,{sceneReady:true,directFiles:false});const [g,p,q]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];for(const page of [g,p,q]){page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message))}
 try{
  await openGM(g,{activeBoardId:'a',boards:[{id:'a',nodes:[],links:[]}]});await p.goto(owl+'/room/one?joueur=Alix');await q.goto(owl+'/room/one?joueur=Noa');
  const data=await g.evaluate(()=>{const c=document.createElement('canvas');c.width=4096;c.height=2048;const x=c.getContext('2d'),image=x.createImageData(c.width,c.height);let seed=753;for(let i=0;i<image.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;image.data[i]=seed&255;image.data[i+1]=(seed>>>8)&255;image.data[i+2]=(seed>>>16)&255;image.data[i+3]=255}x.putImageData(image,0,0);x.fillStyle='#31a165';x.fillRect(1900,900,300,300);return c.toDataURL('image/jpeg',.98)});
  assert.ok(Buffer.from(data.split(',')[1],'base64').length>6*1024*1024,'the original exceeds the previous forced downsizing threshold');
  assert.equal(await app(g).evaluate(data=>ArchivesPlayerImage.show({data}),data),true);
  await waitMedia(p,data);await waitMedia(q,data);
  for(const player of [p,q])assert.deepEqual(await media(player).locator('img').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[4096,2048]);
  assert.ok(drops.size>100);assert.ok(requests.every(r=>Array.isArray(r.missing)&&r.missing.length<=16));assert.ok(requests.length>count/16*2,'missing chunks were requested again');
  await p.screenshot({path:'/tmp/archives-v453-original-resolution.png'});await closeMedia(p);await closeMedia(q);assert.deepEqual(errors,[]);
  console.log('V4.53: two players receive the exact 4096x2048 JPEG original above 6 MiB despite sustained loss after 25%; no resizing or re-encoding, selective missing-chunk recovery and visible pixels verified.');
 }catch(e){console.log('TRANSFER',JSON.stringify({drops:drops.size,requests:requests.length,last:requests.slice(-3).map(r=>({missing:r.missing,round:r.round}))}));await p.screenshot({path:'/tmp/archives-v453-transfer-failure.png'}).catch(()=>{});throw e}
 finally{for(const c of contexts)await c.close()}
}
async function descriptions(browser){
 const fixture=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext();for(const c of [gc,pc])await configure(c,fixture,{sceneReady:true});const gm=await gc.newPage(),player=await pc.newPage(),errors=[];for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
 try{
  const kinds=['personnage','groupe','lieu','objet','ressource','evenement'],nodes=kinds.map((category,i)=>({id:'n'+i,title:'Cellule '+i,category,desc:'Description générale publique '+i,revealed:true,x:100+i*300,y:120,w:250,h:180,clues:[]}));
  await openGM(gm,{activeBoardId:'a',boards:[{id:'a',nodes,links:[]}]});await player.goto(owl+'/room/one?joueur=Alix');await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(player).locator('.node-cell[data-id="n0"]').waitFor();
  for(let i=0;i<kinds.length;i++){
   await app(gm).evaluate(id=>{DuneApp.getState().selectedId=id;DuneApp.openActiveEditor()},'n'+i);
   await editor(gm).getByRole('textbox',{name:'Description MJ — privée',exact:true}).fill('DESCRIPTION_MJ_SECRETE_453_'+i);
   await app(gm).evaluate(()=>DuneApp.closeActiveEditor());await app(gm).evaluate(id=>ArchivesCellBrief.open(id),'n'+i);
   const brief=editor(gm).locator('#archives-cell-brief[open]');assert.equal(await brief.locator('.brief-gm-description').textContent(),'DESCRIPTION_MJ_SECRETE_453_'+i);assert.equal(await brief.locator('.brief-description').textContent(),'Description générale publique '+i);
   await brief.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();await brief.waitFor({state:'hidden'});
  }
  await app(gm).evaluate(()=>ArchivesCellReserve.open());await editor(gm).getByRole('button',{name:'Nouvelle cellule',exact:true}).click();const form=editor(gm).locator('#archives-reserve-editor[open]');await form.getByLabel('Nom de la cellule',{exact:true}).fill('Modèle privé');await form.getByLabel('Description générale',{exact:true}).fill('Description du modèle');await form.getByLabel('Description MJ — privée',{exact:true}).fill('DESCRIPTION_MJ_RESERVE_453');await form.getByRole('button',{name:'Enregistrer dans la réserve',exact:true}).click();await form.waitFor({state:'hidden'});
  const card=editor(gm).locator('#archives-reserve-grid article').filter({hasText:'Modèle privé'});await card.getByRole('button',{name:'Ajouter à l’acte',exact:true}).click();assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.at(-1).gmDescription),'DESCRIPTION_MJ_RESERVE_453');
  const wire=JSON.stringify(await player.evaluate(()=>fixture.wire()));assert.ok(!wire.includes('DESCRIPTION_MJ_SECRETE_453'));assert.ok(!wire.includes('DESCRIPTION_MJ_RESERVE_453'));assert.ok(!(await editor(gm).locator('#nodes-layer').innerText()).includes('DESCRIPTION_MJ_SECRETE_453'));assert.ok(!(await editor(player).locator('body').innerText()).includes('DESCRIPTION_MJ_SECRETE_453'));
  await gm.reload();await gm.locator('#archives-tool').click();await editor(gm).locator('.node-cell[data-id="n0"]').waitFor();assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes[0].gmDescription),'DESCRIPTION_MJ_SECRETE_453_0');assert.deepEqual(errors,[]);
  console.log('V4.53: dedicated GM description for all six cell types and reserve; persistence, separate GM brief and general text, no canvas or player disclosure.');
 }catch(e){await gm.screenshot({path:'/tmp/archives-v453-description-failure.png'}).catch(()=>{});throw e}
 finally{await gc.close();await pc.close()}
}
async function backupChoice(browser){
 const cloud=backend(),c=await browser.newContext({viewport:{width:1440,height:1000}});await configure(c,hub(),{sceneReady:true});await c.exposeBinding('cloudFixture',cloud.receive);await c.addInitScript(initCloud);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const backup=()=>editor(p).locator('#archives-campaign-backup'),online=()=>backup().locator('#archives-online-backups');
 async function reopen(){await new Promise(r=>setTimeout(r,300));await p.reload();await p.locator('#archives-tool').click();await editor(p).locator('.node-cell[data-id="n"]').waitFor();await editor(p).locator('#archives-autosave-choice').waitFor()}
 try{
  await openGM(p,{activeBoardId:'a',boards:[{id:'a',nodes:[{id:'n',title:'Campagne',desc:'Texte',revealed:false,category:'lieu',x:100,y:100,w:250,h:180,clues:[]}],links:[]}]});await editor(p).locator('#canvas-save-icon').click();await online().getByLabel('Nom de la nouvelle campagne en ligne').fill('Choix à l’ouverture');await online().getByRole('button',{name:'Sauvegarder dans une nouvelle campagne',exact:true}).click();await until(()=>cloud.versions.length===1,'manual first checkpoint');
  await backup().locator('header button').click();await app(p).evaluate(()=>DuneApp.setGmDescription('n','MODIFICATION_MANUELLE_453'));await new Promise(r=>setTimeout(r,1300));assert.equal(cloud.versions.length,1,'creation does not silently enable autosave');
  await reopen();const before=cloud.versions.length;await app(p).evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'))});await new Promise(r=>setTimeout(r,1300));assert.equal(cloud.versions.length,before,'opening and reconnecting never upload before a choice');
  await editor(p).getByRole('button',{name:'Rester en sauvegarde manuelle',exact:true}).click();await editor(p).locator('#canvas-save-icon').click();await online().getByRole('button',{name:'Enregistrer maintenant',exact:true}).click();await until(()=>cloud.versions.length===before+1,'explicit manual save');await backup().locator('header button').click();
  await reopen();const next=cloud.versions.length;await editor(p).getByRole('button',{name:'Activer pour cette ouverture',exact:true}).click();await editor(p).locator('#archives-autosave-choice').waitFor({state:'detached'});await app(p).evaluate(()=>DuneApp.setGmDescription('n','AUTOMATIQUE_CHOISIE_453'));await until(()=>cloud.versions.length===next+1,'autosave only after explicit consent');
  await reopen();const last=cloud.versions.length;await new Promise(r=>setTimeout(r,1300));assert.equal(cloud.versions.length,last,'the next opening asks again and does not resume automatically');await p.screenshot({path:'/tmp/archives-v453-autosave-choice.png'});
  await editor(p).getByRole('button',{name:'Rester en sauvegarde manuelle',exact:true}).click();await editor(p).locator('#canvas-save-icon').click();
  await online().locator('[data-backup-id="'+cloud.versions[0].id+'"]').getByRole('button',{name:'Ouvrir cette version…',exact:true}).click();await backup().getByRole('button',{name:'Restaurer cette campagne',exact:true}).click();await backup().waitFor({state:'detached'});assert.equal(cloud.versions.length,last,'opening an older version remains read-only in the cloud');
  await editor(p).locator('#canvas-save-icon').click();await online().getByRole('button',{name:'Enregistrer maintenant',exact:true}).click();await until(()=>cloud.versions.length===last+1,'explicitly save restored older contents as a new head');await backup().locator('header button').click();
  await reopen();const finalCount=cloud.versions.length;await app(p).evaluate(()=>DuneApp.startNewScenario(false));await editor(p).locator('#archives-autosave-choice').waitFor({state:'detached'});assert.equal(cloud.versions.length,finalCount,'a new scenario cannot resume the previous campaign prompt');assert.deepEqual(errors,[]);
  console.log('V4.53: manual-first creation, no upload on reopen/focus/reconnect without consent, explicit manual saving, opt-in for one opening and repeated choice on next opening verified.');
 }catch(e){await p.screenshot({path:'/tmp/archives-v453-backup-failure.png'}).catch(()=>{});throw e}
 finally{await c.close()}
}
(async()=>{const b=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await originalImages(b);await descriptions(b);await backupChoice(b)}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
