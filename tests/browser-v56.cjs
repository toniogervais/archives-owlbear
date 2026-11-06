const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const archives="https://archives.test";
const owl="https://www.owlbear.rodeo";
const app="/archives-app-v64-v55.html";
const roomId="fixture-room";
const liveKey="fr.archives-imaginaire.bridge/live-room-v52";

function roomFixture() {
  return `<!doctype html><title>Carte Owlbear</title>
  <button type="button" id="archives-tool" disabled>Afficher les Archives</button>
  <script>
  const archives=${JSON.stringify(archives)}, roomId=location.pathname.endsWith("/isolated")?"fixture-isolated":${JSON.stringify(roomId)};
  const role=new URL(location.href).searchParams.get("role")==="player"?"PLAYER":"GM";
  const ref=btoa(location.origin+" "+roomId);
  const events=[], metadata={};
  window.fixture={events,metadata};
  function addFrame(url,id){
    const frame=document.createElement("iframe");
    const target=new URL(url);
    target.searchParams.set("obrref",ref);
    frame.id=id;
    frame.sandbox="allow-scripts allow-same-origin allow-forms allow-downloads";
    frame.style.cssText=id==="background"?"display:none":"position:fixed;inset:0;width:100%;height:100%;border:0";
    frame.addEventListener("load",()=>frame.contentWindow.postMessage({id:"OBR_READY",data:{ref:id,userId:role}},archives));
    frame.src=target.href;
    document.body.append(frame);
    return frame;
  }
  const background=addFrame(archives+"/background-v55.html","background");
  const tool=document.getElementById("archives-tool");
  let toolId;
  tool.onclick=()=>background.contentWindow.postMessage({id:"OBR_TOOL_EVENT_CLICK",data:{id:toolId,context:{}}},archives);
  window.addEventListener("message",event=>{
    if(event.origin!==archives)return;
    const {id,data,nonce}=event.data;
    let reply={};
    events.push({id,data});
    if(id==="OBR_TOOL_CREATE"){toolId=data.id;tool.disabled=false;}
    if(id==="OBR_PLAYER_GET_ROLE")reply={role};
    if(id==="OBR_PLAYER_GET_CONNECTION_ID")reply={connectionId:"fixture-"+role};
    if(id==="OBR_PARTY_GET_PLAYERS")reply={players:[]};
    if(id==="OBR_SCENE_IS_READY")reply={ready:true};
    if(id==="OBR_ROOM_GET_METADATA")reply={metadata};
    if(id==="OBR_ROOM_SET_METADATA")Object.assign(metadata,data.update);
    if(id==="OBR_MODAL_OPEN"){
      document.getElementById("viewer")?.remove();
      addFrame(data.url,"viewer");
    }
    if(nonce)event.source.postMessage({id:id+"_RESPONSE"+nonce,data:reply},archives);
    if(id==="OBR_MODAL_CLOSE"&&data.id==="fr.archives-imaginaire.bridge/archives-viewer")
      setTimeout(()=>document.getElementById("viewer")?.remove(),0);
  });
  </script>`;
}

function editorOf(room) {
  return room.frameLocator("#viewer").frameLocator("#app");
}
function frameOf(room) {
  return room.frames().find(frame=>frame.url().includes(app+"?"));
}
async function waitForRemote(room) {
  await editorOf(room).locator(".archives-bridge-notice").waitFor({state:"attached",timeout:5000});
  await frameOf(room).waitForFunction(()=>document.querySelector(".archives-bridge-notice")?.hidden===true,{},{timeout:5000});
}
async function sendDraft(frame, title) {
  await frame.evaluate(title=>{
    const node=window.DuneApp.getState().nodes[0];
    const prompt=window.prompt;
    window.prompt=()=>title;
    try{window.DuneApp.renameCellById(node.id);}
    finally{window.prompt=prompt;}
  },title);
}

