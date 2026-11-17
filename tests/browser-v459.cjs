const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');
const {media,frame,waitMedia,closeMedia,surface}=require('./presented-image.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const camera=p=>p.evaluate(()=>{const s=DuneApp.getState();return {panX:s.panX,panY:s.panY,zoom:s.zoom};});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} / ${b}`);
const scenario={activeBoardId:'a',boards:[{id:'a',name:'ACTE_SECRET_459',nodes:[{id:'n',title:'SECRET_CELLULE_459',category:'personnage',revealed:true,desc:'Description publique',x:100,y:150,w:250,h:170,clues:[]}],links:[]}]};
async function choose(view,name){const dialog=view.locator('#archives-presentation-audience[open]');await dialog.waitFor();if(name)await dialog.getByLabel(name,{exact:true}).check();await dialog.getByRole('button',{name:'Montrer',exact:true}).click();await dialog.waitFor({state:'hidden'});}

async function zoomAndPhone(browser){
 const c=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});await configure(c,hub());const g=await c.newPage();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await configure(mobile,hub());const p=await mobile.newPage();
 try{
  await g.goto(archives+'/archives.html?resume=1');await g.evaluate(s=>ArchivesRelay.apply(s),scenario);
  const initial={panX:20,panY:30,zoom:.87123};await g.evaluate(c=>DuneApp.setCanvasCamera(c,true),initial);
  const vp=await g.locator('#viewport').boundingBox(),anchor={x:vp.x+277.45,y:vp.y+304.8};
  await g.mouse.move(anchor.x,anchor.y);await g.mouse.wheel(0,1.75);await g.waitForFunction(z=>DuneApp.getState().zoom!==z,initial.zoom);const next=await camera(g);
  near(next.zoom,initial.zoom*Math.exp(-1.75*.0015));near((anchor.x-vp.x-initial.panX)/initial.zoom,(anchor.x-vp.x-next.panX)/next.zoom);near((anchor.y-vp.y-initial.panY)/initial.zoom,(anchor.y-vp.y-next.panY)/next.zoom);
  await g.mouse.wheel(0,-1.75);await g.waitForFunction(z=>Math.abs(DuneApp.getState().zoom-z)<1e-7,initial.zoom);
  const geometry=()=>g.evaluate(()=>DuneApp.getState().nodes.map(({id,x,y,w,h})=>({id,x,y,w,h}))),before=await geometry(),cdp=await c.newCDPSession(g);
  const mid={x:vp.x+220,y:vp.y+230},a={id:1,x:mid.x-30,y:mid.y},b={id:2,x:mid.x+30,y:mid.y};
  const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(t=>({...t,radiusX:4,radiusY:4,force:1}))});await g.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));};
  await touch('touchStart',[a]);await touch('touchStart',[a,b]);
  const shifted={x:mid.x+21,y:mid.y+29};await touch('touchMove',[{...a,x:shifted.x-45,y:shifted.y},{...b,x:shifted.x+45,y:shifted.y}]);const pinched=await camera(g);
  near(pinched.zoom,initial.zoom*1.5);near((mid.x-vp.x-initial.panX)/initial.zoom,(shifted.x-vp.x-pinched.panX)/pinched.zoom);near((mid.y-vp.y-initial.panY)/initial.zoom,(shifted.y-vp.y-pinched.panY)/pinched.zoom);
  await touch('touchEnd',[]);assert.deepEqual(await geometry(),before,'MJ pinch leaves cell positions and sizes intact');
  await p.goto(archives+'/archives-app-v64-v55.html?ro=1');await p.evaluate(s=>ArchivesRelay.apply(s),scenario);await p.locator('#archives-player-toolbar-bar').waitFor();
  const rows=await p.locator('#archives-player-toolbar-bar').evaluate(bar=>{const r=bar.getBoundingClientRect(),rows=new Map();for(const b of bar.querySelectorAll('button')){if(!b.getClientRects().length)continue;const box=b.getBoundingClientRect(),y=Math.round(box.y);rows.set(y,(rows.get(y)||0)+1);}return {height:r.height,width:r.width,rows:[...rows.values()]};});
  assert.ok(rows.height<=104,'the 390px phone toolbar uses two compact rows');assert.deepEqual(rows.rows,[7,7],'grip, commands and collapse fill both rows');
  await p.screenshot({path:'/tmp/archives-v459-phone.png'});console.log('V4.59 MJ precise reversible wheel and anchored moving pinch; 390px player toolbar fills two rows.');
 }finally{await c.close();await mobile.close();}
}

