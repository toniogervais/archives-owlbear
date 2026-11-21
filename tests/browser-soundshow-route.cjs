const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {archives, owl, configure, fixture, hub} = require('./owlbear-fixture.cjs');

(async () => {
  const browser = await chromium.launch({headless:true, ...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS || '{}')});
  try {
    const context = await browser.newContext();
    await configure(context, hub(), {sceneReady:true});
    const connector = 'http://127.0.0.1:39742';
    await context.route(connector+'/**', route => route.fulfill({contentType:'text/html', body:`
      <button id="open">Ouvrir les Archives</button><script>
      const origin=${JSON.stringify(archives)},protocol='archives:soundshow:link-v1',token=crypto.randomUUID();
      let main,challenge;window.commands=[];
      document.querySelector('button').onclick=()=>{main=open(origin+'/archives.html?main=1','main-mj')};
      addEventListener('message',e=>{
        const d=e.data;
        if(e.source!==main||e.origin!==origin||d?.protocol!==protocol)return;
        const post=data=>main.postMessage({protocol,challenge,...data},origin);
        if(d.type==='request'){challenge=d.challenge;post({type:'offer',controlToken:token,session:null});return}
        if(d.challenge!==challenge)return;
        if(d.type==='accepted')post({type:'remote-state',state:{connected:true,instantVideo:true,videoReady:true,project:'Table',media:[{id:'rain',kind:'sound',name:'Pluie',category:'Sons'}],active:[]}});
        if(d.type==='remote-command'&&d.controlToken===token){commands.push(d.command.type);post({type:'remote-result',id:d.id,ok:true})}
      });
      </script>`}));
    await context.route(owl+'/**', route => route.fulfill({contentType:'text/html',body:
      fixture({sceneReady:true}).replace('/background-v55.html?v=4210','/background-v72.html?v=4730')}));
    const dashboard = await context.newPage();
    await dashboard.goto(connector);
    const [main] = await Promise.all([dashboard.waitForEvent('popup'),dashboard.locator('#open').click()]);
    await main.waitForURL('**/archives-app-v64-v55.html*');
    await main.getByRole('button',{name:'Sons — ouvrir la grille SoundShow'}).click();
    await main.getByRole('button',{name:'Pluie',exact:true}).click();
    await dashboard.waitForFunction(()=>commands.length===1);
    await main.locator('#soundshow-sounds-panel .ss-close').click();
    main.once('dialog', dialog=>dialog.accept(owl+'/room/video'));
    const [room] = await Promise.all([main.waitForEvent('popup'), main.getByRole('button',{name:'Owlbear — afficher la carte',exact:true}).click()]);
    await room.locator('#archives-tool').click();
    const editor = room.frameLocator('#viewer').frameLocator('#app');
    await editor.getByRole('button',{name:'Sons — ouvrir la grille SoundShow'}).click();
    await editor.getByRole('button',{name:'Pluie',exact:true}).click();
    await dashboard.waitForFunction(()=>commands.length===2);
    assert.deepEqual(await dashboard.evaluate(()=>commands),['play_playable','play_playable']);
    const wire=JSON.stringify(await room.evaluate(()=>fixture.wire()));
    assert.ok(!wire.includes('controlToken')&&!wire.includes('play_playable')&&!wire.includes('Pluie'));
    console.log('Audio control with video signalling unavailable, directly in Archives and via its Owlbear room: OK');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
