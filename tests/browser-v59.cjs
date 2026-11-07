const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const {archives,owl,hub,configure}=require("./owlbear-fixture.cjs");
const editor=page=>page.frameLocator("#viewer").frameLocator("#app");
const appFrame=page=>page.frames().find(f=>/owl-(?:editor|view)=1/.test(f.url()));
const scenario={activeBoardId:"one",boards:[{id:"one",name:"Plan secret",links:[],nodes:[
 {id:"shown",title:"Rapport montré",desc:"Information publique",revealed:true,x:100,y:100,w:250,h:160,clues:[]},
 {id:"secret",title:"CAMPAGNE_PRIVEE_928",desc:"Dénouement secret",revealed:false,x:400,y:100,w:250,h:160,clues:[]}
]}],journalPages:[{id:"journal",title:"Journal du MJ",text:"NOTE_PRIVEE_751"}]};
(async()=>{
 const browser=await chromium.launch({headless:true,...JSON.parse(process.env.ARCHIVES_CHROMIUM_OPTIONS||"{}")});
 try{
  const fixtureHub=hub(),gmContext=await browser.newContext(),playerContext=await browser.newContext();
  await Promise.all([gmContext,playerContext].map(c=>configure(c,fixtureHub)));
  await playerContext.addInitScript(origin=>{
   if(location.origin!==origin)return;
   localStorage.setItem("jdr_architect_save_v12",JSON.stringify({boards:[{id:"local",nodes:[{title:"LOCAL_PRIVATE_BACKUP"}],links:[]}]}));
   localStorage.setItem("archives_supabase_url","https://private.example");
   localStorage.setItem("archives_supabase_public_key","unused-public-key");
   window.__cloudClients=0;
   window.supabase={createClient(){window.__cloudClients++;throw Error("Unexpected player cloud connection");}};
  },archives);
  const gm=await gmContext.newPage(),player=await playerContext.newPage(),errors=[];
  gm.on("pageerror",e=>errors.push(e.message));player.on("pageerror",e=>errors.push(e.message));
  await gm.goto(owl+"/room/one");await player.goto(owl+"/room/one?joueur=Joueur");
  await gm.locator("#archives-tool").click();
  const [chooser]=await Promise.all([gm.waitForEvent("filechooser"),editor(gm).getByRole("button",{name:"Importer un scénario"}).click()]);
  await chooser.setFiles({name:"scenario.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(scenario))});
  await editor(gm).locator(".cell-title-txt").filter({hasText:"CAMPAGNE_PRIVEE_928"}).waitFor();
  await player.frameLocator("#invite").getByRole("button",{name:"Afficher les Archives",exact:true}).click();
  await editor(player).locator(".cell-title-txt").filter({hasText:"Rapport montré"}).waitFor();
  const pf=appFrame(player);
  assert.deepEqual(await pf.evaluate(()=>({
   titles:window.DuneApp.getState().nodes.map(n=>n.title),journal:window.DuneApp.getState().journalPages,
   cloudClients:window.__cloudClients,cloudBridge:!!window.ArchivesCloudBridge
  })),{titles:["Rapport montré"],journal:[],cloudClients:0,cloudBridge:false});
  for(const id of ["archives-title-screen","archives-gm-choice-modal","archives-cloud-panel","settings-modal","settings-fab"])
   assert.equal(await editor(player).locator("#"+id).count(),0,id+" is absent from player UI");
  assert.equal(await editor(player).locator("#archives-home-fab").getAttribute("aria-label"),"Retour à Owlbear");
  await pf.evaluate(()=>{
   for(const type of ["owl-editor-ready","owl-editor-save"])window.parent.postMessage({
    protocol:"archives:owlbear:v56",type,id:crypto.randomUUID(),snapshot:{boards:[]}
   },location.origin);
   window.DuneApp.togglePlayerMode();
  });
  assert.equal(await pf.evaluate(()=>window.DuneApp.getState().strictReadOnly),true);
  assert.ok(!JSON.stringify(await pf.evaluate(()=>window.DuneApp.getState())).includes("CAMPAGNE_PRIVEE_928"));
  await editor(gm).locator("#settings-fab").click();
  const settings=editor(gm).locator("#settings-content");
  assert.deepEqual(await settings.locator(":scope > details > summary").allTextContents(),["Apparence","Sons","Sauvegardes","Options avancées"]);
  assert.equal(await settings.locator("#program-update-panel,[data-live-standalone],#btn-live-panel").count(),0);
  assert.equal(await settings.locator("#owl-settings-advanced").getAttribute("open"),null);
  await settings.locator("#owl-settings-backups > summary").click();
  const [download]=await Promise.all([gm.waitForEvent("download"),settings.getByRole("button",{name:"Sauvegarder le scénario",exact:true}).click()]);
  const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const saved=JSON.parse(Buffer.concat(chunks).toString());
  assert.ok(JSON.stringify(saved).includes("CAMPAGNE_PRIVEE_928"),"GM full backup retains hidden campaign data");
  assert.ok(JSON.stringify(saved).includes("NOTE_PRIVEE_751"),"GM journal is preserved");
  for(const id of ["up-json","v18-font-target","up-bg","sel-reveal-sound"])assert.equal(await editor(gm).locator("#"+id).count(),1,"existing control: "+id);
  await settings.locator("#owl-settings-sounds > summary").click();await settings.locator("#sel-reveal-sound").selectOption("none");
  await editor(gm).locator("#settings-modal").screenshot({path:"/tmp/archives-settings-v59.png"});
  await editor(gm).getByRole("button",{name:"Fermer les paramètres"}).click();
  await pf.evaluate(()=>window.ArchivesAccueil.enterGM());await player.locator("#viewer").waitFor({state:"detached"});
  assert.equal(playerContext.pages().length,1);
  const direct=await playerContext.newPage();await direct.goto(archives+"/archives-host-v55.html");
  await direct.locator("#message").filter({hasText:"Ouvre les Archives depuis l’icône"}).waitFor();
  assert.equal(await direct.locator("#app").getAttribute("src"),null,"direct host URL cannot load a private editor");
  assert.deepEqual(errors,[]);
  console.log("Menu simplifié, sauvegarde MJ complète, joueur sans compte ni menus MJ, rôle et accès direct vérifiés.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