async function native(browser){
 const base=hub(),wire=[],fixture=async(args,op,value)=>{if(op==='broadcast'&&value.channel==='fr.archives-imaginaire.bridge/media-v60')wire.push(structuredClone(value.data));return base(args,op,value);};
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext(),browser.newContext()]);for(const c of contexts)await configure(c,fixture,{sceneReady:true,directFiles:false,manualAudience:true});
 const [g,p,q]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];for(const page of [g,p,q])page.on('pageerror',e=>errors.push(e.message));
 try{
  await g.goto(owl+'/room/one');await p.goto(owl+'/room/one?joueur=Alix');await q.goto(owl+'/room/one?joueur=Noa');await g.locator('#archives-tool').click();
  const image=await g.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=120;const x=c.getContext('2d');x.fillStyle='#46ad83';x.fillRect(0,0,120,120);return c.toDataURL();});
  const data=structuredClone(scenario);data.boards[0].nodes[0].revealed=false;data.boards[0].nodes[0].bgImg=image;
  const [picker]=await Promise.all([g.waitForEvent('filechooser'),editor(g).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);await picker.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await editor(g).locator('.node-cell[data-id=n]').waitFor();
  await app(g).evaluate(()=>{window.result=ArchivesPresentation.presentCell('n');});await choose(editor(g),'Alix · Owlbear');await waitMedia(p,image);
  assert.equal(await surface(q).count(),0,'the other player is not presented with this picture');
  assert.ok(!JSON.stringify(wire).includes(image.split(',')[1]),'targeted fallback never broadcasts the image bytes in plaintext');
  const request=wire.find(m=>m.type==='request');assert.ok(request);
  await q.evaluate(request=>fixture.publish('fr.archives-imaginaire.bridge/media-v60',{...request,transfer:crypto.randomUUID(),round:1,missing:[0]}),request);
  await q.waitForTimeout(180);assert.equal(wire.filter(m=>m.type==='audience-sealed'&&m.to==='fixture-Noa').length,0,'another authenticated player cannot request the selected file');
  const text='TEXTE_RESERVE_A_NOA_459';await app(g).evaluate(text=>{window.result=ArchivesPresentation.present({text});},text);await choose(editor(g),'Noa · Owlbear');await media(q).locator('pre').filter({hasText:text}).waitFor();await surface(p).waitFor({state:'detached'});
  assert.ok(!JSON.stringify(wire).includes(text),'the private document stays encrypted in the room broadcasts');
  await app(g).evaluate(()=>{window.result=ArchivesPresentation.presentCell('n');});await choose(editor(g));await waitMedia(p,image);await waitMedia(q,image);await closeMedia(p);await closeMedia(q);
  assert.equal(await app(g).evaluate(()=>DuneApp.getState().nodes[0].revealed),false,'presenting media does not reveal its cell');

  await app(g).evaluate(()=>{ArchivesCloudBridge={getClient:()=>({auth:{getUser:async()=>({data:{user:{id:'12345678-1234-1234-1234-123456789abc'}}})},storage:{from:()=>({upload:async()=>({data:{}}),createSignedUrl:async path=>({data:{signedUrl:'https://fixture-project.supabase.co/storage/v1/object/sign/archives-owlbear-assets/'+path+'?token=fixture'}})})}})};});
  await app(g).evaluate(()=>{window.placed=ArchivesCellTransfer.placeCell(DuneApp.getState().nodes[0],'a',false);});await g.waitForFunction(()=>fixture.local().length===1);
  let token=await g.evaluate(()=>fixture.local()[0]);assert.equal(token.text.plainText,'','new tokens do not add an automatic account or cell label');assert.equal(token.createdUserId,'fixture-MJ');
  await app(g).evaluate(id=>ArchivesCellTransfer.request({action:'label',assetId:id,label:'Le Gardien'}),token.id);await g.waitForFunction(()=>fixture.local()[0]?.text?.plainText==='Le Gardien');
  await app(g).evaluate(id=>ArchivesCellTransfer.request({action:'visibility',assetId:id,reveal:true}),token.id);await g.waitForFunction(async()=> (await fixture.scene()).items[0]?.text?.plainText==='Le Gardien');
  await app(g).evaluate(id=>ArchivesCellTransfer.request({action:'label',assetId:id,label:''}),token.id);await g.waitForFunction(async()=> (await fixture.scene()).items[0]?.text?.plainText==='');
  assert.deepEqual(errors,[]);console.log('V4.59 targeted native picture/document with encrypted fallback, denied unauthorized requests, all-player presentation and MJ-owned optional token labels passed.');
 }finally{for(const c of contexts)await c.close();}
}

