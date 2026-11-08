const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {JSDOM}=require("jsdom"),{EventEmitter}=require("node:events");
const read=p=>fs.readFileSync(p,"utf8");
test("V4.15 URLs, syntax, secret-guarded bridge and previous graphics",()=>{
 const m=JSON.parse(read("manifest-v55.json"));
 assert.equal(m.version,"4.22.3");
 assert.match(read("archives.html"),/archives-app-v64-v55\.html/);
 assert.match(read("src/v55/host.mjs"),/archives-app-v64-v55\.html/);
 assert.match(read("archives-app-v64-v55.html"),/src\/v56\/relay\.mjs/);
 assert.match(read("archives-app-v64-v55.html"),/src\/v54\/polish\.css/);
 assert.match(read("src/v55/relay.mjs"),/conn\.metadata\?\.secret!==secret/);
 assert.match(read("src/v55/relay.mjs"),/sameSession/);
 assert.match(read("src/v55/host.mjs"),/archives:can-relink-result:v55/);
 assert.match(read("src/v55/relay.mjs"),/archives:can-relink:v55/);
 for(const p of ["src/v55/background.mjs","src/v55/navigation.mjs","src/v55/open.mjs","archives-host-v55.html","invite-v55.html","index-v55.html","background-v55.html"])
  assert.ok(fs.existsSync(p),p);
});
test("Remote auto-reconnects after tab focus and never overwrites unconfirmed edits",async()=>{
 const secret="f".repeat(64),applied=[],connections=[],peers=[];
 const dom=new JSDOM("<body></body>",{
   url:"https://toniogervais.github.io/archives-owlbear/archives-app-v64-v55.html?remote=1#bridge-remote."+secret,
   runScripts:"outside-only",pretendToBeVisual:true
 });
 const w=dom.window;
 class Connection extends EventEmitter{
   constructor(){super();this.open=true;this.messages=[];}
   send(m){this.messages.push(m)}
   close(){if(!this.open)return;this.open=false;this.emit("close")}
 }
 class Peer extends EventEmitter{
   constructor(){super();this.open=true;this.destroyed=false;this.disconnected=false;peers.push(this);queueMicrotask(()=>this.emit("open","remote"))}
   connect(id,options){
     assert.equal(id,"bridge-remote");assert.equal(options.metadata.secret,secret);
     assert.match(options.metadata.session,/^[a-f0-9]{32}$/);
   const c=new Connection();connections.push(c);return c;
   }
   reconnect(){this.disconnected=false;this.open=true;queueMicrotask(()=>this.emit("open","remote"))}
   destroy(){this.destroyed=true}
 }
 w.Peer=Peer;
 w.ArchivesRelay={
   loadPeer:async()=>{},
   apply:p=>{applied.push(p)},
   snapshot:()=>({}),
   room:()=>null
 };
 try{
   await w.eval("(async()=>{\n"+read("src/v55/relay.mjs")+"\n})()");
   await new Promise(resolve=>setTimeout(resolve,15));
   assert.equal(connections.length,1,"first handshake");
   connections[0].emit("data",{type:"state",revision:1,payload:{id:"first"},room:""});
   assert.deepEqual(applied,[{id:"first"}]);
   assert.equal(w.document.querySelector('[role="status"]').style.display,"none");
   peers[0].disconnected=true;
   peers[0].emit("disconnected");
   await new Promise(resolve=>setTimeout(resolve,5));
   assert.equal(connections.length,1,"signalling interruption alone must not close a live data channel");
   connections[0].close();
   assert.match(w.document.querySelector('[role="status"]').textContent,/Reconnexion automatique/);
   w.dispatchEvent(new w.Event("focus"));
   assert.equal(connections.length,2,"return to active tab should reconnect immediately");
   connections[1].emit("data",{type:"state",revision:2,payload:{id:"second"},room:""});
   assert.deepEqual(applied,[{id:"first"},{id:"second"}]);
   assert.equal(w.document.querySelector('[role="status"]').style.display,"none");
   w.dispatchEvent(new w.CustomEvent("archives:edit:v55",{detail:{id:"unconfirmed"}}));
   assert.equal(connections[1].messages.at(-1).type,"edit");
   connections[1].close();
   assert.match(w.document.querySelector('[role="status"]').textContent,/modifications ne sont pas encore confirmées/i);
   w.dispatchEvent(new w.Event("focus"));
   assert.equal(connections.length,2,"must not reconnect and overwrite pending changes");
 }finally{dom.window.close()}
});
test("Only fully revealed arrows animate, player secrets stay private",()=>{
 const html=read("archives-app-v64-v55.html");
 assert.match(html,/lk\.revealed && item\.n1\.revealed && item\.n2\.revealed/);
 assert.match(html,/state\.playerMode && !visibleForPlayers/);
 assert.match(html,/if \(!state\.strictReadOnly && !state\.playerMode\)/);
 assert.match(read("src/v55/background.mjs"),/p\.role==="GM"&&p\.connectionId===event\.connectionId/);
});
test("A screen invitation accepts the first click only after the SDK and its first painted frames are ready",async()=>{
 const html=read('invite-v55.html'),dom=new JSDOM(html,{url:'https://archives.test/invite-v55.html#OWLBEAR&room=1',runScripts:'outside-only'});
 const w=dom.window,closed=[],paints=[];let ready;
 w.requestAnimationFrame=callback=>paints.push(callback);
 w.testOBR={onReady:fn=>{ready=fn},modal:{close:async id=>{closed.push(id)}}};
 const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
 try{
  const startup=w.eval('(async()=>{const OBR=window.testOBR,archivesUrl=()=>"/archives-host-v55.html",localRoom=async()=>({channel:{postMessage(){},close(){}}});'+source+'})()');
  const button=w.document.getElementById('accept');
  assert.equal(button.disabled,true);button.click();assert.deepEqual(closed,[]);
  ready();await new Promise(setImmediate);assert.equal(button.disabled,true);assert.equal(paints.length,1);
  paints.shift()();assert.equal(button.disabled,true);assert.equal(paints.length,1);
  paints.shift()();await startup;assert.equal(button.disabled,false);
  button.click();await new Promise(setImmediate);
  assert.deepEqual(closed,['fr.archives-imaginaire.bridge/archives-viewer','fr.archives-imaginaire.bridge/screen-invite-v55']);
 }finally{w.close()}
});

