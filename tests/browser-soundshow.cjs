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
    constructor(){super();this.id=crypto.randomUUID();setTimeout(()=>this.emit('open',this.id),0);}
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
  const session={version:1,peer:'test-host-12345678',secret:'a'.repeat(64)},code='SS2.'+session.peer+'.'+session.secret;
  await app.getByLabel('Code de connexion SoundShow',{exact:true}).fill(code);
  await app.getByRole('button',{name:'Relier les joueurs',exact:true}).click();
  await app.getByText('Code transmis. Les vidéos associées se présenteront quand tu les lanceras dans SoundShow.',{exact:true}).waitFor();
  const background=page=>page.frames().find(f=>f.url().includes('background-v55.html'));
  for(const page of [alix,bob])await background(page).waitForFunction(peer=>window.__soundshowConnections.includes(peer),session.peer,{polling:50});
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
  // A source launch opens the actual Owlbear player frame; an idle source closes it.
  await background(alix).evaluate(()=>window.__soundshowEmit({type:'playback',active:true,id:'cue-12345678',title:'Vidéo du MJ',playing:true,volume:1}));
  const modal=alix.locator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]');await modal.waitFor();
  assert.ok(!(await modal.getAttribute('src')).includes(session.secret),'the player credential must not appear in the URL');
  const videoFrame=alix.frames().find(frame=>frame.url().includes('soundshow-player.html'));
  await videoFrame.waitForFunction(peer=>window.__soundshowConnections.includes(peer),session.peer,{polling:50});
  await background(alix).evaluate(()=>window.__soundshowEmit({type:'playback',active:false}));await modal.waitFor({state:'detached'});
  await app.getByRole('button',{name:'Déconnecter',exact:true}).click();
  await app.getByText('Diffusion SoundShow déconnectée.',{exact:true}).waitFor();
  assert.ok(!errors.length,errors.join('\n'));
  console.log('SoundShow room: GM pairing, player reception, late join, forged player rejected, real player frame, automatic close, disconnect: OK');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
