const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {owl,hub,configure}=require('./owlbear-fixture.cjs');
const editor=p=>p.frameLocator('#viewer').frameLocator('#app'),app=p=>p.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const camera=p=>app(p).evaluate(()=>{const s=DuneApp.getState();return {panX:s.panX,panY:s.panY,zoom:s.zoom}});
const layout=p=>app(p).evaluate(()=>JSON.parse(JSON.stringify(DuneApp.getState().playerLayout)));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1,`${label}: ${a} / ${b}`);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function touch(cdp,type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:4,radiusY:4,force:1}))});await pause(35)}
async function openPlayer(p,name){await p.goto(owl+'/room/one?joueur='+name);await p.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(p).locator('#archives-player-toolbar-bar').waitFor();await editor(p).locator('.node-cell[data-id="n"]').waitFor()}
async function visibleControls(p){return editor(p).locator('#archives-player-tools').evaluate(root=>[...root.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>b.id||b.getAttribute('aria-label')))}
async function inBounds(p){return editor(p).locator('#archives-player-tools').evaluate(root=>[...root.querySelectorAll('.archives-player-dock,#archives-player-icons-toggle')].filter(e=>!e.hidden).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}))}
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true,deviceScaleFactor:1})]);
 const fixture=hub();for(const c of contexts)await configure(c,fixture,{sceneReady:true});const [gm,p,q]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
 for(const page of [gm,p,q]){page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message))}
 let bob;
 try{
  await gm.goto(owl+'/room/one');await gm.locator('#archives-tool').click();
  const nodes=[{id:'n',title:'Le témoin',category:'personnage',desc:'Le témoin attend près de la porte. Il peut décrire le véhicule aperçu hier soir. '.repeat(5),revealed:true,x:35,y:110,w:280,h:220,clues:[{id:'known',text:'Une voiture rouge a quitté les lieux.',revealed:true},{id:'hidden',text:'INDICE_MJ_PRIVE_455',revealed:false}],gmDescription:'DESCRIPTION_MJ_PRIVEE_455'},
   {id:'place',title:'Le quai',category:'lieu',desc:'Le point de rendez-vous indiqué par le témoin.',revealed:true,x:460,y:400,w:250,h:170,clues:[]},
   {id:'secret',title:'CELLULE_PRIVEE_455',category:'objet',desc:'Contenu privé.',revealed:false,x:600,y:200,w:250,h:170,clues:[]}];
  const [chooser]=await Promise.all([gm.waitForEvent('filechooser'),editor(gm).getByRole('button',{name:'Importer un scénario',exact:true}).click()]);
  await chooser.setFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({activeBoardId:'a',boards:[{id:'a',name:'ACTE_PRIVE_455',nodes,links:[]}]}))});await editor(gm).locator('.node-cell[data-id="n"]').waitFor();
  await openPlayer(p,'Alix');await openPlayer(q,'Noa');const cdp=await contexts[1].newCDPSession(p);
  for(const player of [p,q]){
   for(const id of ['top-hud','quick-icon-dock','canvas-integrations-dock'])assert.equal(await editor(player).locator('#'+id).isVisible(),false,'the obsolete toolbar must not remain on screen');
   assert.equal(await editor(player).getByRole('button',{name:'Mes notes',exact:true}).count(),1);assert.equal(await editor(player).getByRole('button',{name:'Owlbear — afficher la carte',exact:true}).count(),1);
   assert.equal(await editor(player).getByRole('button',{name:'Déplacer la barre des joueurs',exact:true}).isVisible(),true);assert.equal(await editor(player).locator('.archives-player-dock').count(),1,'one player toolbar');
   assert.ok(await inBounds(player));
  }
  // Real Chrome touch input: begin on the cell itself, add the second finger,
  // pinch while translating the midpoint, then lift one finger and keep panning.
  const initial={panX:5,panY:25,zoom:1};await app(p).evaluate(c=>DuneApp.setCanvasCamera(c,true),initial);
  const before=await layout(p),cell=await editor(p).locator('.node-cell[data-id="n"]').boundingBox(),vp=await editor(p).locator('#viewport').boundingBox();
  const mid={x:cell.x+140,y:cell.y+110},a={id:1,x:mid.x-32,y:mid.y},b={id:2,x:mid.x+32,y:mid.y};
  await touch(cdp,'touchStart',[a]);await touch(cdp,'touchStart',[a,b]);await app(p).evaluate(()=>window.__touchNode=document.querySelector('.node-cell[data-id="n"]'));
  const endMid={x:mid.x+21,y:mid.y+29},nextA={id:1,x:endMid.x-64,y:endMid.y},nextB={id:2,x:endMid.x+64,y:endMid.y};
  for(let i=1;i<=6;i++)await touch(cdp,'touchMove',[{id:1,x:a.x+(nextA.x-a.x)*i/6,y:a.y+(nextA.y-a.y)*i/6},{id:2,x:b.x+(nextB.x-b.x)*i/6,y:b.y+(nextB.y-b.y)*i/6}]);
  const zoomed=await camera(p);assert.ok(Math.abs(zoomed.zoom-2)<.001,'the finger distance produces the exact zoom');
  near((mid.x-vp.x-initial.panX)/initial.zoom,(endMid.x-vp.x-zoomed.panX)/zoomed.zoom,'world X under the fingers');near((mid.y-vp.y-initial.panY)/initial.zoom,(endMid.y-vp.y-zoomed.panY)/zoomed.zoom,'world Y under the fingers');
  assert.deepEqual(await layout(p),before,'pinching over a cell never drags or resizes it');assert.equal(await app(p).evaluate(()=>window.__touchNode===document.querySelector('.node-cell[data-id="n"]')),true,'the canvas is not rebuilt on every touch move');
  await app(gm).evaluate(()=>{DuneApp.getState().nodes.find(n=>n.id==='n').desc+=' Mise à jour pendant le zoom.';DuneApp.commitCellPicture('n',{bgZoom:1})});
  await app(p).waitForFunction(()=>!!DuneApp.getState().pendingPlayerView);await touch(cdp,'touchEnd',[nextB]);const one=await camera(p);near(one.panX,zoomed.panX,'lifting a finger does not jump X');near(one.panY,zoomed.panY,'lifting a finger does not jump Y');
  await touch(cdp,'touchMove',[{...nextA,x:nextA.x+24,y:nextA.y+16}]);const panned=await camera(p);near(panned.panX,zoomed.panX+24,'one-finger continuation X');near(panned.panY,zoomed.panY+16,'one-finger continuation Y');await touch(cdp,'touchEnd',[]);
  await app(p).waitForFunction(()=>!DuneApp.getState().isNavigatingCanvas&&!DuneApp.getState().pendingPlayerView&&DuneApp.getState().nodes.find(n=>n.id==='n').desc.includes('Mise à jour pendant le zoom.'));
  assert.deepEqual(await layout(p),before);assert.equal(await app(p).evaluate(()=>visualViewport.scale),1,'the gesture zooms the canvas, not the browser page');
  await app(p).evaluate(c=>DuneApp.setCanvasCamera(c,true),initial);const tapCell=await editor(p).locator('.node-cell[data-id="n"]').boundingBox();
  await touch(cdp,'touchStart',[{id:1,x:tapCell.x+110,y:tapCell.y+100}]);await touch(cdp,'touchEnd',[]);await editor(p).locator('#player-cell-detail.open').waitFor();
  assert.ok(await editor(p).locator('#player-cell-detail .pcd-description').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));assert.ok(!(await editor(p).locator('#player-cell-detail').innerText()).includes('DESCRIPTION_MJ_PRIVEE_455'));await editor(p).locator('#player-cell-detail .pcd-close').tap();
  assert.equal(await editor(p).locator('#archives-player-zoom-in,#archives-player-zoom-out,#archives-player-zoom-value').count(),0,'the toolbar has no zoom buttons or percentage');
  assert.equal(await editor(p).locator('#archives-player-display-open').count(),0,'the unnecessary three-dot menu is removed');
  const gmPositionBefore=await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='n').x);
  const otherPlayerLayout=await layout(q),personalBefore=await layout(p);
  assert.equal(await editor(p).locator('#archives-player-arrange').count(),0,'players drag cells without a mode button');
  const moveCell=await editor(p).locator('.node-cell[data-id="n"]').boundingBox();
  const finger={id:7,x:Math.round(moveCell.x+85),y:Math.round(moveCell.y+95)};
  await touch(cdp,'touchStart',[finger]);
  await touch(cdp,'touchMove',[{...finger,x:finger.x+65,y:finger.y+38}]);
  await touch(cdp,'touchEnd',[]);
  const personalAfter=await layout(p);
  assert.ok(personalAfter.n.x>personalBefore.n.x+25,'touch dragging changes the personal cell position');
  assert.ok(personalAfter.n.y>personalBefore.n.y+15,'touch dragging updates both coordinates');
  assert.deepEqual(await layout(q),otherPlayerLayout,'the other player has an independent canvas');
  assert.equal(await app(gm).evaluate(()=>DuneApp.getState().nodes.find(n=>n.id==='n').x),gmPositionBefore,'the GM canvas stays unchanged');
  // Hide the toolbar: direct finger dragging must still work.
  await editor(p).getByRole('button',{name:'Masquer les icônes',exact:true}).tap();
  const hiddenBefore=await layout(p),hiddenCell=await editor(p).locator('.node-cell[data-id="n"]').boundingBox();
  const hiddenFinger={id:8,x:Math.round(hiddenCell.x+80),y:Math.round(hiddenCell.y+80)};
  await touch(cdp,'touchStart',[hiddenFinger]);await touch(cdp,'touchMove',[{...hiddenFinger,x:hiddenFinger.x+41,y:hiddenFinger.y+23}]);await touch(cdp,'touchEnd',[]);
  assert.ok((await layout(p)).n.x>hiddenBefore.n.x+15,'cells remain movable when the icon bar is hidden');
  await editor(p).getByRole('button',{name:'Afficher les icônes',exact:true}).tap();
  await app(p).evaluate(c=>DuneApp.setCanvasCamera(c,true),initial);
  await editor(p).locator('#quick-player-center-all').tap();await p.screenshot({path:'/tmp/archives-v455-smartphone.png'});await q.screenshot({path:'/tmp/archives-v455-tablette.png'});
  // The single player toolbar has its own compact state and a real touch-operated grip.
  await editor(p).getByRole('button',{name:'Réduire la barre des joueurs',exact:true}).tap();assert.equal(await editor(p).locator('#archives-player-toolbar-bar .player-bar-actions').isVisible(),false);await editor(p).getByRole('button',{name:'Déployer la barre des joueurs',exact:true}).tap();
  await app(p).evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const grip=editor(p).getByRole('button',{name:'Déplacer la barre des joueurs',exact:true}),r=await grip.boundingBox(),barBefore=await editor(p).locator('#archives-player-toolbar-bar').boundingBox();
  await touch(cdp,'touchStart',[{id:1,x:r.x+r.width/2,y:r.y+r.height/2}]);await touch(cdp,'touchMove',[{id:1,x:r.x+r.width/2+50,y:r.y+r.height/2-280}]);await touch(cdp,'touchEnd',[]);await pause(60);
  const barAfter=await editor(p).locator('#archives-player-toolbar-bar').boundingBox();console.log('BAR',JSON.stringify({before:barBefore,after:barAfter,grip:r}));assert.ok(barAfter.y<barBefore.y-70,'the player moves a bar by its grip');assert.ok(await inBounds(p));
  await editor(p).getByRole('button',{name:'Masquer les icônes',exact:true}).tap();assert.equal(await editor(p).locator('#archives-player-toolbar-bar').isVisible(),false);assert.deepEqual(await visibleControls(p),['archives-player-icons-toggle']);
  assert.equal(await editor(q).locator('#archives-player-toolbar-bar').isVisible(),true,'another player keeps their own toolbar');await p.screenshot({path:'/tmp/archives-v455-icones-masquees.png'});
  const permanent=await editor(p).locator('#archives-player-icons-toggle').boundingBox();await touch(cdp,'touchStart',[{id:1,x:permanent.x+permanent.width/2,y:permanent.y+permanent.height/2}]);await touch(cdp,'touchMove',[{id:1,x:permanent.x+permanent.width/2-80,y:permanent.y+permanent.height/2-60}]);await touch(cdp,'touchEnd',[]);assert.deepEqual(await visibleControls(p),['archives-player-icons-toggle'],'moving the permanent icon does not activate it');await editor(p).getByRole('button',{name:'Afficher les icônes',exact:true}).tap();assert.equal(await editor(p).locator('#archives-player-toolbar-bar').isVisible(),true,'one tap restores the bars after moving the permanent icon');await editor(p).getByRole('button',{name:'Masquer les icônes',exact:true}).tap();
  // Hiding stays local to the authenticated player even on a shared browser.
  bob=await contexts[1].newPage();await openPlayer(bob,'Bob');assert.equal(await editor(bob).locator('#archives-player-toolbar-bar').isVisible(),true);await bob.close();
  await p.reload();await p.frameLocator('#invite').getByRole('button',{name:'Afficher les Archives',exact:true}).click();await editor(p).getByRole('button',{name:'Afficher les icônes',exact:true}).waitFor();assert.deepEqual(await visibleControls(p),['archives-player-icons-toggle']);
  await p.setViewportSize({width:844,height:390});await pause(100);assert.deepEqual(await visibleControls(p),['archives-player-icons-toggle']);assert.ok(await inBounds(p));
  await editor(p).getByRole('button',{name:'Afficher les icônes',exact:true}).tap();assert.equal(await editor(p).locator('#archives-player-toolbar-bar #quick-player-center-cell').isVisible(),true);assert.ok(await inBounds(p));
  const landscapeVisible=await editor(p).locator('.node-cell').evaluateAll(cells=>cells.every(cell=>{const r=cell.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}));assert.ok(landscapeVisible,'the fitted cells remain in the landscape viewport');await p.screenshot({path:'/tmp/archives-v455-paysage.png'});
  await p.setViewportSize({width:320,height:740});await pause(100);assert.ok(await inBounds(p));await p.screenshot({path:'/tmp/archives-v455-petit-telephone.png'});
  for(const id of ['quick-player-layout','quick-player-center-cell','quick-player-center-all'])assert.equal(await editor(p).locator('#archives-player-toolbar-bar #'+id).isVisible(),true,'the original player canvas commands stay directly visible');
  const gmBefore=await app(gm).evaluate(()=>DuneApp.getState().nodes.map(n=>({id:n.id,x:n.x,y:n.y})));
  const playerBefore=await layout(p);await editor(p).locator('#quick-player-layout').tap();assert.notDeepEqual(await layout(p),playerBefore,'the organize command changes the personal player layout');
  assert.deepEqual(await app(gm).evaluate(()=>DuneApp.getState().nodes.map(n=>({id:n.id,x:n.x,y:n.y}))),gmBefore,'organizing as a player leaves the GM canvas intact');
  await editor(p).locator('#quick-player-center-cell').tap();await editor(p).locator('#quick-player-center-all').tap();
  const wire=JSON.stringify(await gm.evaluate(()=>fixture.wire()));for(const secret of ['INDICE_MJ_PRIVE_455','DESCRIPTION_MJ_PRIVEE_455','CELLULE_PRIVEE_455','ACTE_PRIVE_455','archives:player-tools:v458:'])assert.ok(!wire.includes(secret),'private data: '+secret);
  assert.deepEqual(errors,[]);console.log('V4.55: real mobile pinch over a cell keeps its precise moving finger anchor, preserves personal cell geometry and queued MJ updates; tap reader, 1% zoom, movable/collapsible bars, one permanent hide/restore button, player scope, reload and rotation, 320px phone and tablet privacy passed.');
 }catch(e){for(const [page,name]of [[p,'phone'],[q,'tablet'],[gm,'gm']]){await page.screenshot({path:'/tmp/archives-v455-'+name+'-failure.png'}).catch(()=>{});if(page===p)console.log('PHONE',JSON.stringify(await app(p)?.evaluate(()=>({camera:{x:DuneApp.getState().panX,y:DuneApp.getState().panY,zoom:DuneApp.getState().zoom},navigation:DuneApp.getState().isNavigatingCanvas,text:document.body.innerText.slice(-1200)})).catch(()=>null)))}throw e}
 finally{for(const c of contexts)await c.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