(async()=>{
  const env=process.env.ARCHIVES_CHROMIUM_OPTIONS;
  const browser=await chromium.launch({headless:true,...(env?JSON.parse(env):{})});
  try {
    const context=await browser.newContext();
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===owl)return route.fulfill({contentType:"text/html",body:roomFixture()});
      if(url.origin!==archives)return route.abort(); // No PeerJS server or external scripts.
      const file=path.resolve("."+url.pathname);
      if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
      const ext=path.extname(file);
      const type=[".mjs",".js"].includes(ext)?"text/javascript":ext===".css"?"text/css":"text/html";
      return route.fulfill({path:file,contentType:type});
    });
    const main=await context.newPage();
    await main.goto(archives+"/archives.html?resume=1");
    await main.waitForURL(archives+app+"?resume=1&v=4153");
    const mapButton=main.getByRole("button",{name:"Owlbear — afficher la carte"});
    main.once("dialog",async dialog=>{assert.equal(dialog.type(),"prompt");await dialog.accept(owl+"/room/test");});
    const [room]=await Promise.all([main.waitForEvent("popup"),mapButton.click()]);
    await room.waitForURL(owl+"/room/test");
    const tool=room.locator("#archives-tool");
    await tool.click();
    await waitForRemote(room);
    const host=room.frameLocator("#viewer");
    assert.equal(await host.locator("#manual").isVisible(),false,"no code or pairing button on the direct path");
    assert.equal(await frameOf(room).evaluate(()=>location.hash),"","no secret in the editor URL");
    const expectedTitle=await main.evaluate(()=>window.ArchivesRelay.current().boards[0].nodes[0].title);
    assert.equal(await frameOf(room).evaluate(()=>window.ArchivesRelay.current().boards[0].nodes[0].title),expectedTitle);
    await sendDraft(frameOf(room),"Modification testée");
    await main.waitForFunction(()=>localStorage.getItem("jdr_architect_save_v12").includes("Modification testée"));
    await host.getByRole("button",{name:"Retour à Owlbear"}).click();
    await room.locator("#viewer").waitFor({state:"detached"});
    await main.locator(".archives-bridge-notice").waitFor({state:"hidden"});
    assert.equal(context.pages().length,2);

    // A reload preserves the room, the scenario, and the opener relationship.
    await main.reload();
    await tool.click();
    await waitForRemote(room);
    assert.equal(await frameOf(room).evaluate(()=>window.ArchivesRelay.current().boards[0].nodes[0].title),"Modification testée");
    await host.getByRole("button",{name:"Retour à Owlbear"}).click();
    await room.locator("#viewer").waitFor({state:"detached"});
    await mapButton.click();
    assert.equal(context.pages().length,2,"the existing Owlbear tab is reused");

    // The primary path can start directly in Owlbear and return without linking another tab.
    const separate=await context.newPage();
    await separate.goto(owl+"/room/isolated");
    await separate.locator("#archives-tool").click();
    await editorOf(separate).getByRole("button",{name:"Importer un scénario"}).waitFor({timeout:6000});
    await separate.frameLocator("#viewer").getByRole("button",{name:"Retour à Owlbear"}).click();
    await separate.locator("#viewer").waitFor({state:"detached",timeout:3500});

    // A player in Owlbear does not get the private editor or the fallback key.
    const player=await context.newPage();
    await player.goto(owl+"/room/test?role=player");
    await player.locator("#archives-tool").click();
    const playerHost=player.frameLocator("#viewer");
    await editorOf(player).getByText("Chargement des éléments révélés…",{exact:true}).waitFor({timeout:5000});
    assert.match(await playerHost.locator("#app").getAttribute("src"), /ro=1.*owl-view=1/);
    assert.equal(await room.evaluate(key=>window.fixture.metadata[key]||"",liveKey),"");

    // An actual save failure must keep the draft recoverable and must not close the editor.
    await tool.click();
    await waitForRemote(room);
    await main.evaluate(()=>{
      const setItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==="jdr_architect_save_v12")throw new DOMException("Test quota","QuotaExceededError");
        return setItem.call(this,key,value);
      };
    });
    await sendDraft(frameOf(room),"Brouillon non enregistré");
    await editorOf(room).getByRole("button",{name:"Télécharger les modifications"}).waitFor({timeout:5000});
    await host.getByRole("button",{name:"Retour à Owlbear"}).click();
    await host.getByText("Enregistrement non confirmé.",{exact:false}).waitFor({timeout:5500});
    assert.ok(await main.evaluate(()=>localStorage.getItem("jdr_architect_save_v12").includes("Modification testée")));
    assert.ok(await frameOf(room).evaluate(()=>window.DuneApp.getState().nodes[0].title==="Brouillon non enregistré"));

    console.log("Chromium : bascule sans code, sauvegarde, reprise après recharge, retour sans liaison, rôle joueur et protection des brouillons vérifiés.");
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
