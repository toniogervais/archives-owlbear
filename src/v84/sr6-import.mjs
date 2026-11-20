/* Réception des cellules Shadowrun 6 dans Les Archives (MJ uniquement).
 * Les caractéristiques de PNJ restent dans les données privées du MJ.
 * Aucun renseignement n'est transmis à la vue joueur par cette passerelle.
 */
const MAX_LENGTH=70000;
function fromBase64(value){
 if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>MAX_LENGTH)throw Error('Lien de transfert invalide.');
 const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export async function decodeSr6Import(value){
 const m=/^(gz|json)\.([A-Za-z0-9_-]+)$/.exec(value||'');
 if(!m)throw Error('Le lien ne contient pas de fiche Shadowrun compatible.');
 let bytes=fromBase64(m[2]);
 if(m[1]==='gz'){
  if(typeof DecompressionStream!=='function')throw Error('Le navigateur ne peut pas lire la fiche compressée.');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 if(bytes.length>100000)throw Error('La fiche est trop volumineuse.');
 const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(payload?.schema!=='archives-sr6-transfer'||payload.version!==1||
   !['canvas','library'].includes(payload.destination)||
   !payload.node||typeof payload.node.title!=='string'||payload.node.title.length>180||
   !['personnage','objet'].includes(payload.node.category)||
   !Array.isArray(payload.node.clues)||payload.node.clues.length||
   !Array.isArray(payload.node.gmDetails)||
   payload.node.revealed!==false||
   (payload.node.bgImg&&(!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(payload.node.bgImg)||payload.node.bgImg.length>28000)))throw Error('Les informations de la fiche ne sont pas valides.');
 return payload;
}
function ownerReady(){
 const state=window.DuneApp?.getState?.();
 return Boolean(state&&!state.playerMode&&!state.strictReadOnly&&
  !document.body.classList.contains('player-mode')&&!document.body.classList.contains('strict-readonly'));
}
function status(text,error=false){
 let item=document.getElementById('archives-sr6-status');
 if(!item){
  item=document.createElement('div');item.id='archives-sr6-status';item.setAttribute('role','status');
  item.style.cssText='position:fixed;z-index:60000;bottom:22px;right:18px;max-width:min(470px,90vw);padding:13px 17px;border-radius:12px;background:#241b27;border:1px solid #d4af37;color:#ffebc3;box-shadow:0 8px 28px #0009;font:14px/1.5 system-ui,sans-serif;';
  document.body.append(item);
 }
 item.textContent=text;
 if(error)item.style.borderColor='#e47777';
 return item;
}
let importing=false,finished=false;
export async function receiveSr6Transfer(){
 const params=new URLSearchParams(location.hash.replace(/^#/,''));
 const value=params.get('sr6i');
 if(!value||importing||finished)return false;
 if(!ownerReady()){status('Connecte-toi comme maître de jeu et ouvre une campagne pour importer cette fiche.');return false;}
 importing=true;
 try{
  const payload=await decodeSr6Import(value);
  const node=payload.node;
  if(payload.destination==='canvas'){
   const state=window.DuneApp.getState(),before=state.nodes.length;
   window.DuneApp.importCatalogCell(node);
   if(window.DuneApp.getState().nodes.length!==before+1)throw Error('La cellule n’a pas été ajoutée au canevas.');
   status('Cellule « '+node.title+' » créée dans le canevas, masquée pour les joueurs.');
  }else{
   const reserve=window.ArchivesCellReserve;
   if(!reserve?.addExternal)throw Error('La bibliothèque de cellules n’est pas encore prête.');
   await reserve.addExternal(node);
   status('« '+node.title+' » ajouté à la réserve de cellules, sans être placé sur le canevas.');
  }
  finished=true;
  const url=new URL(location.href);url.hash='';history.replaceState(null,'',url.href);
  window.dispatchEvent(new CustomEvent('archives:sr6-imported',{detail:{destination:payload.destination,title:node.title}}));
  return true;
 }catch(e){status('Import Shadowrun : '+(e?.message||String(e)),true);return false;}
 finally{importing=false;}
}
function install(){
 if(!location.hash.includes('sr6i='))return;
 // The Archives application restores the MJ's campaign asynchronously.
 const retry=()=>{if(!finished)void receiveSr6Transfer()};
 window.addEventListener('archives:campaign-restored',retry);
 window.addEventListener('archives:reserve-changed',()=>{if(!finished&&!importing)void receiveSr6Transfer()});
 window.addEventListener('focus',retry);
 setTimeout(retry,900);
 setTimeout(retry,2600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
