import {isGM,notice} from '../v63/ui.mjs?v=4420';
let operation=0,shown='',dismissed='',dialog;
const state=()=>window.DuneApp?.getState?.();
function ensureDialog(){
 if(dialog)return dialog;
 const style=document.createElement('style');style.textContent=`
 #archives-player-image{box-sizing:border-box;width:96vw;height:94dvh;max-width:98vw;max-height:96dvh;padding:12px;border:1px solid #c3a570;border-radius:14px;background:#100d17;color:#ffe7b5;font:14px system-ui;overflow:hidden}
 #archives-player-image::backdrop{background:#040309dd}
 #archives-player-image .player-image-shell{height:100%;display:flex;flex-direction:column;gap:10px;min-height:0}
 #archives-player-image header{display:flex;align-items:center;justify-content:space-between;gap:10px}
 #archives-player-image h2{margin:0;font-size:17px}
 #archives-player-image button{padding:10px 14px;border:1px solid #c3a570;border-radius:8px;background:#302337;color:inherit;font:inherit;cursor:pointer}
 #archives-player-image img{display:block;width:100%;flex:1;min-height:0;object-fit:contain;background:#07060b}
 `;document.head.append(style);
 dialog=document.createElement('dialog');dialog.id='archives-player-image';dialog.setAttribute('aria-label','Image présentée par le MJ');
 const shell=document.createElement('div');shell.className='player-image-shell';const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.textContent='Image partagée par le MJ';close.type='button';close.textContent='Fermer l’image';close.onclick=()=>dialog.close();header.append(title,close);
 const image=document.createElement('img');image.alt='Image présentée par le maître de jeu';image.referrerPolicy='no-referrer';image.onerror=()=>{image.alt='L’image n’a pas pu être chargée. Ferme-la et demande au MJ de la présenter à nouveau.'};shell.append(header,image);dialog.append(shell);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dismissed=shown;image.removeAttribute('src')});return dialog;
}
function render(){
 const s=state(),presentation=s?.playerPresentation;
 if(!s||!(s.playerMode||s.strictReadOnly)||!presentation?.published){if(dialog?.open)dialog.close();shown='';return}
 if(presentation.id===dismissed||dialog?.open&&shown===presentation.id)return;
 const view=ensureDialog();shown=presentation.id;view.querySelector('img').src=presentation.image;
 if(!view.open)view.showModal();
}
async function prepare(source){
 if(typeof source!=='string'||!source.startsWith('data:image/'))throw Error('Choisis une image de la bibliothèque.');
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Cette image ne peut pas être présentée.'));image.src=source});
 // Keep the original library file; only a large or unsupported presentation is resized.
 if(source.length<=6*1024*1024&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(source))return source;
 const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 const result=canvas.toDataURL('image/webp',.9);if(result.length>8*1024*1024)throw Error('L’image est trop volumineuse. Choisis une illustration plus petite.');return result;
}
async function show(item){
 if(!isGM())return;const current=++operation;
 try{
  const image=await prepare(item?.data);if(operation!==current||!isGM())return;
  if(!window.DuneApp.commitPlayerPresentation({id:crypto.randomUUID(),image,published:true}))throw Error('La présentation de cette image a échoué.');
  return true;
 }catch(error){if(operation===current)notice(error.message);return false}
}
function hide(){if(!isGM())return;operation++;return window.DuneApp.commitPlayerPresentation(null)}
window.ArchivesPlayerImage={show,hide};window.addEventListener('archives:player-image',render);
window.addEventListener('archives:public-view',render);render();
