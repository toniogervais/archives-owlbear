const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const {archives,owl,hub,configure}=require("./owlbear-fixture.cjs");
const channel="fr.archives-imaginaire.bridge/room-v57";

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
    assert.equal(await prompt(player).getByRole("button").count(),2);
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

    await editor(gm).getByRole("button",{name:"Owlbear — afficher la carte"}).click();
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
