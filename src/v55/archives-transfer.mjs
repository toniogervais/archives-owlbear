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
function gmState(){
  const s=window.DuneApp?.getState?.();
  if(!s||s.playerMode||s.strictReadOnly||document.body.classList.contains("player-mode"))
    throw Error("Le transfert est réservé au MJ.");
  return s;
}
async function sessionContext(){
  let db;
  try{db=window.ArchivesCloudBridge?.getClient?.()}catch{}
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
  const campaign=selected ? candidates.find(x=>x.id===selected) :
     (candidates.length===1?candidates[0]:null);
  if(selected&&!campaign)throw Error("La campagne choisie doit t’appartenir et être reliée à une salle Owlbear.");
  if(!campaign)throw Error(candidates.length>1?
     "Choisis ta campagne dans le panneau de synchronisation Owlbear.":
     "Associe d'abord la campagne à ta salle Owlbear.");
  const row=await db.from("campaign_live_state")
    .select("owlbear_scene_id").eq("campaign_id",campaign.id).maybeSingle();
  if(row.error)throw row.error;
  const scene=row.data?.owlbear_scene_id;
  if(!scene)throw Error("Dans Owlbear, ouvre la carte et choisis « Utiliser la scène ouverte ».");
  return {db,user,campaign,roomId:association.get(campaign.id),scene};
}
function getSource(node){
  const raw=String(node.bgImg||"");
  return raw.startsWith("https://")||raw.startsWith("data:image/")?raw:"";
}
async function imageSource(node,context,transferId){
  const source=getSource(node);
  if(!source&&!node.file){
    return {
      url:new URL("../../"+(DEFAULT_ASSETS[node.category]||DEFAULT_ASSETS.objet),
        import.meta.url).href,
      width:256,height:256,mime:"image/svg+xml",isFallback:true
    };
  }
  // Remote portraits are copied to the existing, MJ-approved public asset bucket.
  // Never trust a guessed MIME or 256x256 dimensions from a remote URL.
  let blob=node.file;
  if(!blob){
    let response;
    try{response=await fetch(source,{mode:"cors"});}
    catch{throw Error("Le site de cette image n’autorise pas son transfert. Choisis une image locale.");}
    if(!response.ok)throw Error("L’image sélectionnée est inaccessible (HTTP "+response.status+").");
    blob=await response.blob();
  }
  let ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[blob.type];
  if(!ext)throw Error("L'image doit être PNG, JPG ou WebP.");
  if(!ext)throw Error("Choisis une image PNG, JPG ou WebP.");
  if(!blob.size||blob.size>MAX_BYTES)throw Error("Image supérieure à 15 Mo.");
  let width,height;
  if(typeof createImageBitmap==="function"){
    const bitmap=await createImageBitmap(blob);
    width=bitmap.width;height=bitmap.height;
    bitmap.close();
  }else{
    const url=URL.createObjectURL(blob);
    try{
      const dims=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});
        img.onerror=()=>reject(new Error("Dimensions de l'image illisibles."));
        img.src=url;
      });
      width=dims.width;height=dims.height;
    }finally{URL.revokeObjectURL(url);}
  }
  if(width<1||height<1||width>12000||height>12000)
    throw Error("Dimensions de l'image non prises en charge.");
  if(node.category==="personnage"){
    const objectUrl=URL.createObjectURL(blob);
    try{
      const portrait=new Image();
      await new Promise((resolve,reject)=>{
        portrait.onload=resolve;
        portrait.onerror=()=>reject(Error("Portrait illisible."));
        portrait.src=objectUrl;
      });
      const canvas=document.createElement("canvas");
      canvas.width=512;canvas.height=512;
      const ctx=canvas.getContext("2d");
      if(!ctx)throw Error("Création du pion indisponible.");
      ctx.beginPath();
      ctx.arc(256,256,256,0,Math.PI*2);
      ctx.clip();
      const side=Math.min(width,height);
      ctx.drawImage(portrait,(width-side)/2,(height-side)/2,side,side,0,0,512,512);
      blob=await new Promise((resolve,reject)=>canvas.toBlob(
        result=>result?resolve(result):reject(Error("Création du pion impossible.")),"image/png"));
      width=512;height=512;ext="png";
    }finally{URL.revokeObjectURL(objectUrl);}
  }
  const path=context.campaign.id+"/"+transferId+"."+ext;
  const uploaded=await context.db.storage.from(BUCKET).upload(path,blob,{
    upsert:false,contentType:blob.type,cacheControl:"3600"
  });
  if(uploaded.error)throw uploaded.error;
  const pub=context.db.storage.from(BUCKET).getPublicUrl(path);
  if(!pub.data?.publicUrl)throw Error("URL de publication indisponible.");
  return {url:pub.data.publicUrl,mime:blob.type,width,height,isFallback:false};
}
async function followTransfer(db,id,report){
  // Inform the GM without opening more buttons or panels.
  // Background tabs may throttle these reads; the Owlbear scene stays authoritative.
  for(let attempt=0;attempt<8;attempt++){
    await new Promise(resolve=>setTimeout(resolve,4000));
    try{
      const result=await db.from("archives_owlbear_cell_transfers")
        .select("status,error_text").eq("id",id).maybeSingle();
      if(result.error||!result.data)continue;
      if(result.data.status==="done"){
        report("Transfert terminé : élément créé ou actualisé dans Owlbear.");
        return;
      }
      if(result.data.status==="failed"){
        report("Échec du transfert : "+String(result.data.error_text||"vérifier l'extension Owlbear.").slice(0,170));
        return;
      }
    }catch{/* Réessaie après une coupure momentanée. */}
  }
  report("Transfert toujours en attente : ouvre ta salle Owlbear et connecte ton compte MJ dans l'extension.");
}

