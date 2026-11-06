const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {JSDOM}=require("jsdom");
const {EventEmitter}=require("node:events");
const relay=fs.readFileSync("src/v51/relay.mjs","utf8");
async function setup(remote=false){
 const pairing="main."+"a".repeat(64);
 const dom=new JSDOM('<body><div id="canvas-integrations-dock"></div></body>',{
  url:"https://example.org/app"+(remote?"?remote=1#"+pairing:""),runScripts:"outside-only"
 });
 const peers=[], applied=[];
 class Peer extends EventEmitter{
  constructor(){super();peers.push(this);queueMicrotask(()=>this.emit("open","main"));}
  connect(){const c=new Conn();this.conn=c;return c;}
  destroy(){}
 }
 class Conn extends EventEmitter{
  constructor(secret="a".repeat(64)){super();this.metadata={secret};this.open=true;this.sent=[];this.closed=false;}
  send(m){this.sent.push(structuredClone(m));}
  close(){this.closed=true;this.emit("close");}
 }
 dom.window.Peer=Peer;
 dom.window.ArchivesRelay={loadPeer:async()=>{},snapshot:()=>({boards:[{id:"private",nodes:[{secret:"MJ"}],links:[]}]}),room:()=>"JDR-ABCD-EFGH-IJKL",apply:p=>applied.push(p)};
 dom.window.DuneApp={getState:()=>({playerMode:false})};
 dom.window.prompt=()=>{};
 if(remote)Object.defineProperty(dom.window,"parent",{value:{postMessage(){}}});
 await vm.runInContext("(async()=>{"+relay+"})()",dom.getInternalVMContext());
 if(!remote){
  dom.window.document.querySelector("button").click();
  await new Promise(r=>setImmediate(r));
 }
 return {dom,peers,Conn,applied};
}
test("Unpaired connections receive no private scenario",async()=>{
 const s=await setup();
 const bad=new s.Conn("wrong");
 s.peers[0].emit("connection",bad);
 assert.equal(bad.closed,true);assert.deepEqual(bad.sent,[]);
 s.dom.window.close();
});
test("Only one private editor receives the scenario and edits require current revision",async()=>{
 const s=await setup();
 // Use the generated secret, intercepted from crypto for this harness.
 const peer=s.peers[0];
 // A fresh harness must expose the pairing from the prompt.
 s.dom.window.prompt=(_,code)=>{s.code=code;};
 s.dom.window.document.querySelector("button").click();
 await new Promise(r=>setImmediate(r));
 const c=new s.Conn(s.code.split(".")[1]);
 peer.emit("connection",c);c.emit("open");
 assert.equal(c.sent[0].type,"state");assert.equal(c.sent[0].payload.boards[0].nodes[0].secret,"MJ");
 const second=new s.Conn(s.code.split(".")[1]);peer.emit("connection",second);second.emit("open");
 assert.equal(second.sent[0].type,"busy");assert.equal(second.closed,true);
 c.emit("data",{type:"edit",revision:0,payload:{boards:[]}});
 assert.equal(s.applied.length,1);assert.equal(c.sent.at(-1).type,"ack");
 c.emit("data",{type:"edit",revision:0,payload:{boards:[]}});
 assert.equal(s.applied.length,1);assert.equal(c.sent.at(-1).type,"state");
 c.close();assert.equal(s.dom.window.document.querySelector('[role="status"]').style.display,"none");
 s.dom.window.close();
});
test("Remote edits queue until acknowledgement and private key is removed from address",async()=>{
 const s=await setup(true);
 assert.equal(s.dom.window.location.hash,"");
 const peer=s.peers[0];await new Promise(r=>setImmediate(r));
 const c=peer.conn;
 c.emit("data",{type:"state",revision:3,payload:{boards:[]},room:""});
 const edit=n=>s.dom.window.dispatchEvent(new s.dom.window.CustomEvent("archives:edit:v51",{detail:{n}}));
 edit(1);edit(2);assert.equal(c.sent.length,1);assert.equal(c.sent[0].revision,3);
 c.emit("data",{type:"ack",revision:4});
 assert.equal(c.sent.length,2);assert.equal(c.sent[1].payload.n,2);assert.equal(c.sent[1].revision,4);
 s.dom.window.close();
});
