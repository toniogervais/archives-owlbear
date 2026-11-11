const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
(async()=>{
  const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
  try{
    const context=await browser.newContext({viewport:{width:900,height:1000},hasTouch:true});
    await configure(context,hub(),{sceneReady:true});
    await context.addInitScript(()=>{
      const peers=[],connections=[];
      class Emitter{constructor(){this.handlers={};}on(type,fn){(this.handlers[type]||=[]).push(fn);return this;}emit(type,value){for(const fn of this.handlers[type]||[])fn(value);}}
      window.__emitPlayback=data=>connections.forEach(connection=>connection.open&&connection.emit('data',data));
      window.Peer=class extends Emitter{
        constructor(){super();peers.push(this);setTimeout(()=>this.emit('open',crypto.randomUUID()),0);}
        connect(target){
          this.target=target;const connection=new Emitter();connection.open=true;connections.push(connection);
          connection.send=data=>{
            if(data.type==='hello')setTimeout(()=>connection.emit('data',{type:'welcome',session:'welcome-12345678'}),0);
            if(data.type==='ready')setTimeout(()=>connection.emit('data',{type:'playback',active:false}),0);
          };
          connection.close=()=>{connection.open=false;};setTimeout(()=>connection.emit('open'),0);return connection;
        }
        destroy(){this.destroyed=true;}reconnect(){}
      };
      const originalPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        return window.__blockSound&&!this.muted?Promise.reject(new DOMException('Tap required','NotAllowedError')):originalPlay.call(this);
      };
      window.__receiveStream=()=>{
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
        const paint=()=>{const c=canvas.getContext('2d');c.fillStyle='#255d9a';c.fillRect(0,0,320,180);};paint();setInterval(paint,80);
        const stream=canvas.captureStream(12);
        for(const peer of peers.filter(peer=>!peer.destroyed)){
          const call=new Emitter();call.peer=peer.target;call.metadata={session:'welcome-12345678'};
          call.close=()=>call.emit('close');call.answer=()=>setTimeout(()=>call.emit('stream',stream),0);
          peer.emit('call',call);
        }
      };
    });
    const gm=await context.newPage(),player=await context.newPage(),errors=[];
    for(const page of [gm,player])page.on('pageerror',error=>errors.push(error.message));
    const app=page=>page.frames().find(frame=>frame.url().includes('archives-app-v64-v55.html'));
    const nativeModal=()=>player.locator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]');
    await gm.goto(owl+'/room/video');await player.goto(owl+'/room/video?joueur=Alix');
    await gm.locator('#archives-tool').click();await player.locator('#archives-tool').click();
    await player.frameLocator('#viewer').frameLocator('#app').locator('#main-area').waitFor({state:'attached'});
    await app(gm).waitForFunction(()=>!!window.ArchivesSoundShow);
    const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),app(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);
    await chooser.setFiles({name:'video-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({activeBoardId:'act',boards:[{id:'act',name:'Acte vidéo',nodes:[{id:'scene',title:'Lieu connu',revealed:true,x:100,y:100,w:200,h:160,clues:[]}],links:[]}]}))});
    await app(player).locator('#world .node-cell[data-id="scene"]').waitFor();
    await app(gm).evaluate(()=>window.ArchivesSoundShow.open());
    const panel=gm.frameLocator('#viewer').frameLocator('#app').locator('#archives-soundshow');
    await panel.locator('details').evaluate(details=>{details.open=true;});
    const session={version:1,peer:'test-video-12345678',secret:'a'.repeat(64)};
    await panel.getByLabel('Code de connexion SoundShow',{exact:true}).fill('SS2.'+session.peer+'.'+session.secret);
    await panel.getByRole('button',{name:'Relier les joueurs',exact:true}).click();
    const reader=app(player);
    await reader.getByText('Vidéos du MJ · prêt',{exact:true}).waitFor();
    assert.equal(await nativeModal().count(),0,'Archives must receive video without another Owlbear modal');
    assert.equal(await reader.locator('#soundshow-sounds-dock').count(),0,'A player has no SoundShow controller');
    const cue={type:'playback',active:true,id:'cue-archives-1',title:'Cinématique dans les Archives',playing:true,volume:.7,muted:false};
    await reader.evaluate(data=>{window.__blockSound=true;window.__emitPlayback(data);window.__receiveStream();},cue);
    await reader.locator('.soundshow-view').waitFor({state:'visible'});
    await reader.getByRole('button',{name:'Autoriser l’image et le son',exact:true}).waitFor({state:'visible'});
    await app(gm).locator('#soundshow-audience').filter({hasText:'Son à autoriser sur 1 écran(s)'}).waitFor({state:'attached'});
    await reader.evaluate(data=>window.__emitPlayback(data),cue);
    assert.equal(await reader.getByRole('button',{name:'Autoriser l’image et le son',exact:true}).isVisible(),true,'A snapshot must never hide blocked sound');
    await reader.evaluate(()=>{window.__blockSound=false;});
    await reader.getByRole('button',{name:'Autoriser l’image et le son',exact:true}).click();
    assert.equal(await reader.locator('video').evaluate(video=>video.muted),false);
    await player.screenshot({path:'/tmp/archives-player-video.png'});
    await reader.getByRole('button',{name:'Revenir au jeu',exact:true}).click();
    await reader.locator('.soundshow-view').waitFor({state:'hidden'});
    await reader.getByRole('button',{name:'Afficher la vidéo du MJ',exact:true}).click();
    await reader.locator('.soundshow-view').waitFor({state:'visible'});
    await reader.evaluate(()=>window.__emitPlayback({type:'playback',active:false}));
    await reader.locator('.soundshow-view').waitFor({state:'hidden'});
    await reader.evaluate(data=>{window.__emitPlayback(data);window.__receiveStream();},{...cue,id:'cue-archives-2'});
    await reader.locator('.soundshow-view').waitFor({state:'visible'});
    // Closing the Archives transfers reception to the existing map viewer.
    await reader.getByRole('button',{name:'Revenir au jeu',exact:true}).click();
    await reader.getByRole('button',{name:'Owlbear — afficher la carte',exact:true}).click();
    await player.locator('#viewer').waitFor({state:'detached'});await nativeModal().waitFor();
    // Opening the Archives again takes over the map viewer's session.
    await player.frameLocator('iframe[id="fr.archives-imaginaire.bridge/soundshow-v1/player"]').getByRole('button',{name:'Revenir au jeu',exact:true}).click();
    await nativeModal().waitFor({state:'detached'});
    await player.locator('#archives-tool').click();
    await player.frameLocator('#viewer').frameLocator('#app').getByText('Vidéos du MJ · prêt',{exact:true}).waitFor();
    await nativeModal().waitFor({state:'detached'});
    await panel.getByRole('button',{name:'Déconnecter',exact:true}).click();
    await app(player).locator('.soundshow-receive').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    console.log('SoundShow in player Archives: session before/after opening, inline video, blocked sound survives updates, audio activation, reopen, stop, Archives/map handover, disconnect: OK');
    await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
