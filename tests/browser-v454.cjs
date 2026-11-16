const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const {media,waitMedia,closeMedia}=require('./presented-image.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-editor=1/.test(f.url()));
async function openGM(p,nodes=[]){
 await p.goto(owl+'/room/one');await p.locator('#archives-tool').click();
 const [chooser]=await Promise.all([p.waitForEvent('filechooser'),editor(p).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);
 await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({activeBoardId:'a',boards:[{id:'a',name:'ACTE_PRIVE_454',nodes,links:[]}]}))});
 await app(p).waitForFunction(()=>DuneApp.getState().activeBoardId==='a');
}
async function briefs(browser){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await configure(context,hub(),{sceneReady:true});const gm=await context.newPage(),errors=[];gm.on('pageerror',e=>errors.push(e.message));
 const paragraph='Le témoin parle lentement. Il observe les portes et garde son manteau près de lui. Une odeur de pluie accompagne ses gestes. ';
 const nodes=[
  {id:'n',title:'Témoin sans secret',category:'personnage',desc:paragraph.repeat(10),gmDescription:paragraph.repeat(9),gmDetails:[{title:'Interprétation',text:paragraph.repeat(2)}],clues:[]},
  {id:'secrets',title:'Témoin et révélations',category:'personnage',desc:paragraph.repeat(3),gmDescription:paragraph.repeat(3),clues:Array.from({length:6},(_,i)=>({id:'c'+i,text:'Secret '+i+' : '+paragraph,revealed:false}))},
  ...Array.from({length:3},(_,i)=>({id:'extra'+i,title:'Fiche '+i,category:'lieu',desc:paragraph,gmDescription:paragraph,clues:[{id:'e'+i,text:'Un indice bref, gardé secret.',revealed:false}]}))
 ].map((n,i)=>({...n,x:i*300,y:100,w:250,h:180,revealed:false}));
 try{
  await openGM(gm,nodes);await app(gm).evaluate(()=>ArchivesCellBrief.open('n'));
  const dialog=editor(gm).locator('#archives-cell-brief[open]');await dialog.locator('.brief-description').waitFor();
  await app(gm).waitForFunction(()=>{const d=document.querySelector('.brief-desc');return d.clientHeight>0&&d.scrollHeight<=d.clientHeight+3});
  assert.equal(await dialog.locator('.brief-clues').isVisible(),false,'empty clues must not take half the description space');
  assert.equal(await dialog.locator('.brief-gm-description').textContent(),nodes[0].gmDescription);
  await gm.screenshot({path:'/tmp/archives-v454-fiche-sans-secret.png'});
  await dialog.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();await app(gm).evaluate(()=>ArchivesCellBrief.open('secrets'));
  await app(gm).waitForFunction(()=>['.brief-desc','.brief-clue-list'].every(s=>{const e=document.querySelector(s);return e.clientHeight>0&&e.scrollHeight<=e.clientHeight+3}));
  const before=await dialog.boundingBox(),handle=dialog.getByRole('button',{name:'Redimensionner les fiches MJ',exact:true});await handle.focus();await handle.press('ArrowLeft');await handle.press('ArrowUp');
  await app(gm).waitForFunction(({width,height})=>{const d=document.querySelector('#archives-cell-brief');return d.offsetWidth<width&&d.offsetHeight<height},before);
  const grip=await handle.boundingBox();await gm.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await gm.mouse.down();await gm.mouse.move(grip.x-75,grip.y-45,{steps:8});await gm.mouse.up();
  const smaller=await dialog.boundingBox();assert.ok(smaller.width<before.width-80&&smaller.height<before.height-40,'the visible handle resizes the actual window');
  await dialog.getByRole('button',{name:'Ajuster les fiches au contenu',exact:true}).click();
  await app(gm).waitForFunction(()=>['.brief-desc','.brief-clue-list'].every(s=>{const e=document.querySelector(s);return e.clientHeight>0&&e.scrollHeight<=e.clientHeight+3}));
  await gm.screenshot({path:'/tmp/archives-v454-fiche-secrets.png'});
  for(let i=0;i<3;i++)await app(gm).evaluate(id=>ArchivesCellBrief.open(id),'extra'+i);
  assert.equal(await dialog.locator('.brief-card').count(),4);assert.equal(await dialog.locator('.brief-clue-checkbox').count(),9);
  await gm.screenshot({path:'/tmp/archives-v454-quatre-fiches.png'});
  await dialog.getByRole('button',{name:'Fermer les fiches MJ',exact:true}).click();await gm.setViewportSize({width:1280,height:720});await app(gm).evaluate(()=>ArchivesCellBrief.open('secrets'));
  await app(gm).waitForFunction(()=>{const e=document.querySelector('#archives-cell-brief'),r=e.getBoundingClientRect();return r.width>0&&r.bottom<=innerHeight&&r.right<=innerWidth});
  const font=await dialog.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(font>=12&&font<=14,'the adjusted type remains readable');
  await gm.screenshot({path:'/tmp/archives-v454-fiche-petit-ecran.png'});assert.deepEqual(errors,[]);
  console.log('V4.54 fiches: no empty secret area, complete general/private descriptions, six visible clues, automatic readable type, mouse/keyboard resize, refit, four cards and 720p viewport verified.');
 }catch(e){await gm.screenshot({path:'/tmp/archives-v454-fiche-failure.png'}).catch(()=>{});throw e}finally{await context.close()}
}
async function originals(browser){
 const base=hub();let dropped=0,offers=0,answers=0;
 const fixture=async(args,op,value)=>{
  if(op==='broadcast'&&value.channel==='fr.archives-imaginaire.bridge/media-v60'){
   if(value.data.type==='data'){dropped++;return} // File bytes cannot use the Owlbear relay in this journey.
   if(value.data.type==='direct-offer')offers++;if(value.data.type==='direct-answer')answers++;
  }return base(args,op,value);
 };
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:820,height:1180}}),browser.newContext({viewport:{width:820,height:1180}})]);
 for(const [i,c]of contexts.entries()){
  await configure(c,fixture,{sceneReady:true});
  await c.addInitScript(({cut})=>{
   const Original=window.RTCPeerConnection;window.__directBytes=0;window.__directCuts=0;
   window.RTCPeerConnection=function(config){
    const pc=new Original({...config,iceServers:[]});
    function instrument(channel){channel.addEventListener('message',event=>{let d;try{d=JSON.parse(event.data)}catch{return}if(d.type==='data'){window.__directBytes+=d.chunk.length*3/4;if(cut&&!window.__directCuts&&window.__directBytes>6*1024*1024){window.__directCuts++;channel.close()}}})}
    const create=pc.createDataChannel.bind(pc);pc.createDataChannel=(...args)=>{const channel=create(...args);instrument(channel);return channel};pc.addEventListener('datachannel',event=>instrument(event.channel));return pc;
   };
  },{cut:i===1});
 }
 const [gm,p,q]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];for(const page of [gm,p,q]){page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message))}
 try{
  await openGM(gm,[{id:'hidden',title:'SOURCE_PRIVEE_454',category:'lieu',desc:'DESCRIPTION_PRIVEE_454',gmDescription:'SECRET_MJ_454',revealed:false,x:100,y:100,w:250,h:180,clues:[]}]);await p.goto(owl+'/room/one?joueur=Alix');await q.goto(owl+'/room/one?joueur=Noa');
  const original=await gm.evaluate(()=>{
   const c=document.createElement('canvas');c.width=6144;c.height=3072;const x=c.getContext('2d'),pixels=x.createImageData(c.width,c.height);let seed=173;
   for(let i=0;i<pixels.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255}x.putImageData(pixels,0,0);x.fillStyle='#35aa75';x.fillRect(2900,1400,400,300);
   for(const quality of [.99,.98,.97,.96,.95,.94]){const data=c.toDataURL('image/jpeg',quality),size=atob(data.split(',')[1]).length;if(size<=25*1024*1024&&size>18*1024*1024)return {data,size}}
   throw Error('No original between 18 and 25 MiB generated');
  });
  assert.ok(original.size>18*1024*1024&&original.size<=25*1024*1024);
  assert.equal(await app(gm).evaluate(async data=>{DuneApp.getState().nodes[0].bgImg=data;return ArchivesPresentation.presentCell('hidden')},original.data),true);
  await waitMedia(p,original.data);await waitMedia(q,original.data);
  for(const player of [p,q])assert.deepEqual(await media(player).locator('img').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[6144,3072]);
  const pb=p.frames().find(f=>f.url().includes('background-v55.html'));assert.equal(await pb.evaluate(()=>window.__directCuts),1,'the direct connection was interrupted after more than 6 MiB');
  assert.ok(offers>=3&&answers>=3,'the partial file reconnects and resumes, including a second player');
  const second=await gm.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');x.fillStyle='#d74d32';x.fillRect(0,0,300,200);return c.toDataURL()});
  await app(gm).evaluate(data=>ArchivesPlayerImage.show({data}),second);await waitMedia(p,second);await waitMedia(q,second);
  await closeMedia(p);await app(gm).evaluate(()=>ArchivesPresentation.presentCell('hidden'));await waitMedia(p,original.data);await waitMedia(q,original.data);
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes[0].revealed),false);const wire=JSON.stringify(await gm.evaluate(()=>fixture.wire()));for(const secret of ['SOURCE_PRIVEE_454','DESCRIPTION_PRIVEE_454','SECRET_MJ_454'])assert.ok(!wire.includes(secret));
  await p.screenshot({path:'/tmp/archives-v454-original-joueur.png'});await closeMedia(p);await closeMedia(q);assert.deepEqual(errors,[]);
  console.log('V4.54 original:',JSON.stringify({bytes:original.size,dimensions:[6144,3072],players:2,droppedRelayPackets:dropped,offers,answers}),'exact original and painted pixels, direct reconnect after 6 MiB without restarting, hidden source, different picture and close/reopen passed.');
 }catch(e){console.log('DIRECT',JSON.stringify({dropped,offers,answers}));await p.screenshot({path:'/tmp/archives-v454-direct-failure.png'}).catch(()=>{});throw e}finally{for(const c of contexts)await c.close()}
}
(async()=>{const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await briefs(browser);await originals(browser)}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
