import {element,button,isGM,nativeEditor,notice} from '../v63/ui.mjs?v=4490';
import {libraryRequest} from '../v60/request.mjs';
let menu;
function close(){menu?.hidePopover?.();menu?.remove();menu=null}
async function present(source) {
  if(!isGM())return;
  try {
    if(source.data&&!source.file&&!source.fileId)return await window.ArchivesPlayerImage.show({data:source.data});
    if(!nativeEditor())throw Error('Ouvre les Archives dans ta salle Owlbear pour présenter ce fichier aux joueurs.');
    let id=source.fileId;
    if(!id){const file=source.file||new File([source.text||''],'texte.txt',{type:'text/plain'});const result=await libraryRequest({action:'import',file,name:file.name,title:'Document partagé'});id=result.entry.id}
    // Use a neutral public caption: private filenames and cell names stay private.
    await libraryRequest({action:'present',fileId:id,title:'Document partagé par le MJ'});notice('Document présenté aux joueurs. Ils peuvent le fermer avec la croix.');
  }catch(error){notice(error.message)}
}
function descriptor(target) {
  if(target.closest?.('#archives-image-library-grid'))return null;
  const dialog=target.closest?.('dialog');
  if(dialog?.archivesPresentationSource)return dialog.archivesPresentationSource;
  const img=target.closest?.('img');if(img&&img.getBoundingClientRect().width>60&&img.getBoundingClientRect().height>60)return {data:img.currentSrc||img.src};
  // The editor preview uses a CSS image, not an IMG element.
  if(target.closest?.('#active-editor-preview-stage')){const s=window.DuneApp.getState(),n=s.nodes.find(n=>n.id===s.selectedId);if(n?.bgImg)return {data:n.bgImg}}
  return null;
}
document.addEventListener('contextmenu',event=>{
  if(!isGM())return;const source=descriptor(event.target);if(!source)return;
  event.preventDefault();event.stopImmediatePropagation();close();
  menu=element('div');menu.id='archives-presentation-menu';menu.setAttribute('role','menu');menu.setAttribute('popover','manual');
  Object.assign(menu.style,{position:'fixed',inset:'auto',margin:'0',zIndex:'2147483647',padding:'8px',border:'1px solid #bda16f',borderRadius:'9px',background:'#23192f',color:'#fff0d5',boxShadow:'0 10px 40px #000a'});
  menu.append(button('Montrer aux joueurs',()=>{close();void present(source)}),button('Annuler',close));
  for(const b of menu.querySelectorAll('button'))Object.assign(b.style,{display:'block',width:'100%',padding:'11px',font:'14px system-ui',background:'#3e2c47',color:'inherit',border:'1px solid #997d5a',borderRadius:'6px',cursor:'pointer',margin:'3px 0'});
  (event.target.closest('dialog')||document.body).append(menu);menu.showPopover?.();
  const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-r.height-8))+'px';menu.querySelector('button').focus();
},true);
document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))close()},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu){event.preventDefault();event.stopImmediatePropagation();close()}},true);
window.ArchivesPresentation={present};
