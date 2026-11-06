const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const {JSDOM}=require("jsdom");

test("MJ transfers the selected cell and library portrait without private notes",async()=>{
  const dom=new JSDOM('<div id="active-editor-modal"><button onclick="DuneApp.toggleSelectedReveal()"></button></div><button id="ctx-send-to-owlbear"></button>',{
    url:"https://example.test",runScripts:"outside-only"
  });
  const {window}=dom;
  const node={id:"character-1",title:"Sam",category:"personnage",desc:"Secret",clues:["Indice privé"]};
  const state={nodes:[node],selectedId:node.id,activeBoardId:"act-1"};
  const rows=[];
  const responses={
    campaigns:[{id:"campaign-1",name:"Shadowrun"}],
    owlbear_room_links:[{campaign_id:"campaign-1",room_id:"room-1"}],
    campaign_live_state:{owlbear_scene_id:"scene-1"}
  };
  window.DuneApp={getState:()=>state};
  window.ArchivesCloudBridge={getClient:()=>({
    auth:{getUser:async()=>({data:{user:{id:"owner"}}})},
    from(table){
      const query={
        select:()=>query,eq:()=>query,
        then:resolve=>resolve({data:responses[table]}),
        maybeSingle:async()=>({data:responses[table]}),
        insert:async payload=>{rows.push(payload);return {}}
      };
      return query;
    },
    storage:{from:()=>({
      upload:async()=>({}),getPublicUrl:()=>({data:{publicUrl:"https://example.test/portrait.png"}})
    })}
  })};
  let approved=true,loadedPortrait=false,cropped=false;
  window.confirm=message=>{assert.match(message,/Shadowrun/);return approved};
  window.fetch=async()=>{loadedPortrait=true;return {ok:true,blob:async()=>new window.Blob(["pixels"],{type:"image/jpeg"})}};
  window.createImageBitmap=async()=>({width:200,height:100,close(){}});
  window.URL.createObjectURL=()=>"blob:portrait";
  window.URL.revokeObjectURL=()=>{};
  window.Image=class {set src(value){queueMicrotask(()=>this.onload())}};
  window.HTMLCanvasElement.prototype.getContext=()=>({
    beginPath(){},arc(){},clip(){},
    drawImage(_,x,y,w,h){assert.deepEqual([x,y,w,h],[50,0,100,100]);cropped=true}
  });
  window.HTMLCanvasElement.prototype.toBlob=callback=>callback(new window.Blob(["pion"],{type:"image/png"}));
  try{
    const source=fs.readFileSync("src/v55/archives-transfer.mjs","utf8")
      .replaceAll("import.meta.url",JSON.stringify("https://example.test/src/v55/archives-transfer.mjs"));
    window.eval(source);
    await window.ArchivesCellTransfer.sendSelected();
    approved=false;
    const portrait={id:"portrait-1",name:"Honorine",category:"personnage",data:"data:image/jpeg;base64,AAAA"};
    await window.ArchivesCellTransfer.sendImage(portrait);
    assert.equal(loadedPortrait,false,"no upload preparation before consent");
    approved=true;
    await window.ArchivesCellTransfer.sendImage(portrait);
    assert.equal(cropped,true);
    state.playerMode=true;
    await window.ArchivesCellTransfer.sendImage(portrait);
    assert.equal(rows.length,2);
    assert.deepEqual(rows.map(r=>[r.title,r.item_layer,r.source_board_id,r.source_node_id,r.image_width]),[
      ["Sam","CHARACTER","act-1","character-1",256],
      ["Honorine","CHARACTER","bibliotheque-images","portrait-1",512]
    ]);
    assert.doesNotMatch(JSON.stringify(rows),/Indice privé|Secret/);
  }finally{window.close()}
});

test("Owlbear updates the same token and keeps its position on a repeated transfer",async()=>{
  const items=[];
  const sceneKey="scene-1";
  const OBR={
    room:{id:"room-1"},
    player:{getRole:async()=>"GM"},
    viewport:{getWidth:async()=>200,getHeight:async()=>100,inverseTransformPoint:async p=>p},
    scene:{
      isReady:async()=>true,getMetadata:async()=>({key:sceneKey}),
      items:{
        getItems:async()=>items,
        addItems:async values=>items.push(...values),
        updateItems:async(values,update)=>update(values)
      }
    }
  };
  function buildImage(image,grid){
    const item={type:"IMAGE",image,grid};
    const builder={build:()=>item};
    for(const field of ["id","name","plainText","textItemType","layer","position","metadata","visible"]){
      builder[field]=value=>{item[field]=value;return builder};
    }
    return builder;
  }
  const source=fs.readFileSync("src/v55/transfer-receiver.mjs","utf8").replace(/^import .*;$/gm,"").replace("export function","function");
  const apply=vm.runInNewContext(source+"\napply",{
    OBR,buildImage,SCENE_KEY:"key",crypto:webcrypto,TextEncoder,URL,console
  });
  const row={
    room_id:"room-1",scene_key:sceneKey,campaign_id:"campaign-1",
    source_board_id:"act-1",source_node_id:"character-1",title:"Sam",
    item_layer:"CHARACTER",image_url:"https://example.test/token.png",
    image_mime:"image/png",image_width:512,image_height:512
  };
  const id=await apply(row);
  assert.equal(items[0].layer,"CHARACTER");
  assert.equal(items[0].grid.offset.x,256);
  items[0].position={x:400,y:300};
  assert.equal(await apply({...row,title:"Sam masqué"}),id);
  assert.equal(items.length,1);
  assert.equal(items[0].name,"Sam masqué");
  assert.deepEqual(items[0].position,{x:400,y:300});
  await assert.rejects(apply({...row,scene_key:"other-scene"}),/scène Owlbear a changé/);
  await apply({...row,source_node_id:"map-1",item_layer:"MAP",placement_x:-60,placement_y:12,placement_dpi:175});
  assert.equal(items[1].position.x,-60);
  assert.equal(items[1].position.y,12);
  assert.equal(items[1].grid.dpi,175);
});
