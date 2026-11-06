const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,"http://local").pathname);
 const file=path.resolve(root,"."+pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const ext=path.extname(file);
 res.setHeader("Content-Type",[".mjs",".js"].includes(ext)?"text/javascript":ext===".css"?"text/css":"text/html");
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:800,height:1280},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.route("**/*",route=>{
   const url=new URL(route.request().url());
   if(url.hostname==="127.0.0.1")return route.continue();
   if(url.hostname==="owlbear.rodeo"&&url.pathname==="/room/test")
    return route.fulfill({status:200,contentType:"text/html",body:"<title>Carte Owlbear test</title>"});
   return route.abort();
  });
  const base="http://127.0.0.1:"+server.address().port;
  const mj=await context.newPage();
  await mj.goto(base+"/archives-app-v62-v53.html?resume=1");
  await mj.waitForFunction(()=>!!window.ArchivesRelay&&!!window.DuneApp,{timeout:20000});
  const saved=await mj.evaluate(()=>{
   const data=JSON.parse(JSON.stringify(window.ArchivesRelay.snapshot()));
   data.boards=[{id:"central",name:"Scénario MJ",nodes:[],links:[]}];data.activeBoardId="central";
   window.ArchivesRelay.apply(data);
   return localStorage.getItem("jdr_architect_save_v12");
  });
  assert.ok(saved&&saved.includes("central"),"MJ scenario did not persist");
  const player=await context.newPage();
  await player.goto(base+"/archives-app-v62-v53.html?ro=1");
  await player.waitForFunction(()=>!!window.ArchivesRelay&&!!window.DuneApp,{timeout:20000});
  const playerState=await player.evaluate(()=>{
   const projected={boards:[{id:"public",name:"Partie",nodes:[],links:[]}],activeBoardId:"public",journalPages:[]};
   window.ArchivesRelay.apply(projected);
   window.dispatchEvent(new CustomEvent("archives:invite:v40",{detail:{
    type:"archives:invite:v40",target:"OWLBEAR",url:"https://owlbear.rodeo/room/test",id:"test"
   }}));
   const overlay=document.getElementById("archives-v40-player-invite");
   return {playerMode:window.DuneApp.getState().playerMode,buttons:overlay?.querySelectorAll("button").length,
    blur:overlay?getComputedStyle(overlay).backdropFilter:"",
    text:overlay?.querySelector("button")?.textContent||""};
  });
  assert.equal(playerState.playerMode,true);
  assert.equal(playerState.buttons,1);
  assert.match(playerState.blur,/blur\(10px\)/);
  assert.match(playerState.text,/Owlbear/);
  assert.equal(await mj.evaluate(()=>localStorage.getItem("jdr_architect_save_v12")),saved,
   "Player state overwrote MJ local save");
  await player.locator("#archives-v40-accept-invite").click();
  await player.waitForURL("https://owlbear.rodeo/room/test",{timeout:12000});
  console.log("Chromium tactile : sauvegarde privée MJ isolée, flou, bouton unique et navigation directe vers Owlbear validés.");
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
