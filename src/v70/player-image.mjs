import {isGM,nativeEditor,notice} from '../v63/ui.mjs?v=4590';
import {libraryRequest} from '../v60/request.mjs?v=4590';
import {maxDocumentBytes,validateFile} from '../v60/files.mjs?v=4590';
import {audience as normalizeAudience} from '../v79/audience.mjs?v=4600';
import {fade,fadeDuration} from '../v73/fade.mjs?v=4590';
let operation=0,shown='',requested='',dialog,epoch=0,animation,nativePresentation=false,nativePublishedId='';
const dismissed=new Set(),state=()=>window.DuneApp?.getState?.();
function remember(id){if(!id)return;dismissed.add(id);if(dismissed.size>128)dismissed.delete(dismissed.values().next().value)}
function cancelFade(){animation?.cancel();animation=null}
function ensureDialog(){
 if(dialog?.isConnected)return dialog;
 const style=document.createElement('style');style.textContent=`
 #archives-player-image{box-sizing:border-box;width:96vw;height:94dvh;max-width:98vw;max-height:96dvh;padding:12px;border:1px solid #c3a570;border-radius:14px;background:#100d17;color:#ffe7b5;font:14px system-ui;overflow:hidden}
 #archives-player-image::backdrop{background:#040309dd}
 #archives-player-image[data-phase="opening"]::backdrop{animation:archives-image-backdrop-in .3s ease-in-out both}
 #archives-player-image[data-phase="closing"]::backdrop{animation:archives-image-backdrop-out .3s ease-in-out both}
 @keyframes archives-image-backdrop-in{from{opacity:0}to{opacity:1}}
 @keyframes archives-image-backdrop-out{from{opacity:1}to{opacity:0}}
 @media(prefers-reduced-motion:reduce){#archives-player-image::backdrop{animation:none!important}}
 #archives-player-image .player-image-shell{height:100%;display:flex;flex-direction:column;gap:10px;min-height:0}
 #archives-player-image header{display:flex;align-items:center;justify-content:space-between;gap:10px}
 #archives-player-image h2{margin:0;font-size:17px}
 #archives-player-image button{padding:10px 14px;border:1px solid #c3a570;border-radius:8px;background:#302337;color:inherit;font:inherit;cursor:pointer}
 #archives-player-image .player-image-content{display:flex;flex:1;min-height:0;overflow:auto}
 #archives-player-image img,#archives-player-image object,#archives-player-image video{display:block;width:100%;height:100%;min-height:0;object-fit:contain;background:#07060b;border:0}
 #archives-player-image audio{width:100%;align-self:center}
 #archives-player-image pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font:16px/1.65 system-ui;width:100%;margin:0;user-select:text}
 `;document.head.append(style);
 dialog=document.createElement('dialog');dialog.id='archives-player-image';dialog.setAttribute('aria-label','Image présentée par le MJ');
 const shell=document.createElement('div');shell.className='player-image-shell';const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.textContent='Image';close.type='button';close.textContent='×';close.setAttribute('aria-label','Fermer l’image');close.onclick=()=>void dismiss();header.append(title,close);
 const content=document.createElement('div');content.className='player-image-content';shell.append(header,content);dialog.append(shell);document.body.append(dialog);
 dialog.addEventListener('cancel',event=>{event.preventDefault();void dismiss()});
 const owner=dialog;dialog.addEventListener('close',()=>{if(owner!==dialog||owner.open||!shown)return;remember(shown);shown=requested='';epoch++;cancelFade();clearContent()});return dialog;
}
function clearContent(){for(const media of dialog?.querySelectorAll('audio,video')||[])media.pause();dialog?.querySelector('.player-image-content')?.replaceChildren();}
async function dismiss(local=true){
 if(dialog?.dataset.phase==='closing'&&!requested)return;
 if(local){remember(shown);remember(requested)}
 requested='';const version=++epoch;cancelFade();
 if(!dialog?.open){shown='';return}
 dialog.dataset.phase='closing';const opacity=Number(getComputedStyle(dialog).opacity);animation=fade(dialog,Number.isFinite(opacity)?opacity:1,0);
 await animation.finished;if(epoch!==version)return;
 cancelFade();shown='';clearContent();dialog.close();dialog.dataset.phase='closed';
}
async function render(){
 const s=state(),presentation=s?.playerPresentation;
 if(isGM()&&nativePublishedId&&presentation?.id!==nativePublishedId){nativePublishedId='';hide();return}
 if(!s||!(s.playerMode||s.strictReadOnly)||!presentation?.published){if(shown||requested)void dismiss(false);return}
 if(dismissed.has(presentation.id)||presentation.id===requested||dialog?.open&&shown===presentation.id&&dialog.dataset.phase!=='closing')return;
 requested=presentation.id;const version=++epoch;cancelFade();
 // Preload before replacing the visible image; a later request cancels this one.
 const mime=presentation.image.slice(5,presentation.image.indexOf(';'));let picture;
 try{
  if(mime.startsWith('image/')){picture=new Image();picture.alt='Image présentée par le maître de jeu';picture.referrerPolicy='no-referrer';await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=reject;picture.src=presentation.image});}
  else if(mime==='text/plain'){picture=document.createElement('pre');picture.textContent=await fetch(presentation.image).then(r=>r.text());}
  else if(mime==='application/pdf'){picture=document.createElement('object');picture.type=mime;picture.data=presentation.image;const download=document.createElement('a');download.href=presentation.image;download.download='document.pdf';download.textContent='Ouvrir le document PDF';picture.append(download);}
  else {picture=document.createElement(mime.startsWith('audio/')?'audio':'video');picture.controls=true;picture.playsInline=true;picture.preload='metadata';picture.src=presentation.image;}
 }
 catch{if(epoch===version){requested='';notice('L’image présentée n’a pas pu être chargée.')}return}
 if(epoch!==version||dismissed.has(presentation.id))return;
 const view=ensureDialog(),image=view.querySelector('.player-image-content'),replacing=view.open&&!!shown&&view.dataset.phase!=='closing';
 if(replacing){animation=fade(image,1,0,140);await animation.finished;if(epoch!==version)return;cancelFade()}
 clearContent();image.append(picture);view.querySelector('h2').textContent=mime.startsWith('image/')?'Image':'Document';shown=presentation.id;view.dataset.phase=replacing?'switching':'opening';if(!view.open)view.showModal();
 animation=fade(replacing?image:view,0,1,fadeDuration);await animation.finished;if(epoch!==version)return;
 cancelFade();view.dataset.phase='open';
}
async function prepare(source){
 if(source instanceof Blob){
  const file=source instanceof File?source:new File([source],'document',{type:source.type});const {mime}=await validateFile(file);
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(new Blob([file],{type:mime}));});
  return mime.startsWith('image/')?prepare(data):data;
 }
 if(typeof source!=='string')throw Error('Choisis une image.');
 if(!source.startsWith('data:image/')) {
  if(!/^(https:\/\/|blob:)/.test(source))throw Error('Cette image ne peut pas être présentée.');
  let response;try{response=await fetch(source,{credentials:'omit',referrerPolicy:'no-referrer'})}catch{throw Error('Ce site empêche le partage de son image. Importe son original dans la bibliothèque pour le présenter.')}
  if(!response.ok)throw Error('Le fichier de cette image n’est plus accessible.');
  const blob=await response.blob();if(!/^image\/(png|jpeg|webp|gif)$/.test(blob.type))throw Error('Format d’image non pris en charge.');
  source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
 }
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Cette image ne peut pas être présentée.'));image.src=source});
 if(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(source))throw Error('Présente une image PNG, JPEG, WebP ou GIF.');
 const encoded=source.slice(source.indexOf(',')+1),bytes=Math.floor(encoded.length*3/4)-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
 if(bytes>maxDocumentBytes)throw Error('Ce fichier dépasse la limite actuelle de 25 Mo. Aucun redimensionnement n’a été effectué.');
 return source;
}
async function show(item){
 if(!isGM())return;const current=++operation;
 try{
  const audience=normalizeAudience(item?.audience),image=await prepare(item?.data);if(operation!==current||!isGM())return;
  const request=nativeEditor()?libraryRequest:window.ArchivesPresentationBridge?.connected?command=>window.ArchivesPresentationBridge.request(command):null;
  const deliverNative=!!request&&(audience.all||audience.owl.length>0),recipients=audience.all?{}:{recipients:audience.owl};
  if(!deliverNative&&nativePresentation&&request){await request({action:'stop'});nativePresentation=false;}
  if(deliverNative){
   nativePresentation=true;
   const file=await fetch(image).then(response=>response.blob());
   if(operation!==current||!isGM())return;
   if(file.type.startsWith('image/')&&!item.fileId)await request({action:'present-image',file,...recipients});
   else {const id=item.fileId||(await request({action:'import',file,name:'document-partage',title:'Document partagé'})).entry.id;await request({action:'present',fileId:id,title:'Document partagé par le MJ',...recipients});}
   if(operation!==current||!isGM())return;
  }
  // Salon Live clients retain their own image viewer. Native Owlbear clients
  // use the independent media viewer, including while their canvas is closed.
  const id=crypto.randomUUID();nativePublishedId=deliverNative?id:'';
  if(!window.DuneApp.commitPlayerPresentation({id,image,published:true,delivery:deliverNative?'media':'inline'},audience.all?undefined:audience.live))throw Error('La présentation a échoué.');
  notice(audience.all?'Présentation envoyée à tout le monde.':'Présentation envoyée uniquement aux joueurs choisis.');
  return true;
 }catch(error){if(operation===current)notice(error.message);return false}
}
function hide(){
 if(!isGM())return;operation++;nativePublishedId='';
 if(nativePresentation){nativePresentation=false;const request=nativeEditor()?libraryRequest:window.ArchivesPresentationBridge?.connected?command=>window.ArchivesPresentationBridge.request(command):null;void request?.({action:'stop'}).catch(error=>notice(error.message))}
 return window.DuneApp.commitPlayerPresentation(null);
}
window.ArchivesPlayerImage={show,hide};window.addEventListener('archives:player-image',render);
window.addEventListener('archives:public-view',render);render();
if(state()?.playerMode||state()?.strictReadOnly){try{const channel=new BroadcastChannel('jdr_architect_sync_v12');channel.postMessage({type:'archives:player-image-request:v1'});channel.close()}catch{}}
