const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const src=fs.readFileSync(path.resolve(__dirname,"../archives-app-v56-v47.html"),"utf8");
function projection(){
 const start=src.indexOf("// BEGIN SECURITY: player projection V4.7");
 const end=src.indexOf("// END SECURITY: player projection V4.7",start);
 assert.ok(start>=0&&end>start,"projection is present");
 const source=src.slice(start,end)+"\nprojectPlayerPayload;";
 return vm.runInNewContext(source,{Set,Array,Number,String,Object},{timeout:2000});
}
const sample={
 boards:[
  {id:"b1",name:"Chapitre secret : le traître est Emma",
   nodes:[
    {id:"public",title:"Héros révélé",category:"personnage",desc:"Vu par tous",
     revealed:true,x:100,y:200,clues:[
       {id:"c1",text:"Indice montré",revealed:true},
       {id:"c2",text:"La clef est sous le lit",revealed:false}
     ],notes:"mot de passe du MJ",secret:"les traîtres sont ici"},
    {id:"secret",title:"Le grand méchant secret",desc:"La fin de la campagne",
     revealed:false,clues:[{id:"c3",text:"indice invisible",revealed:true}]}
   ],
   links:[
    {id:"l1",from:"public",to:"secret",revealed:true,label:"Complice secret"},
    {id:"l2",from:"public",to:"public",revealed:true,label:"Visible",clues:[
      {id:"l2c",text:"indice de lien secret",revealed:false}
    ]}
   ]
  },
  {id:"b2",name:"La révélation finale",nodes:[],links:[]}
 ],
 activeBoardId:"b1",
 journalPages:[{id:"j1",text:"Journal secret MJ"}],
 playerLayout:{public:{x:9,y:10},secret:{x:666,y:777}},
 nextRevCounter:10,skinName:"imperial",bgImage:"URL secrète",
 revealedNodeId:"secret",revealedLinkId:"l1"
};
test("Only published cells and clues are transmitted",()=>{
 const out=projection()(sample);
 const text=JSON.stringify(out);
 assert.match(text,/Héros révélé/);
 assert.match(text,/Indice montré/);
 for(const secret of ["La clef est sous le lit","Le grand méchant secret",
   "La fin de la campagne","mot de passe du MJ","Journal secret MJ",
   "La révélation finale","Chapitre secret","Complice secret",
   "indice de lien secret","URL secrète"]){
  assert.ok(!text.includes(secret),"Private field leaked: "+secret);
 }
 assert.equal(out.boards[0].nodes.length,1);
 assert.equal(out.boards[0].nodes[0].clues.length,1);
 assert.equal(out.boards[0].links.length,1);
 assert.equal(out.boards[0].links[0].label,"Visible");
 assert.ok(!Object.hasOwn(out.playerLayout,"secret"));
 assert.equal(out.revealedNodeId,null);
 assert.deepEqual(JSON.parse(JSON.stringify(out.journalPages)),[]);
});
test("Only reveal === true can leave the GM browser",()=>{
 const out=projection()({boards:[{id:"one",nodes:[
  {id:"false",revealed:false,title:"secret1"},
  {id:"missing",title:"secret2"},
  {id:"str",revealed:"true",title:"secret3"}
 ],links:[]}],activeBoardId:"one"});
 assert.equal(out.boards[0].nodes.length,0);
 assert.ok(!JSON.stringify(out).includes("secret"));
});
test("Sender sanitizes payload before WebRTC and BroadcastChannel",()=>{
 const section=src.slice(src.indexOf("function saveState("),src.indexOf("function loadState("));
 assert.match(section,/localStorage\.setItem\("jdr_architect_save_v12", JSON\.stringify\(payload\)\)/);
 assert.match(section,/var publicPayload=projectPlayerPayload\(payload\)/);
 assert.match(section,/syncChannel\.postMessage\(publicPayload\)/);
 assert.match(section,/peerConns\[i\]\.send\(publicPayload\)/);
 assert.doesNotMatch(section,/peerConns\[i\]\.send\(payload\)/);
});
test("A GM tab ignores player-only BroadcastChannel messages",()=>{
 const section=src.slice(src.indexOf('syncChannel = new BroadcastChannel'),src.indexOf('function bindActiveBoardRefs('));
 assert.match(section,/state\.playerMode \|\| state\.strictReadOnly/);
 assert.match(section,/applyIncomingSync\(e\.data\)/);
});
test("Player mode does not restore private MJ backup from localStorage",()=>{
 const section=src.slice(src.indexOf("function loadState("),src.indexOf("function esc("));
 assert.match(section,/if \(state\.playerMode \|\| state\.strictReadOnly\) return;\s*try \{\s*var raw = window\.localStorage\.getItem/);
});
test("Live room codes no longer have only four digits",()=>{
 assert.match(src,/crypto\.getRandomValues\(new Uint8Array\(12\)\)/);
 assert.doesNotMatch(src,/var code = "JDR-" \+ Math\.floor\(1000 \+ Math\.random\(\) \* 9000\)/);
});
test("Unsafe player HTML export is disabled",()=>{
 const section=src.slice(src.indexOf("downloadReadOnlyPlayerHtml: function()"),src.indexOf("openPlayerTab: function()"));
 assert.match(section,/temporairement désactivé/);
 assert.doesNotMatch(section,/JSON\.stringify\(\{\s*boards: state\.boards/);
});
test("Player progression export uses the safe projection",()=>{
 const section=src.slice(src.indexOf("exportPlayerProgression: function()"),src.indexOf("importPlayerProgression: function()"));
 assert.match(section,/projectPlayerPayload/);
 assert.doesNotMatch(section,/journalPages: state\.journalPages/);
});
test("MJ local full backup is still saved",()=>{
 assert.match(src,/localStorage\.setItem\("jdr_architect_save_v12"/);
});
