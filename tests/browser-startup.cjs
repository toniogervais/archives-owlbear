const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {archives,owl,hub,configure}=require('./owlbear-fixture.cjs');

async function action(page,{ready=true}={}){
 const manifest=JSON.parse(fs.readFileSync('manifest-v55.json','utf8'));
 const url=archives+'/'+new URL(manifest.action.popover).pathname.split('/').pop();
 await page.evaluate(({archives,url,ready})=>{
  const frame=document.createElement('iframe');frame.id='action';
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:500;border:0';
  frame.addEventListener('load',()=>{if(ready)frame.contentWindow.postMessage({id:'OBR_READY',data:{ref:'action',userId:'fixture-MJ'}},archives)});
  frame.src=url+'?obrref='+encodeURIComponent(btoa(location.origin+' fixture-single-room'));
  document.body.append(frame);
 },{archives,url,ready});
 return page.frameLocator('#action');
}
async function loaded(page){await page.frameLocator('#viewer').frameLocator('#app').locator('#world').waitFor({state:'attached'})}

(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||'{}')});
 try{
  // Each service download may fail without preventing navigation or the editor.
  for(const failed of ['v58/transfers.mjs','v57/room-background.mjs','v60/background.mjs','soundshow/owlbear.mjs']){
   const context=await browser.newContext();await configure(context,hub(),{autoScreenChoice:false,sceneReady:true});
   await context.route('**/src/'+failed+'?*',route=>route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(owl+'/room/one');await page.locator('#archives-tool').click();await loaded(page);
   assert.deepEqual(errors,[],'A rejected optional import must be caught');await context.close();
  }
  // A native tool API error must not prevent the static action from opening the editor.
  for(const failures of [1,Infinity]){
   const context=await browser.newContext();await configure(context,hub(),{autoScreenChoice:false});
   await context.addInitScript(({archives,forever})=>{
    if(location.origin!=='https://www.owlbear.rodeo')return;
    window.toolRequests=0;
    addEventListener('message',event=>{
     if(event.origin!==archives||event.data?.id!=='OBR_TOOL_CREATE')return;
     window.toolRequests++;
     if(forever||window.toolRequests===1){
      event.stopImmediatePropagation();
      event.source.postMessage({id:'OBR_TOOL_CREATE_ERROR'+event.data.nonce,data:{message:'Tool temporarily unavailable'}},archives);
     }
    },true);
   },{archives,forever:failures===Infinity});
   const page=await context.newPage();await page.goto(owl+'/room/one');
   if(failures===1){await page.locator('#archives-tool').click();await loaded(page);assert.equal(await page.evaluate(()=>toolRequests),2);}
   else{
    await page.waitForFunction(()=>toolRequests===3);await page.waitForTimeout(1700);
    assert.equal(await page.evaluate(()=>toolRequests),3,'Registration retries must stop');
    const popover=await action(page);await popover.getByRole('button',{name:'Afficher les Archives',exact:true}).click();await loaded(page);
   }
   await context.close();
  }
  // If the action module fails, the static error and diagnostic remain readable.
  {
   const context=await browser.newContext();await configure(context,hub(),{autoScreenChoice:false});
   await context.route('**/src/v55/open.mjs?*',route=>route.abort());
   const page=await context.newPage();await page.goto(owl+'/room/one');const popover=await action(page);
   await popover.getByText(/Un fichier de l’extension n’a pas chargé/).waitFor();
   assert.equal(await popover.getByRole('button',{name:'Afficher les Archives',exact:true}).isDisabled(),true);
   assert.equal(await popover.getByRole('link',{name:'Vérifier le chargement'}).isVisible(),true);await context.close();
  }
  // A late SDK handshake recovers from the timeout without a reload.
  {
   const context=await browser.newContext();await configure(context,hub(),{autoScreenChoice:false});
   const page=await context.newPage();await page.goto(owl+'/room/one');const popover=await action(page,{ready:false});
   await popover.getByText(/Owlbear n’a pas encore établi la connexion/).waitFor({timeout:13000});
   assert.equal(await popover.locator('#return').isDisabled(),true);
   await page.evaluate(archives=>document.getElementById('action').contentWindow.postMessage({id:'OBR_READY',data:{ref:'action',userId:'fixture-MJ'}},archives),archives);
   await popover.locator('#return').click();await loaded(page);await context.close();
  }
  // Opening the launcher directly must never navigate into an autonomous GM app.
  {
   const context=await browser.newContext();await configure(context,hub());const page=await context.newPage();
   await page.goto(archives+'/index-v55.html');await page.getByText(/Cette commande doit être ouverte depuis une salle Owlbear/).waitFor();
   assert.equal(await page.locator('#return').isDisabled(),true);assert.equal(await page.locator('a[href*="archives-app"]').count(),0);await context.close();
  }
  // The diagnostic reports actual download failures and works without reading user storage.
  for(const fail of [false,true]){
   const context=await browser.newContext();await configure(context,hub());
   await context.addInitScript(()=>{
    for(const method of ['getItem','setItem','removeItem'])Storage.prototype[method]=()=>{throw Error('Diagnostic must not access storage')};
    indexedDB.open=()=>{throw Error('Diagnostic must not open a campaign database')};
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Clipboard blocked')}}});
   });
   if(fail)await context.route('**/src/v65/screen-model.mjs',route=>route.abort());
   const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>requests.push(req));
   await page.goto(archives+'/diagnostic.html');await page.getByRole('button',{name:'Copier le résultat'}).click();
   const text=await page.locator('#report').inputValue();
   assert.equal(await page.locator('#report').isVisible(),true);assert.equal(text.includes('ÉCHEC'),fail);
   assert.equal(requests.every(request=>request.method()==='GET'&&new URL(request.url()).origin===archives),true);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Chromium : échecs de modules isolés, reprise limitée de l’outil, action indépendante, erreur lisible, SDK tardif, accès hors salle refusé et diagnostic sans lecture de campagne validés.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

