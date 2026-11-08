const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const channel='fr.archives-imaginaire.bridge/soundshow-v1';
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  const context=await browser.newContext();await configure(context,hub(),{sceneReady:true,autoScreenChoice:false});
  await context.addInitScript(()=>{
   window.__soundshowConnections=[];
   const dataConnections=[];window.__soundshowEmit=data=>dataConnections.forEach(connection=>{if(connection.open)connection.emit('data',data);});
   window.__soundshowTrace=[];
   addEventListener('message',event=>{const value=event.data;if(String(value?.id||'').includes('BROADCAST_MESSAGE')&&value.data?.data)window.__soundshowTrace.push({type:value.data.data.type,to:value.data.data.to,sender:value.data.connectionId,peer:value.data.data.session?.peer});});
   class Emitter{constructor(){this.handlers={};}on(type,fn){(this.handlers[type]||=[]).push(fn);return this;}emit(type,...args){for(const fn of this.handlers[type]||[])fn(...args);}}
   window.Peer=class extends Emitter{
    constructor(){super();this.id=crypto.randomUUID();setTimeout(()=>this.emit(window.__soundshowPeerFailure?'error':'open',this.id),0);}
    connect(target){window.__soundshowConnections.push(target);const conn=new Emitter();conn.open=true;conn.peer=target;dataConnections.push(conn);
     conn.send=data=>{if(data.type==='hello')setTimeout(()=>conn.emit('data',{type:'welcome',session:'welcome-12345678'}),0);if(data.type==='ready')setTimeout(()=>conn.emit('data',{type:'playback',active:false}),0);};
     conn.close=()=>{conn.open=false;};setTimeout(()=>conn.emit('open'),0);return conn;}
    destroy(){this.destroyed=true;}disconnect(){}reconnect(){}
   };
  });
  const gm=await context.newPage(),alix=await context.newPage(),bob=await context.newPage();
  const errors=[];for(const page of [gm,alix,bob])page.on('pageerror',e=>errors.push(e.message));
  await gm.goto(owl+'/room/one');await alix.goto(owl+'/room/one?joueur=Alix');await bob.goto(owl+'/room/one?joueur=Bob');
  await gm.locator('#archives-tool').click();const app=gm.frameLocator('#viewer').frameLocator('#app');
  await app.locator('#archives-soundshow-open').waitFor({state:'attached'});assert.equal(await app.locator('#archives-soundshow-open').isDisabled(),false);
  const frame=()=>gm.frames().find(f=>f.url().includes('archives-app-v64-v55.html'));
  await frame().evaluate(()=>window.ArchivesSoundShow.open());
  await app.locator('#archives-soundshow').waitFor();
  await app.locator('#archives-soundshow details').evaluate(el=>{el.open=true;});
  const session={version:1,peer:'test-host-12345678',secret:'a'.repeat(64)},code='SS2.'+session.peer+'.'+session.secret;
  const background=page=>page.frames().find(f=>f.url().includes('background-v55.html'));
  // A hidden watcher failure must not prevent the visible receiving frame.
  await background(alix).evaluate(()=>{window.__soundshowPeerFailure=true;});
  await app.getByLabel('Code de connexion SoundShow',{exact:true}).fill(code);
  await app.getByRole('button',{name:'Relier les joueurs',exact:true}).click();
  await app.getByText('SoundShow relié. Lance maintenant tes vidéos dans SoundShow.',{exact:true}).waitFor();
  await app.locator('#soundshow-room-status').filter({hasText:'2 joueur(s) dans cette salle Owlbear'}).waitFor();
  const modal=page=>page.locator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]');
  const videoFrame=async page=>{
    await page.frameLocator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]').getByRole('button',{name:'Revenir au jeu',exact:true}).waitFor();
    return page.frames().find(frame=>frame.url().includes('soundshow-player.html'));
  };
  for(const page of [alix,bob]){
    await modal(page).waitFor();
    await (await videoFrame(page)).waitForFunction(peer=>window.__soundshowConnections.includes(peer),session.peer,{polling:50});
    await page.frameLocator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]').getByText('Prêt — en attente d’une vidéo du MJ.',{exact:true}).waitFor();
    assert.ok(!(await modal(page).getAttribute('src')).includes(session.secret),'the credential must not appear in a URL');
  }
  await app.locator('#soundshow-room-status').filter({hasText:'2 lecteur(s) relié(s)'}).waitFor();
  assert.equal(await modal(gm).count(),0,'A GM must not receive a player modal');
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/soundshow/owlbear.mjs'),'utf8'),/width:780,height:500/,'Viewer must open in a window, not full screen');
  assert.deepEqual(await background(alix).evaluate(()=>window.__soundshowConnections),[],'The visible reader works while its hidden watcher is unavailable');
  await alix.evaluate(({channel,session})=>window.fixture.publish(channel,{type:'session',session:{...session,peer:'forged-host-12345678'}}),{channel,session});
  await bob.waitForTimeout(100);assert.deepEqual(await background(bob).evaluate(()=>window.__soundshowConnections),[session.peer]);
  // A newly joined player can ask the GM for the current session.
  const late=await context.newPage();late.on('pageerror',error=>errors.push(error.message));await late.goto(owl+'/room/one?joueur=Charlie');await late.locator('#archives-tool').waitFor({state:'attached'});
  await late.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.id==='background'));
  try{await background(late).waitForFunction(peer=>window.__soundshowConnections.includes(peer),session.peer,{polling:50});}
  catch(error){
   for(const [label,page]of[['GM',gm],['Alix',alix],['Charlie',late]])console.log(label,await background(page).evaluate(()=>({connections:window.__soundshowConnections,trace:window.__soundshowTrace})));
   console.log('Wire',await gm.evaluate(channel=>window.fixture.wire().then(wire=>wire.filter(x=>x.value?.channel===channel).map(x=>({type:x.value.data.type,to:x.value.data.to,peer:x.value.data.session?.peer}))),channel));
   console.log('Errors',errors);throw error;
  }
  await modal(late).waitFor();
  await late.frameLocator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]').getByText('Prêt — en attente d’une vidéo du MJ.',{exact:true}).waitFor();
  // Voluntary return stays closed for the current cue, and a new cue reopens it.
  const active={type:'playback',active:true,id:'cue-12345678',title:'Vidéo du MJ',playing:true,volume:1};
  await background(bob).evaluate(data=>window.__soundshowEmit(data),active);
  await (await videoFrame(bob)).evaluate(data=>window.__soundshowEmit(data),active);
  await bob.bringToFront();
  await bob.frameLocator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]').getByRole('button',{name:'Revenir au jeu',exact:true}).click();
  await modal(bob).waitFor({state:'detached'});
  await background(bob).evaluate(data=>window.__soundshowEmit(data),active);assert.equal(await modal(bob).count(),0);
  await background(bob).evaluate(data=>window.__soundshowEmit(data),{...active,id:'cue-next-12345678'});await modal(bob).waitFor();
  await (await videoFrame(bob)).waitForFunction(peer=>window.__soundshowConnections.includes(peer),session.peer,{polling:50});
  await background(bob).evaluate(()=>window.__soundshowEmit({type:'playback',active:false}));await modal(bob).waitFor({state:'detached'});
  // Re-linking the same session explicitly opens a closed reader again.
  await gm.bringToFront();await app.getByRole('button',{name:'Relier les joueurs',exact:true}).click();await modal(bob).waitFor();
  await app.locator('#soundshow-room-status').filter({hasText:'3 lecteur(s) relié(s)'}).waitFor();
  await app.getByRole('button',{name:'Déconnecter',exact:true}).click();
  await app.getByText('Diffusion SoundShow déconnectée.',{exact:true}).waitFor();
  await modal(alix).waitFor({state:'detached'});await modal(bob).waitFor({state:'detached'});
  // The receiving frame remains visible with an actionable status if its peer fails.
  await context.addInitScript(()=>{if(location.pathname.endsWith('/soundshow-player.html'))window.__soundshowPeerFailure=true;});
  const dana=await context.newPage();dana.on('pageerror',error=>errors.push(error.message));await dana.goto(owl+'/room/one?joueur=Dana');
  await dana.locator('#archives-tool').waitFor({state:'attached'});
  await app.getByLabel('Code de connexion SoundShow',{exact:true}).fill(code);
  await app.getByRole('button',{name:'Relier les joueurs',exact:true}).click();
  const failed=await videoFrame(dana);
  await failed.getByText(/Liaison vidéo interrompue —/).waitFor();
  assert.equal(await failed.locator('.soundshow-view').isVisible(),true);
  await failed.getByRole('button',{name:'Réessayer la connexion',exact:true}).waitFor({state:'visible'});
  assert.equal(await failed.getByText('Prêt — en attente d’une vidéo du MJ.',{exact:true}).count(),0,'A failed connection must not falsely say ready');
  await failed.evaluate(()=>{window.__soundshowPeerFailure=false;});
  await failed.getByRole('button',{name:'Réessayer la connexion',exact:true}).click();
  await failed.getByText('Prêt — en attente d’une vidéo du MJ.',{exact:true}).waitFor();
  // The previously dismissed readers need not all reconnect just because Dana did.
  // Verify Dana's live ready state and that at least one player reader is reported.
  await app.locator('#soundshow-room-status').filter({hasText:/[1-4] lecteur\(s\) relié\(s\)/}).waitFor();
  await app.locator('#soundshow-room-status').filter({hasText:'4 joueur(s) dans cette salle Owlbear'}).waitFor();
  await app.getByRole('button',{name:'Déconnecter',exact:true}).click();await modal(dana).waitFor({state:'detached'});
  assert.ok(!errors.length,errors.join('\n'));
  console.log('SoundShow room: immediate reader despite blocked hidden watcher, visible connection errors, party count, voluntary return/new cue/re-link, late join, forged player rejected, stop/disconnect: OK');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
