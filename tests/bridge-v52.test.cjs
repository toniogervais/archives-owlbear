const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const {EventEmitter}=require("node:events");
const read=p=>fs.readFileSync(p,"utf8");
const relay=read("src/v52/relay.mjs");
const host=read("src/v52/host.mjs");
test("Manifest V4.12 and all local entrypoints are present",()=>{
 const manifest=JSON.parse(read("manifest-v52.json"));
 assert.equal(manifest.version,"4.12.0");
 for(const link of [manifest.background_url,manifest.action.popover,manifest.action.icon])
  assert.ok(fs.existsSync(new URL(link).pathname.split("/").at(-1)));
 for(const script of ["background","navigation","host","open","embedded","relay"])
  assert.ok(fs.existsSync("src/v52/"+script+".mjs"));
 assert.ok(read("archives-app-v61-v52.html").includes("src/v52/relay.mjs"));
 assert.ok(host.includes("archives-app-v61-v52.html"));
});
async function relayHarness(persist){
 const dom=new JSDOM('<body><div id="canvas-integrations-dock"></div></body>',{
  url:"https://example.org/archives",runScripts:"outside-only"});
 const pairs=[];
 class Connection extends EventEmitter{
  constructor(secret){super();this.metadata={secret};this.open=true;this.sent=[];}
  send(message){this.sent.push(structuredClone(message));}
  close(){this.open=false;this.emit("close");}
 }
 class Peer extends EventEmitter{
  constructor(){super();pairs.push(this);queueMicrotask(()=>this.emit("open","main"));}
  destroy(){}
 }
 dom.window.Peer=Peer;
 let doc={boards:[{id:"b",nodes:[],links:[]}],activeBoardId:"b"};
 dom.window.ArchivesRelay={
  loadPeer:async()=>{},
  snapshot:()=>doc,
  room:()=>"JDR-LIVE-ABCDE",
  apply:data=>{doc=data;if(persist)dom.window.localStorage.setItem("jdr_architect_save_v12",JSON.stringify(doc));}
 };
 dom.window.DuneApp={getState:()=>({playerMode:false})};
 dom.window.prompt=(_message,value)=>{dom.window.pairCode=value;};
 await vm.runInContext("(async()=>{"+relay+"})()",dom.getInternalVMContext());
 dom.window.document.querySelector("button").click();
 await new Promise(r=>setImmediate(r));
 return {dom,pairs,Connection};
}
for(const persist of [true,false]){
 test("Main relay "+(persist?"acknowledges only persisted edits":"rejects edits when storage did not persist"),async()=>{
  const {dom,pairs,Connection}=await relayHarness(persist);
  const connection=new Connection(dom.window.pairCode.split(".")[1]);
  pairs[0].emit("connection",connection);
  connection.emit("open");
  connection.emit("data",{type:"edit",revision:0,payload:{boards:[{id:"new",nodes:[],links:[]}],activeBoardId:"new"}});
  assert.equal(connection.sent.at(-1).type,persist?"ack":"persist-error");
  if(persist)assert.equal(JSON.parse(dom.window.localStorage.getItem("jdr_architect_save_v12")).activeBoardId,"new");
  dom.window.close();
 });
}
test("Local fallback tokens exist and can be passed as SVG images without secrets",()=>{
 const sender=read("src/v50/archives-transfer.mjs");
 const receiver=read("src/v46/transfer-receiver.mjs");
 for(const name of ["personnage","lieu","objet"]){
  const path="token-"+name+"-v45.svg";
  const svg=read(path);
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(sender.includes(path));
 }
 assert.match(receiver,/image\/svg\+xml/);
 assert.match(sender,/Seuls le nom et l'image de la cellule seront transmis/);
 assert.doesNotMatch(sender,/node\.clues,/);
 assert.doesNotMatch(sender,/node\.desc,/);
});
test("Stable launcher targets the latest complete Archives",()=>{
 const launcher=read("archives.html");
 assert.match(launcher,/location\.replace\(target\.href\)/);
 assert.match(launcher,/archives-app-v6(?:1-v52|2-v53|3-v54|4-v55)\.html/);
});
test("No silent overwrite on conflicts and return waits for central acknowledgement",()=>{
 assert.match(relay,/if\(inFlight\|\|pending\)/);
 assert.match(relay,/type:"archives:flush-error:v52"/);
 assert.match(relay,/type:"map-ack"/);
 assert.match(host,/type:"archives:flush:v52"/);
 assert.match(host,/type==="archives:flushed:v52"/);
});
test("Security controls and one-click tool remain present",()=>{
 const bg=read("src/v52/background.mjs");
 assert.match(bg,/OBR\.tool\.create/);
 assert.match(bg,/fullScreen:true/);
 assert.match(bg,/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
 assert.match(relay,/conn\.metadata\?\.secret!==secret/);
 const app=read("archives-app-v61-v52.html");
 assert.match(app,/BEGIN SECURITY: player projection V4\.7/);
 assert.match(app,/if \(state\.playerMode \|\| state\.strictReadOnly \|\| remoteEditor\) return/);
});
