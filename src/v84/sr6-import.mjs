/* Passerelle privée Shadowrun 6 → Les Archives.
 * Ne crée jamais de cellule dans une vue joueur. Le contenu n'est pas
 * propagé dans les métadonnées publiques d'Owlbear.
 */
const MAX_LENGTH=70000;
function fromBase64(value){
 if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>MAX_LENGTH)throw Error('Lien de transfert invalide.');
 const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export async function decodeSr6Import(value){
 const match=/^(gz|json)\.([A-Za-z0-9_-]+)$/.exec(value||'');
 if(!match)throw Error('Lien de transfert Shadowrun invalide.');
 let bytes=fromBase64(match[2]);
 if(match[1]==='gz'){
  if(typeof DecompressionStream!=='function')throw Error('Décompression non prise en charge.');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 if(bytes.length>100000)throw Error('Fiche trop volumineuse.');
 const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(payload?.schema!=='archives-sr6-transfer'||payload.version!==1||
  !['canvas','library'].includes(payload.destination)||
  !payload.node||typeof payload.node.title!=='string'||payload.node.title.length>180||
  !['personnage','objet'].includes(payload.node.category)||
  !Array.isArray(payload.node.clues)||payload.node.clues.length||
  !Array.isArray(payload.node.gmDetails)||payload.node.gmDetails.length>55||
  payload.node.revealed!==false||
  (payload.node.bgImg&&(!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(payload.node.bgImg)||payload.node.bgImg.length>28000))
 )throw Error('Les données de la fiche ne sont pas valides.');
 return payload;
}
function isGM(){
 const state=window.DuneApp?.getState?.();
 return !!state&&!state.playerMode&&!state.strictReadOnly&&
  !document.body.classList.contains('player-mode')&&!document.body.classList.contains('strict-readonly');
}
function status(text,error=false){
 const panel=document.getElementById('archives-sr6-panel-status');
 if(panel){panel.textContent=text;panel.style.color=error?'#ffc3c3':'#ffdfa2';}
 let item=document.getElementById('archives-sr6-status');
 if(!item){
  item=document.createElement('div');item.id='archives-sr6-status';item.setAttribute('role','status');
  item.style.cssText='position:fixed;z-index:60000;bottom:22px;right:18px;max-width:min(470px,90vw);padding:13px 17px;border-radius:12px;background:#241b27;border:1px solid #d4af37;color:#ffebc3;box-shadow:0 8px 28px #0009;font:14px/1.5 system-ui,sans-serif;';
  document.body.append(item);
 }
 item.textContent=text;if(error)item.style.borderColor='#e47777';
}
let busy=false,linkComplete=false;
async function place(payload){
 if(!isGM())throw Error('Ouvre une campagne en tant que maître de jeu avant le transfert.');
 if(busy)throw Error('Une fiche est déjà en cours de transfert.');
 busy=true;
 try{
  const node=payload.node;
  if(payload.destination==='canvas'){
   const before=window.DuneApp.getState().nodes.length;
   window.DuneApp.importCatalogCell(node);
   if(window.DuneApp.getState().nodes.length!==before+1)throw Error('Le canevas n’a pas reçu la cellule.');
   status('« '+node.title+' » placé sur le canevas, masqué pour les joueurs.');
  }else{
   if(typeof window.ArchivesCellReserve?.addExternal!=='function')throw Error('La réserve de cellules n’est pas encore prête.');
   await window.ArchivesCellReserve.addExternal(node);
   status('« '+node.title+' » ajouté à la réserve de cellules privée, hors du canevas.');
  }
  window.dispatchEvent(new CustomEvent('archives:sr6-imported',{detail:{destination:payload.destination,title:node.title}}));
  return node.title;
 }finally{busy=false;}
}
export async function receiveSr6Transfer(){
 const value=new URLSearchParams(location.hash.replace(/^#/,'')).get('sr6i');
 if(!value||linkComplete)return false;
 try{
  const payload=await decodeSr6Import(value);
  await place(payload);
  linkComplete=true;
  const url=new URL(location.href);url.hash='';history.replaceState(null,'',url.href);
  return true;
 }catch(error){status('Import Shadowrun : '+(error?.message||String(error)),true);return false;}
}
function openPanel(){
 if(!isGM()){status('Le compendium est réservé au maître de jeu dans cette vue.',true);return;}
 let dialog=document.getElementById('archives-sr6-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='archives-sr6-dialog';
  dialog.style.cssText='width:min(1450px,98vw);height:min(980px,95dvh);max-width:98vw;max-height:97dvh;min-width:360px;min-height:300px;resize:both;overflow:hidden;padding:0;border:1px solid #c2a56c;border-radius:12px;background:#111922;color:#ffe9c2;box-shadow:0 20px 65px #000d;';
  const panel=document.createElement('div');panel.style.cssText='display:flex;flex-direction:column;height:100%;min-height:0;';
  const head=document.createElement('header');head.style.cssText='display:flex;gap:10px;align-items:center;padding:7px 11px;background:#1e1a27;border-bottom:1px solid #b4975b60;';
  const heading=document.createElement('strong');heading.textContent='🎲 Compendium Shadowrun 6';heading.style.cssText='flex:0 0 auto;font-size:14px;';
  const note=document.createElement('span');note.id='archives-sr6-panel-status';note.setAttribute('role','status');note.textContent='Choisis une fiche, puis Canevas ou Réserve de cellules.';note.style.cssText='flex:1;min-width:80px;overflow:hidden;text-overflow:ellipsis;font-size:12px;';
  const close=document.createElement('button');close.type='button';close.textContent='✕ Fermer';close.onclick=()=>dialog.close();
  close.style.cssText='background:#302536;color:#ffebc2;border:1px solid #ad935b;border-radius:7px;padding:7px 11px;cursor:pointer;';
  head.append(heading,note,close);
  const frame=document.createElement('iframe');frame.id='archives-sr6-frame';
  frame.title='Compendium Shadowrun 6';frame.src=new URL('./shadowrun/index.html?v=137',location.href).href;
  frame.style.cssText='display:block;width:100%;flex:1;min-height:0;border:0;background:#10181c;';
  panel.append(head,frame);dialog.append(panel);document.body.append(dialog);
  dialog.addEventListener('click',ev=>{if(ev.target===dialog)dialog.close()});
 }
 if(!dialog.open)dialog.showModal();
}
function install(){
 // An embedded compendium may send a private message only to the parent
 // Archives frame that hosts it. Reject all other windows and other origins.
 window.addEventListener('message',async event=>{
  const frame=document.getElementById('archives-sr6-frame');
  if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow||
   event.data?.type!=='archives:sr6-transfer:v1')return;
  try{
   const payload=await decodeSr6Import(event.data.code);
   const title=await place(payload);
   event.source.postMessage({type:'archives:sr6-transfer-result:v1',ok:true,title},event.origin);
  }catch(error){
   status('Import Shadowrun : '+(error?.message||String(error)),true);
   event.source.postMessage({type:'archives:sr6-transfer-result:v1',ok:false,message:String(error?.message||error)},event.origin);
  }
 });
 if(isGM()){
  const button=document.createElement('button');button.type='button';button.id='archives-sr6-launch';
  button.className='canvas-integration-icon';button.textContent='🎲 SR6';
  button.title='Compendium Shadowrun 6 : compétences, jets de dés, PNJ, bestiaire, équipement';
  button.setAttribute('aria-label','Ouvrir le compendium Shadowrun 6');
  button.style.cssText='font-size:12px;min-width:54px;min-height:34px;cursor:pointer;';
  button.onclick=openPanel;
  const dock=document.getElementById('canvas-integrations-dock')||document.getElementById('quick-icon-dock');
  if(dock)dock.append(button);
  else{button.style.cssText+='position:fixed;right:10px;bottom:10px;z-index:13000;';document.body.append(button);}
 }
 if(location.hash.includes('sr6i=')){
  const retry=()=>{if(!linkComplete&&!busy)void receiveSr6Transfer();};
  window.addEventListener('archives:campaign-restored',retry);
  window.addEventListener('focus',retry);
  setTimeout(retry,900);
  setTimeout(retry,2600);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
