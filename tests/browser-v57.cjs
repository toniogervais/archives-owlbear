const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const archives="https://archives.test";
const owl="https://www.owlbear.rodeo";
const viewerId="fr.archives-imaginaire.bridge/archives-viewer";
const inviteId="fr.archives-imaginaire.bridge/screen-invite-v55";
const channel="fr.archives-imaginaire.bridge/room-v57";

function fixture() {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Salle Owlbear</title>
  <button id="archives-tool" disabled>Afficher les Archives</button>
  <script>
  const archives=${JSON.stringify(archives)}, viewerId=${JSON.stringify(viewerId)}, inviteId=${JSON.stringify(inviteId)};
  const params=new URLSearchParams(location.search);
  const role=params.has("joueur")?"PLAYER":"GM";
  const name=params.get("joueur")||"MJ";
  const connectionId="fixture-"+name;
  const player={role,name,connectionId};
  const ref=btoa(location.origin+" fixture-single-room");
  const listeners=new Map();
  function post(frame,id,data){frame?.contentWindow.postMessage({id,data},archives);}
  function modalFrame(id){
    return document.getElementById(id===viewerId?"viewer":id===inviteId?"invite":id);
  }
  function addFrame(url,id){
    modalFrame(id)?.remove();
    const frame=document.createElement("iframe");
    const target=new URL(url);
    target.searchParams.set("obrref",ref);
    frame.id=id===viewerId?"viewer":id===inviteId?"invite":id;
    frame.sandbox="allow-same-origin allow-scripts allow-downloads allow-forms";
    frame.style.cssText=id==="background"?"display:none":"position:fixed;inset:0;width:100%;height:100%;border:0";
    frame.addEventListener("load",()=>post(frame,"OBR_READY",{ref:frame.id,userId:connectionId}));
    frame.src=target.href;
    document.body.append(frame);
    return frame;
  }
  window.fixture={
    publish:(channel,data)=>fixtureHub("broadcast",{channel,data}),
    deliver(channel,event){
      for(const frame of document.querySelectorAll("iframe"))
        if(listeners.get(frame.contentWindow)?.has(channel))
          post(frame,"OBR_BROADCAST_MESSAGE_"+channel,event);
    },
    party(players){
      for(const frame of document.querySelectorAll("iframe"))post(frame,"OBR_PARTY_EVENT_CHANGE",{players});
    }
  };
  window.addEventListener("message",event=>{
    if(event.origin!==archives)return;
    const {id,data,nonce}=event.data;
    void (async()=>{
      let reply={};
      switch(id){
        case "OBR_TOOL_CREATE":
          const tool=document.getElementById("archives-tool");
          tool.disabled=false;
          tool.onclick=()=>post(modalFrame("background"),"OBR_TOOL_EVENT_CLICK",{id:data.id,context:{}});
          break;
        case "OBR_PLAYER_GET_ROLE": reply={role};break;
        case "OBR_PLAYER_GET_CONNECTION_ID": reply={connectionId};break;
        case "OBR_SCENE_IS_READY": reply={ready:false};break;
        case "OBR_PARTY_GET_PLAYERS": reply={players:await fixtureHub("party")};break;
        case "OBR_ROOM_GET_METADATA": reply={metadata:await fixtureHub("metadata")};break;
        case "OBR_ROOM_SET_METADATA": await fixtureHub("setMetadata",data.update);break;
        case "OBR_BROADCAST_SUBSCRIBE":
          if(!listeners.has(event.source))listeners.set(event.source,new Set());
          listeners.get(event.source).add(data.channel);
          break;
        case "OBR_BROADCAST_UNSUBSCRIBE":
          listeners.get(event.source)?.delete(data.channel);
          break;
        case "OBR_BROADCAST_SEND_MESSAGE": await fixtureHub("broadcast",data);break;
        case "OBR_MODAL_OPEN": addFrame(data.url,data.id);break;
        case "OBR_MODAL_CLOSE": setTimeout(()=>modalFrame(data.id)?.remove(),0);break;
      }
      if(nonce)event.source.postMessage({id:id+"_RESPONSE"+nonce,data:reply},archives);
    })().catch(console.error);
  });
  fixtureHub("join",player).then(()=>addFrame(archives+"/background-v55.html?v=4153","background"));
  </script>`;
}

function hub() {
  const pages=new Map(), metadata={};
  const players=page=>Array.from(pages).filter(([other])=>other!==page&&!other.isClosed()).map(([,p])=>p);
  const notify=async()=>Promise.allSettled(Array.from(pages.keys()).filter(page=>!page.isClosed())
    .map(page=>page.evaluate(participants=>window.fixture.party(participants),players(page))));
  return async ({page}, op, value) => {
    if(op==="join"){pages.set(page,value);void notify();return;}
    if(op==="party")return players(page);
    if(op==="metadata")return metadata;
    if(op==="setMetadata"){Object.assign(metadata,value);return;}
    if(op==="broadcast"){
      const sender=pages.get(page);
      assert.ok(sender);
      assert.ok(Buffer.byteLength(JSON.stringify(value.data))<16384,"Owlbear message size");
      await Promise.allSettled(Array.from(pages.keys()).filter(other=>other!==page&&!other.isClosed())
        .map(other=>other.evaluate(({channel,event})=>window.fixture.deliver(channel,event),
          {channel:value.channel,event:{data:value.data,connectionId:sender.connectionId}})));
    }
  };
}
async function configure(context, fixtureHub) {
  await context.exposeBinding("fixtureHub",fixtureHub);
  await context.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.origin===owl)return route.fulfill({contentType:"text/html",body:fixture()});
    if(url.origin!==archives)return route.abort();
    const file=path.resolve("."+url.pathname);
    if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
    const ext=path.extname(file);
    return route.fulfill({path:file,contentType:[".mjs",".js"].includes(ext)?"text/javascript":ext===".css"?"text/css":"text/html"});
  });
}

const host=page=>page.frameLocator("#viewer");
const editor=page=>host(page).frameLocator("#app");
const prompt=page=>page.frameLocator("#invite");
const scenario={
  activeBoardId:"case",
  boards:[{id:"case",name:"Nom privé de l’acte",links:[],nodes:[
    {id:"public",title:"Le rapport publié",desc:"Une information partagée",category:"objet",revealed:true,
      x:100,y:100,w:250,h:160,clues:[
        {id:"visible",text:"Indice visible",revealed:true},
        {id:"private",text:"Indice gardé secret",revealed:false}
      ]},
    {id:"hidden",title:"Témoin caché",category:"personnage",revealed:false,x:400,y:100,w:250,h:160,clues:[]}
  ]}],
  journalPages:[{id:"private",title:"Journal privé du MJ",text:"Note à garder pour soi"}]
};

(async()=>{
  const options=process.env.ARCHIVES_CHROMIUM_OPTIONS;
  const browser=await chromium.launch({headless:true,...(options?JSON.parse(options):{})});
  try {
    const fixtureHub=hub();
    const gmContext=await browser.newContext();
    const tablet=await browser.newContext({viewport:{width:820,height:1180},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const lateContext=await browser.newContext();
    await Promise.all([gmContext,tablet,lateContext].map(context=>configure(context,fixtureHub)));
    const gm=await gmContext.newPage(), player=await tablet.newPage();
    await gm.goto(owl+"/room/one");
    await player.goto(owl+"/room/one?joueur=Alix");
    await player.locator("#archives-tool").waitFor();
    assert.equal(await player.locator("#invite").count(),0);
    await gm.locator("#archives-tool").click();
    const [chooser]=await Promise.all([
      gm.waitForEvent("filechooser"),
      editor(gm).getByRole("button",{name:"Importer un scénario"}).click()
    ]);
    await chooser.setFiles({name:"scenario.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(scenario))});
    await editor(gm).getByText("Témoin caché",{exact:false}).first().waitFor({timeout:10000});
    const invite=prompt(player).getByRole("button",{name:"Afficher les Archives"});
    await invite.waitFor({timeout:12000});
    assert.equal(await prompt(player).getByRole("button").count(),1);
    assert.ok((await prompt(player).locator("#veil").evaluate(el=>getComputedStyle(el).backdropFilter)).includes("blur"));
    assert.equal(await player.locator("#viewer").count(),0,"no automatic switch");
    await invite.tap();
    await editor(player).locator(".cell-title-txt").filter({hasText:/Le rapport publié/i}).waitFor({timeout:12000});
    const playerFrame=player.frames().find(frame=>frame.url().includes("owl-view=1"));
    const data=await playerFrame.evaluate(()=>{
      const state=window.DuneApp.getState();
      window.DuneApp.togglePlayerMode();
      return {nodes:state.nodes.map(n=>({title:n.title,clues:n.clues})),readOnly:state.strictReadOnly,
        playerMode:state.playerMode,journal:state.journalPages};
    });
    assert.deepEqual(data.nodes.map(node=>node.title),["Le rapport publié"]);
    assert.deepEqual(data.nodes[0].clues.map(clue=>clue.text),["Indice visible"]);
    assert.deepEqual(data.journal,[]);
    assert.equal(data.readOnly,true);
    assert.equal(data.playerMode,true);
    assert.equal(await editor(player).locator("#quick-mode-switch").isVisible(),false);

    const late=await lateContext.newPage();
    await late.goto(owl+"/room/one?joueur=Noa");
    await prompt(late).getByRole("button",{name:"Afficher les Archives"}).waitFor({timeout:12000});
    await prompt(late).locator("#veil").click({position:{x:5,y:5}});
    await late.locator("#invite").waitFor({state:"detached"});

    // A second player cannot prompt a screen change on another device.
    await late.evaluate(channel=>window.fixture.publish(channel,
      {type:"screen",target:"OWLBEAR",id:crypto.randomUUID()}),channel);
    assert.equal(await player.locator("#invite").count(),0);

    await host(gm).getByRole("button",{name:"Retour à Owlbear"}).click();
    await gm.locator("#viewer").waitFor({state:"detached"});
    const toMap=prompt(player).getByRole("button",{name:"Afficher la carte Owlbear"});
    await toMap.waitFor({timeout:10000});
    assert.equal(await player.locator("#viewer").count(),1);
    await toMap.tap();
    await player.locator("#viewer").waitFor({state:"detached"});
    await player.locator("#invite").waitFor({state:"detached"});
    assert.equal(await late.locator("#invite").count(),0,"player already on the map gets no redundant invitation");

    await gm.locator("#archives-tool").click();
    await editor(gm).locator(".cell-title-txt").filter({hasText:/Témoin caché/i}).waitFor({timeout:10000});
    await prompt(player).getByRole("button",{name:"Afficher les Archives"}).tap({timeout:10000});
    await editor(player).locator(".cell-title-txt").filter({hasText:/Le rapport publié/i}).waitFor({timeout:12000});
    const gmFrame=gm.frames().find(frame=>frame.url().includes("owl-editor=1"));
    await gmFrame.evaluate(()=>window.DuneApp.toggleRevealById("hidden"));
    await editor(player).locator(".cell-title-txt").filter({hasText:/Témoin caché/i}).waitFor({timeout:12000});
    assert.equal(gmContext.pages().length,1);
    assert.equal(tablet.pages().length,1);
    assert.equal(lateContext.pages().length,1);
    console.log("Owlbear simulé : un onglet par personne, import et sauvegarde MJ, invitations aller-retour, joueur tardif, révélations et protection des secrets.");
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
