// V4.5 - Réception des cellules volontairement transférées par le MJ.
// Fonctionne dans l'extension Owlbear, jamais comme extension Chrome/Edge/Opera.
import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { c as createClient } from "../../assets/index-D5xPhma_.js";
import { publicConfig, SCENE_KEY } from "../v37/session.mjs";
// Load the builder only when processing a transfer. If the CDN is blocked,
// the rest of the Owlbear navigation and invitation system stays operational.
let buildImagePromise=null;
async function getBuildImage(){
  if(!buildImagePromise)buildImagePromise=import("https://esm.sh/@owlbear-rodeo/sdk@2.4.0?bundle")
    .then(async module=>{
      // The dynamically loaded builder has its OWN SDK instance. It must
      // receive OBR_READY before it can set the creating player's ID.
      const sdk=module.default;
      if(!sdk?.isAvailable)throw Error("Connexion au SDK de création de token indisponible.");
      if(!sdk.isReady){
        await new Promise((resolve,reject)=>{
          let unsub=null;
          const timer=setTimeout(()=>{
            unsub?.();
            reject(new Error("Le SDK de création de token ne s'initialise pas dans Owlbear."));
          },8000);
          unsub=sdk.onReady(()=>{clearTimeout(timer);unsub?.();resolve()});
        });
      }
      return module.buildImage;
    }).catch(error=>{buildImagePromise=null;throw error});
  const builder=await buildImagePromise;
  if(typeof builder!=="function")throw Error("Constructeur de token Owlbear indisponible.");
  return builder;
}

const TABLE="archives_owlbear_cell_transfers";
const SOURCE_KEY="fr.archives-imaginaire.bridge/source-cell-v45";
let client=null;
let busy=false;
let disposed=false;
let lastError="";
let authUser=null;
let lastAuthAt=0;
const delay=4500;
const same=(a,b)=>a.campaignId===b.campaignId && a.boardId===b.boardId && a.nodeId===b.nodeId;
const message=async(text)=>{try{await OBR.notification.show(String(text).slice(0,180),"INFO")}catch{}};
async function spawnPosition(){
  // Place a new token in the middle of the GM's current view, not at (0,0).
  // An old scene or a hidden viewport may still return a fallback origin.
  try{
    const size=await Promise.all([OBR.viewport.getWidth(),OBR.viewport.getHeight()]);
    const point=await OBR.viewport.inverseTransformPoint({x:size[0]/2,y:size[1]/2});
    if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))return point;
  }catch(error){console.warn("Position du viewport indisponible",error)}
  return {x:0,y:0};
}

async function ownerSession(){
  if(!client)await connect();
  // Do not assume the embedded extension shares the top-level Archives login.
  // If the session has not been initialized in the Owlbear extension, processing
  // pauses until the MJ signs in via the Owlbear connection panel.
  if(!authUser || Date.now()-lastAuthAt>30000){
    const r=await client.auth.getUser();
    if(r.error)throw r.error;
    authUser=r.data?.user||null;
    lastAuthAt=Date.now();
  }
  return authUser;
}
async function connect(){
  if(client)return client;
  const {url,key}=publicConfig(localStorage);
  client=createClient(url,key,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  return client;
}
function meta(row){
  return {campaignId:row.campaign_id,boardId:row.source_board_id,nodeId:row.source_node_id};
}
function safeImage(row){
  const url=new URL(row.image_url);
  if(url.protocol!=="https:"||url.username||url.password)throw Error("Image non sécurisée.");
  const mime=row.image_mime;
  if(!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(mime))
    throw Error("Format image non autorisé.");
  const width=Number(row.image_width),height=Number(row.image_height);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
     width>12000||height>12000)throw Error("Dimensions image invalides.");
  return {url:url.href,mime,width,height};
}
async function apply(row,scene){
  const itemMeta=meta(row);
  const image=safeImage(row);
  const all=await OBR.scene.items.getItems();
  // Repeated send updates the previously transferred item rather than duplicating it.
  const existing=all.find(item=>item.type==="IMAGE" &&
    item.metadata?.[SOURCE_KEY] && same(item.metadata[SOURCE_KEY],itemMeta));
  const {width,height}=image;
  const grid={dpi:row.item_layer==="MAP"?150:Math.max(width,height),
    offset:{x:0,y:0}};
  if(existing){
    await OBR.scene.items.updateItems([existing],draft=>{
      const item=draft[0];
      item.name=row.title;
      item.image=image;
      item.grid=grid;
      item.layer=row.item_layer;
      item.text={...(item.text||{}),type:"PLAIN",plainText:row.title};
      item.metadata={...item.metadata,[SOURCE_KEY]:itemMeta};
    });
    return existing.id;
  }
  // Characters are automatically placed on Owlbear's CHARACTER layer.
  const buildImage=await getBuildImage();
  const position=await spawnPosition();
  const item=buildImage(image,grid)
    .id(row.id)
    .name(row.title)
    .plainText(row.title)
    .textItemType("LABEL")
    .layer(row.item_layer)
    .position(position)
    .metadata({[SOURCE_KEY]:itemMeta})
    .visible(true)
    .build();
  await OBR.scene.items.addItems([item]);
  return item.id;
}
async function poll(){
  if(disposed||busy||!OBR.isReady||await OBR.player.getRole()!=="GM")return;
  if(!await OBR.scene.isReady())return;
  busy=true;
  try{
    const db=await connect();
    const user=await ownerSession();
    if(!user)return;
    const scene=await OBR.scene.getMetadata();
    const sceneKey=scene?.[SCENE_KEY];
    if(typeof sceneKey!=="string"||!sceneKey)return;
    const result=await db.from(TABLE)
      .select("*").eq("status","pending")
      .eq("room_id",OBR.room.id).eq("scene_key",sceneKey)
      .order("created_at",{ascending:true}).limit(6);
    if(result.error)throw result.error;
    for(const row of result.data||[]){
      try{
        // Re-check room, role and scene identity before each destructive write.
        if(await OBR.player.getRole()!=="GM"||!await OBR.scene.isReady())break;
        const current=await OBR.scene.getMetadata();
        if(current?.[SCENE_KEY]!==row.scene_key||row.room_id!==OBR.room.id)break;
        const itemId=await apply(row,current);
        const written=await db.from(TABLE).update({
          status:"done",applied_item_id:itemId,completed_at:new Date().toISOString(),
          error_text:null
        }).eq("id",row.id).eq("status","pending");
        if(written.error)throw written.error;
        await message(row.item_layer==="CHARACTER"?
          "Token transféré : "+row.title:"Élément transféré : "+row.title);
      }catch(e){
        const text=String(e?.message||e).slice(0,480);
        const update=await db.from(TABLE).update({status:"failed",error_text:text})
           .eq("id",row.id).eq("status","pending");
        if(update.error)console.error("Échec d'enregistrement",update.error);
        console.error("Transfert Owlbear : ",e);
      }
    }
    lastError="";
  }catch(e){
    const reason=String(e?.message||e);
    if(lastError!==reason){console.warn("Transferts Archives non actifs : "+reason);lastError=reason;}
  }finally{busy=false}
}
export function watchTransfers(){
  if(!OBR.isAvailable)return;
  OBR.onReady(()=>{
    void poll();
    const timer=setInterval(()=>{void poll()},delay);
    const unsubscribe=OBR.scene.onReadyChange(ready=>{if(ready)void poll()});
    window.addEventListener("pagehide",()=>{
      disposed=true;clearInterval(timer);unsubscribe?.();
    },{once:true});
  });
}