function confirmation(node,campaign){
  const kind=node.category==="personnage"?"un token de personnage":
    node.category==="lieu"?"un élément de lieu":"un élément de décor";
  return window.confirm(
    "Envoyer « "+String(node.title||"Sans titre").slice(0,100)+" » vers la scène Owlbear de « "+campaign.name+" » ?\n\n"+
    "Owlbear créera "+kind+(node.placement ? " à la position choisie." : " au centre de la vue du MJ.")+"\n"+
    "Seuls le nom et l'image seront transmis. "+
    "Les descriptions, secrets et indices resteront dans Les Archives.\n\n"+
    "Une image locale sera publiée à une adresse accessible par lien."
  );
}
function status(message){
  const el=$("archives-v55-transfer-status");
  el.textContent=String(message).slice(0,280);
  el.hidden=false;
  clearTimeout(status.timer);
  status.timer=setTimeout(()=>{el.hidden=true},12000);
}
function selectedCell(){
  const state=gmState();
  const node=(state.nodes||[]).find(n=>n.id===state.selectedId);
  if(!node)throw Error("Sélectionne une cellule du canevas.");
  return {...node,boardId:state.activeBoardId};
}
async function transfer(node,reportTo=status){
  if(sending)throw Error("Un envoi est déjà en cours.");
  gmState();
  const snapshot={id:String(node.id),title:String(node.title||"").trim().slice(0,120)||"Sans titre",
    category:String(node.category||"objet"),bgImg:node.bgImg||"",
    boardId:String(node.boardId),file:node.file,placement:node.placement};
  sending=true;
  const current=++transfer.sequence;
  const report=message=>{if(current===transfer.sequence)reportTo(message)};
  const button=$("archives-v45-transfer-button");
  if(button)button.disabled=true;
  try{
    report("Préparation du transfert…");
    const ctx=await sessionContext();
    if(!confirmation(snapshot,ctx.campaign)){report("Envoi annulé.");return;}
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
    if(snapshot.placement){
      payload.placement_x=snapshot.placement.x;
      payload.placement_y=snapshot.placement.y;
      payload.placement_dpi=snapshot.placement.dpi;
    }
    const result=await ctx.db.from("archives_owlbear_cell_transfers").insert(payload);
    if(result.error)throw result.error;
    report("Transfert enregistré pour Owlbear : vérification en cours…");
    void followTransfer(ctx.db,transferId,report);
  }catch(error){report("Transfert non confirmé : "+(error?.message||String(error)));}
  finally{sending=false;if(button)button.disabled=false}
}
transfer.sequence=0;
const sendSelected=async()=>transfer(selectedCell());
const sendImage=async item=>transfer({id:item.id,boardId:"bibliotheque-images",
  title:item.name,category:item.category||"personnage",bgImg:item.data});
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
  reveal.parentElement.appendChild(button);
  const notice=document.createElement("div");
  notice.id="archives-v55-transfer-status";
  notice.hidden=true;
  notice.setAttribute("role","status");
  notice.style.cssText="position:fixed;right:16px;bottom:18px;z-index:40000;max-width:min(380px,90vw);padding:12px;background:#261f31;color:#ffe9ac;border:1px solid #b59b5b;border-radius:8px";
  document.body.appendChild(notice);
  button.addEventListener("click",()=>{void sendSelected().catch(error=>status(error.message))});
  $("ctx-send-to-owlbear")?.addEventListener("click",()=>{
    window.DuneApp.closeContextMenus();
    void sendSelected().catch(error=>status(error.message));
  });
}
install();
window.ArchivesCellTransfer={
  sendSelected,
  sendImage:item=>sendImage(item).catch(error=>status(error.message)),
  sendFile:(file,title,placement,report)=>transfer({
    id:crypto.randomUUID(),boardId:"images-placees",title,category:"lieu",file,placement
  },report)
};
