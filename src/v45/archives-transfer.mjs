// V4.5 - Envoi strictement volontaire d'une cellule du canevas à Owlbear.
// Pas de synchronisation automatique du contenu privé. Pas de plugin navigateur.
const $=id=>document.getElementById(id);
const MAX_BYTES=15*1024*1024;
const BUCKET="archives-owlbear-revealed";
const DEFAULT_ASSETS={
  personnage:"token-personnage-v45.svg",
  lieu:"token-lieu-v45.svg",
  objet:"token-objet-v45.svg",
  groupe:"token-personnage-v45.svg",
  ressource:"token-objet-v45.svg",
  evenement:"token-objet-v45.svg"
};
let sending=false;
function ownerOnly(){
  const s=window.DuneApp?.getState?.();
  if(!s||s.playerMode||s.strictReadOnly||document.body.classList.contains("player-mode"))
    throw Error("Le transfert est réservé au MJ.");
  const node=(s.nodes||[]).find(n=>n.id===s.selectedId);
  if(!node)throw Error("Sélectionne une cellule du canevas.");
  return {state:s,node};
}
async function sessionContext(){
  const db=window.ArchivesCloudBridge?.getClient?.();
  if(!db)throw Error("Connecte ton compte dans « Comptes et campagnes ».");
  const auth=await db.auth.getUser();
  if(auth.error)throw auth.error;
  const user=auth.data?.user;
  if(!user)throw Error("Connecte-toi avec ton compte de meneur.");
  const list=await db.from("campaigns").select("id,name,owner_id").eq("owner_id",user.id);
  if(list.error)throw list.error;
  const linked=await db.from("owlbear_room_links").select("campaign_id,room_id");
  if(linked.error)throw linked.error;
  const association=new Map((linked.data||[]).map(x=>[x.campaign_id,x.room_id]));
  const candidates=(list.data||[]).filter(x=>association.has(x.id));
  const selected=$("v45-campaign")?.value||
     window.ArchivesModeControl?.getSelectedCampaign?.()||"";
  const campaign=candidates.find(x=>x.id===selected)||
     (candidates.length===1?candidates[0]:null);
  if(!campaign)throw Error(candidates.length>1?
     "Choisis ta campagne dans le panneau de synchronisation Owlbear.":
     "Associe d'abord la campagne à ta salle Owlbear.");
  const row=await db.from("campaign_live_state")
    .select("owlbear_scene_id").eq("campaign_id",campaign.id).maybeSingle();
  if(row.error)throw row.error;
  const scene=row.data?.owlbear_scene_id;
  if(!scene)throw Error("Choisis une scène Owlbear active pour la campagne.");
  return {db,user,campaign,roomId:association.get(campaign.id),scene};
}
function getSource(node){
  const raw=String(node.bgImg||"");
  return raw.startsWith("https://")||raw.startsWith("data:image/")?raw:"";
}
async function imageSource(node,context,transferId){
  let source=getSource(node);
  if(!source)return {url:new URL("../../"+(DEFAULT_ASSETS[node.category]||DEFAULT_ASSETS.objet),
    import.meta.url).href,width:256,height:256,mime:"image/svg+xml",isFallback:true};
  if(source.startsWith("https://")){
    const mime=/\.svg(?:\?|$)/i.test(source)?"image/svg+xml":
      /\.webp(?:\?|$)/i.test(source)?"image/webp":
      /\.jpe?g(?:\?|$)/i.test(source)?"image/jpeg":"image/png";
    return {url:source,width:256,height:256,mime,isFallback:false};
  }
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+\/=\s]+)$/.exec(source);
  if(!match)throw Error("Format de portrait non pris en charge.");
  if(match[2].length>MAX_BYTES*4/3+100)throw Error("Image trop volumineuse.");
  const response=await fetch(source);
  const blob=await response.blob();
  if(!blob.size||blob.size>MAX_BYTES)throw Error("Image supérieure à 15 Mo.");
  if(blob.type!==match[1])throw Error("Format d'image incohérent.");
  const bmp=await createImageBitmap(blob);
  const size={width:bmp.width,height:bmp.height};
  bmp.close();
  if(size.width<1||size.height<1||size.width>12000||size.height>12000)
    throw Error("Dimensions d'image non prises en charge.");
  const ext=blob.type.split("/")[1]==="jpeg"?"jpg":blob.type.split("/")[1];
  const path=context.campaign.id+"/"+transferId+"."+ext;
  const uploaded=await context.db.storage.from(BUCKET).upload(path,blob,{
    upsert:false,contentType:blob.type,cacheControl:"3600"
  });
  if(uploaded.error)throw uploaded.error;
  const pub=context.db.storage.from(BUCKET).getPublicUrl(path);
  if(!pub.data?.publicUrl)throw Error("URL de publication indisponible.");
  return {url:pub.data.publicUrl,mime:blob.type,...size,isFallback:false};
}
function confirmation(node){
  const kind=node.category==="personnage"?"un token de personnage":
    node.category==="lieu"?"un élément de lieu":"un élément de décor";
  return window.confirm(
    "Envoyer « "+String(node.title||"Sans titre").slice(0,100)+" » vers Owlbear ?\n\n"+
    "Owlbear créera "+kind+" sur la scène active.\n"+
    "Seuls le nom et l'image de la cellule seront transmis. "+
    "Les descriptions, secrets et indices resteront dans Les Archives.\n\n"+
    "Une image locale sera publiée à une adresse accessible par lien."
  );
}
function status(message){
  const el=$("archives-v45-cell-send-status");
  if(el)el.textContent=String(message).slice(0,280);
}
async function transfer(){
  if(sending)return;
  const {state,node}=ownerOnly();
  // Capture exact selected node and its identity before asynchronous IO.
  const snapshot={id:String(node.id),title:String(node.title||"Sans titre").slice(0,120),
    category:String(node.category||"objet"),bgImg:node.bgImg||"",
    boardId:String(state.activeBoardId)};
  if(!confirmation(snapshot))return;
  sending=true;
  const button=$("archives-v45-transfer-button");
  if(button)button.disabled=true;
  try{
    status("Préparation du transfert…");
    const ctx=await sessionContext();
    const transferId=crypto.randomUUID();
    const image=await imageSource(snapshot,ctx,transferId);
    const category=["personnage","lieu","objet","groupe","ressource","evenement"]
      .includes(snapshot.category)?snapshot.category:"objet";
    const kind=category==="personnage"?"CHARACTER":
      category==="lieu"&&!image.isFallback?"MAP":"PROP";
    const payload={
      id:transferId,campaign_id:ctx.campaign.id,room_id:ctx.roomId,
      scene_key:ctx.scene,source_board_id:snapshot.boardId,
      source_node_id:snapshot.id,title:snapshot.title,category,
      item_layer:kind,image_url:image.url,image_mime:image.mime,
      image_width:image.width,image_height:image.height
    };
    const result=await ctx.db.from("archives_owlbear_cell_transfers").insert(payload);
    if(result.error)throw result.error;
    status("Transfert demandé. Owlbear créera "+(kind==="CHARACTER"?"un token":"un élément")+
      " lorsque la scène et l'extension MJ seront connectées.");
  }catch(error){status("Transfert non confirmé : "+(error?.message||String(error)));}
  finally{sending=false;if(button)button.disabled=false}
}
function install(){
  if($("archives-v45-transfer-button"))return;
  // Reuse the original cell editor. Do not add another dock or global toolbar.
  const reveal=document.querySelector('#active-editor-modal button[onclick="DuneApp.toggleSelectedReveal()"]');
  if(!reveal)return;
  const button=document.createElement("button");
  button.id="archives-v45-transfer-button";
  button.type="button";
  button.className="btn";
  button.textContent="🎭 Révéler dans Owlbear";
  button.style.cssText="border:1px solid #b59b5b;background:#261f31;color:#f5d991";
  const info=document.createElement("span");
  info.id="archives-v45-cell-send-status";
  info.setAttribute("role","status");
  info.style.cssText="display:block;font-size:11px;margin-top:6px;color:#d4bd8d;max-width:300px";
  info.textContent="Transfert uniquement sur ton ordre.";
  reveal.parentElement.appendChild(button);
  reveal.parentElement.parentElement.appendChild(info);
  button.addEventListener("click",()=>{void transfer().catch(error=>status(error.message))});
}
install();
window.ArchivesCellTransfer={sendSelected:transfer};