async function live(browser){
 const c=await browser.newContext({viewport:{width:1440,height:1000}});await configure(c,hub(),{manualAudience:true});await c.addInitScript(()=>{
  window.Peer=class{constructor(id){this.id=id;this.events={};window.fixturePeer=this;setTimeout(()=>this.events.open?.(id),20);}on(name,callback){this.events[name]=callback;return this;}destroy(){this.destroyed=true;}};
 });const g=await c.newPage(),p=await c.newPage();
 try{
  await g.goto(archives+'/archives.html?resume=1');await g.evaluate(s=>ArchivesRelay.apply(s),scenario);await g.evaluate(()=>DuneApp.startLiveRoom());await g.waitForFunction(()=>window.fixturePeer?.events.connection);
  await g.evaluate(()=>{DuneApp.closeLivePanel();window.sent={alix:[],noa:[]};for(const [id,name]of [['alix','Alix'],['noa','Noa']]){const events={},conn={peer:id,metadata:{playerName:name},open:true,on:(n,fn)=>{events[n]=fn;return conn;},send:data=>sent[id].push(structuredClone(data))};fixturePeer.events.connection(conn);events.open();}});
  await p.goto(archives+'/archives-app-v64-v55.html?ro=1');await g.evaluate(()=>{window.result=ArchivesPresentation.present({text:'INDICE_PRIVE_LIVE_459'});});await choose(g,'Alix · Archives');await g.waitForFunction(()=>sent.alix.some(m=>m.playerPresentation?.image?.startsWith('data:text/plain;')));
  assert.ok(!(await g.evaluate(()=>JSON.stringify(sent.noa))).includes(Buffer.from('INDICE_PRIVE_LIVE_459').toString('base64')),'unselected live connection has no private file');assert.equal(await p.locator('#archives-player-image[open]').count(),0,'the local second screen is not a selected live recipient');
  await g.evaluate(()=>DuneApp.setGmDescription('n','Modification réservée au MJ'));
  const snapshots=await g.evaluate(()=>({alix:sent.alix.findLast(m=>m.boards),noa:sent.noa.findLast(m=>m.boards)}));assert.ok(snapshots.alix.playerPresentation?.image);assert.equal(snapshots.noa.playerPresentation,null,'later canvas updates do not leak the private presentation');
  await g.evaluate(()=>{window.result=ArchivesPresentation.present({text:'MESSAGE_PUBLIC_459'});});await choose(g);await p.locator('#archives-player-image[open] pre').filter({hasText:'MESSAGE_PUBLIC_459'}).waitFor();
  console.log('V4.59 live selected peer, ordinary snapshot refresh, unselected local screen and all-player text presentation passed.');
 }finally{await c.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{const which=process.argv[2];if(!which||which==='zoom')await zoomAndPhone(browser);if(!which||which==='native')await native(browser);if(!which||which==='live')await live(browser);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
