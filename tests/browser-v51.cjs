const {chromium}=require("playwright");
const http=require("http"),fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,"http://local").pathname);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader("Content-Type",file.endsWith(".mjs")||file.endsWith(".js")?"text/javascript":"text/html");
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  await context.route("**/*",route=>{
   if(new URL(route.request().url()).hostname!=="127.0.0.1")return route.abort();
   return route.continue();
  });
  const base="http://127.0.0.1:"+server.address().port;
  const page=await context.newPage();
  await page.goto(base+"/archives-app-v60-v51.html?resume=1");
  await page.waitForFunction(()=>window.ArchivesRelay&&window.DuneApp);
  const result=await page.evaluate(()=>{
    const api=window.ArchivesRelay;
    const data=JSON.parse(JSON.stringify(api.snapshot()));
    data.boards=[{id:"test",title:"Partie test",nodes:[],links:[]}];data.activeBoardId="test";
    api.apply(data);
    const saved=JSON.parse(localStorage.getItem("jdr_architect_save_v12"));
    return {board:window.DuneApp.getState().activeBoardId,saved:saved.activeBoardId,pairButton:document.body.textContent.includes("Relier à Owlbear")};
  });
  assert.deepEqual(result,{board:"test",saved:"test",pairButton:true});
  const remote=await context.newPage();
  await remote.goto(base+"/archives-app-v60-v51.html?resume=1&remote=1");
  await remote.waitForFunction(()=>window.ArchivesRelay);
  const remoteResult=await remote.evaluate(()=>{
    const initial=window.DuneApp.getState().activeBoardId;
    const old=localStorage.getItem("jdr_architect_save_v12");
    const data=window.ArchivesRelay.snapshot();
    data.boards=[{id:"remote",nodes:[],links:[]}];data.activeBoardId="remote";
    window.ArchivesRelay.apply(data);
    return {initial,board:window.DuneApp.getState().activeBoardId,untouched:old===localStorage.getItem("jdr_architect_save_v12")};
  });
  assert.notEqual(remoteResult.initial,"test");
  assert.equal(remoteResult.board,"remote");assert.equal(remoteResult.untouched,true);
  const player=await context.newPage();
  await player.goto(base+"/archives-app-v60-v51.html?ro=1");
  await player.waitForFunction(()=>window.DuneApp);
  assert.equal(await player.evaluate(()=>window.DuneApp.getState().playerMode),true);
  assert.notEqual(await player.evaluate(()=>window.DuneApp.getState().activeBoardId),"test");
  console.log("Chromium : sauvegarde centrale, isolation de la vue distante et chargement joueur vérifiés.");
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
