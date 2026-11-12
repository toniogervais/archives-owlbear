const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app');
const app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const cell=(p,id)=>editor(p).locator('.node-cell[data-id="'+id+'"]');
const summaries=(p,id)=>cell(p,id).locator('.clue-item-line');
const until=async(fn,message)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(message)};
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  const fixtureHub=hub(),gc=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});
  for(const context of [gc,pc])await configure(context,fixtureHub,{sceneReady:true});
  const gm=await gc.newPage(),player=await pc.newPage(),errors=[];
  for(const page of [gm,player])page.on('pageerror',error=>errors.push(error.message));
  await gm.goto(owl+'/room/one');await player.goto(owl+'/room/one?joueur=Alix');await gm.locator('#archives-tool').click();
  const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const clues=[{id:'latest',text:'Révélé en dernier',revealed:true,revOrder:40},{id:'secret-one',text:'SECRET_PRIVE_445_1',revealed:false},{id:'oldest',text:'Révélé en premier',revealed:true,revOrder:10},{id:'previous',text:'Avant-dernier découvert '+('texte long '.repeat(200)),revealed:true,revOrder:30},{id:'secret-two',text:'SECRET_PRIVE_445_2',revealed:false},{id:'second',text:'Deuxième découvert',revealed:true,revOrder:20},{id:'secret-three',text:'SECRET_PRIVE_445_3',revealed:false}];
  const base={category:'personnage',x:180,y:160,w:260,h:200,revealed:true,bgImg:picture};
  const scenario={activeBoardId:'act',nextRevCounter:41,boards:[{id:'act',name:'Acte',links:[],nodes:[{...base,id:'mixed',title:'Portrait et secrets',clues},{...base,id:'unrevealed',title:'Secrets à découvrir',x:530,clues:clues.filter(c=>!c.revealed)},{...base,id:'legacy',title:'Ancienne campagne',y:480,clues:[1,2,3,4].map(i=>({id:'legacy-'+i,text:'Ancien indice '+i,revealed:true}))}]}]};
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario'}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await cell(gm,'mixed').waitFor();
  const text=async id=>(await summaries(gm,id).allTextContents()).map(s=>s.replace(/^[▪🔒\s]+/u,''));
  assert.deepEqual(await text('mixed'),[clues[3].text,clues[0].text],'use actual reveal chronology, not array order');
  assert.deepEqual(await text('unrevealed'),['SECRET_PRIVE_445_1','SECRET_PRIVE_445_2']);
  assert.deepEqual(await text('legacy'),['Ancien indice 3','Ancien indice 4']);
  const geometry=await cell(gm,'mixed').evaluate(node=>{const list=node.querySelector('.clues-render-list'),row=list.firstElementChild;return {height:node.offsetHeight,listHeight:list.offsetHeight,rowHeight:row.offsetHeight,lineHeight:parseFloat(getComputedStyle(row).lineHeight),image:!!node.querySelector('.cell-bg-img-layer'),title:row.title}});
  assert.ok(geometry.image&&geometry.listHeight<75&&geometry.rowHeight<=geometry.lineHeight*2+6,'long secrets must remain short excerpts over the portrait');assert.equal(geometry.title,clues[3].text);assert.ok(geometry.height<=205);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='mixed').clues.length),7,'summaries never truncate saved clues');
  await app(gm).evaluate(()=>ArchivesCellBrief.open('mixed'));assert.equal(await editor(gm).locator('#archives-cell-brief .brief-clue-row').count(),7);await editor(gm).getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();
  // Discovering an earlier array entry makes it the newest summary; hiding restores the previous pair.
  await app(gm).evaluate(()=>DuneApp.setBriefClueRevealed('mixed','secret-two',true));assert.deepEqual(await text('mixed'),[clues[0].text,'SECRET_PRIVE_445_2']);
  await app(gm).evaluate(()=>DuneApp.setBriefClueRevealed('mixed','secret-two',false));assert.deepEqual(await text('mixed'),[clues[3].text,clues[0].text]);
  await player.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).tap();await cell(player,'mixed').waitFor();
  assert.equal(await editor(player).locator('#nodes-layer .clues-render-list').count(),0,'player cells contain no secret summaries');
  await player.bringToFront();await cell(player,'mixed').dblclick();
  await editor(player).locator('#player-cell-detail.open').waitFor();assert.equal(await editor(player).locator('#pcd-revelations .pcd-item').count(),4);await app(player).evaluate(()=>DuneApp.closePlayerCellDetail());
  await cell(player,'mixed').tap();await cell(player,'mixed').tap();await editor(player).locator('#player-cell-detail.open').waitFor({timeout:4000});assert.equal(await editor(player).locator('#pcd-revelations .pcd-item').count(),4);
  await until(()=>app(player).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='mixed').clues.length===4),'all revealed clues remain available');
  const wire=JSON.stringify(await player.evaluate(()=>window.fixture.wire()));for(const secret of ['SECRET_PRIVE_445_1','SECRET_PRIVE_445_3'])assert.ok(!wire.includes(secret));
  assert.deepEqual(errors,[]);console.log('V4.45: latest two GM revelations or first two secrets, bounded excerpts, full MJ/player details and double-tap retained; player canvas has no clue text.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
