const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {archives,configure,hub}=require('./owlbear-fixture.cjs');
const packet={activeBoardId:'a',boards:[{id:'a',name:'Scène 1',nodes:[{id:'a',title:'Le témoin',category:'personnage',desc:'Un témoin public',revealed:true,x:40,y:220,w:250,h:170,clues:[{id:'c',text:'Un indice public',revealed:true}]},{id:'b',title:'Le quai',category:'lieu',desc:'Un lieu public',revealed:true,x:650,y:400,w:250,h:170,clues:[]}],links:[{id:'l',from:'a',to:'b',revealed:true}]}]};
async function run(browser,mode){
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await configure(c,hub(),{sceneReady:true});await c.addInitScript(data=>{
  class Wire{constructor(){this.open=false;this.events={};setTimeout(()=>{this.open=true;this.events.open?.();setTimeout(()=>this.events.data?.(structuredClone(data)),30)},50)}on(n,fn){this.events[n]=fn;return this}send(){}close(){}}
  window.Peer=class{constructor(){this.events={};setTimeout(()=>this.events.open?.('fixture-peer'),20)}on(n,fn){this.events[n]=fn;return this}connect(){return new Wire()}destroy(){}};
 },packet);
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('Alix'));
 try{
  await p.goto(archives+'/archives-app-v64-v55.html'+(mode==='direct'?'?ro=1':''));
  if(mode==='live'){await p.locator('#archives-role-player').tap();await p.locator('#archives-player-code').fill('JDR-ABCDEFGHJKLM');await p.locator('#archives-player-connect').tap();await p.locator('#archives-title-screen').waitFor({state:'hidden'})}
  else await p.evaluate(data=>ArchivesRelay.apply(data),packet);
  await p.locator('.node-cell[data-id=a]').waitFor();await p.locator('#archives-player-reading-bar').waitFor();
  const diagnostics=async()=>p.locator('#archives-player-tools button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id||n.getAttribute('aria-label'),disabled:n.disabled,handler:typeof n.onclick,hit:at?.closest('button')?.id,top:at?.id||at?.className}}));
  console.log(mode,'CONTROLS',JSON.stringify(await diagnostics()));
  await p.locator('#archives-player-icons-toggle').tap();assert.ok(await p.locator('body').evaluate(e=>e.classList.contains('player-icons-hidden')),mode+' eye hides all');
  await p.locator('#archives-player-icons-toggle').tap();assert.equal(await p.locator('#archives-player-layout-bar').isVisible(),true);
  const z=await p.evaluate(()=>DuneApp.getState().zoom);await p.locator('#archives-player-zoom-in').tap();assert.ok(await p.evaluate(z=>DuneApp.getState().zoom>z,z),mode+' zoom in');
  await p.locator('#archives-player-zoom-out').tap();await p.locator('#archives-player-display-open').tap();await p.locator('#archives-player-display[open]').waitFor();await p.getByRole('button',{name:'Fermer mon affichage',exact:true}).tap();
  const before=await p.evaluate(()=>JSON.stringify(DuneApp.getState().playerLayout));await p.locator('#quick-player-layout').tap();assert.notEqual(await p.evaluate(()=>JSON.stringify(DuneApp.getState().playerLayout)),before,mode+' organize');
  await p.locator('#quick-player-center-all').tap();
  await p.locator('#quick-player-journal').tap();await p.locator('#journal-modal.open').waitFor();await p.evaluate(()=>DuneApp.closeJournal());
  await p.locator('#archives-dossier-open').tap();await p.locator('#archives-player-dossier[open]').waitFor();assert.ok((await p.locator('#archives-player-dossier').innerText()).includes('Le témoin'),mode+' dossier has the current public canvas');await p.locator('#archives-player-dossier header button').tap();
  assert.equal(await p.locator('#quick-player-notes').count(),1,mode+' personal notes exist outside Owlbear');await p.locator('#quick-player-notes').tap();await p.locator('#archives-player-notebook[open]').waitFor();await p.locator('#archives-player-notebook header button').tap();
  assert.deepEqual(errors,[]);console.log(mode,'all player commands passed');
 }catch(e){console.log(mode,'ERRORS',JSON.stringify(errors));console.log(mode,'BODY',await p.locator('body').innerText().then(s=>s.slice(-1800)));throw e}finally{await c.close()}
}
(async()=>{const b=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});try{await run(b,'live');await run(b,'direct')}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
