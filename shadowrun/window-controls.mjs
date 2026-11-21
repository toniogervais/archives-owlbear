const MODAL_ID='fr.archives-imaginaire.shadowrun/compendium-fullscreen';
const $=id=>document.getElementById(id);

/** Full-screen is a native Owlbear modal. In a normal browser we use the Fullscreen API. */
export function installWindowControls({OBR,ready,viewState}){
 const large=$('resizeButton'),full=$('fullscreenButton'),restore=$('restoreButton');
 if(!large||!full||!restore)return;
 const mode=new URL(window.location.href).searchParams.get('view');
 let enlarged=false;
 const inModal=mode==='fullscreen';
 const update=()=>{
  const nativeFull=Boolean(document.fullscreenElement);
  large.hidden=inModal||nativeFull;
  full.hidden=inModal||nativeFull;
  restore.hidden=!inModal&&!nativeFull;
  large.textContent=enlarged?'Réduire':'Agrandir';
  large.setAttribute('aria-pressed',String(enlarged));
 };
 large.onclick=()=>{
  enlarged=!enlarged;
  document.body.dataset.panelSize=enlarged?'large':'normal';
  document.body.classList.toggle('expanded-local',enlarged);
  window.dispatchEvent(new Event('sr6-panel-size'));
  update();
 };
 const urlForModal=()=>{
  const url=new URL(window.location.href);url.searchParams.set('view','fullscreen');
  const v=viewState();
  for(const key of ['kind','topic','source','search','family','sub','entry']){
   if(v[key])url.searchParams.set(key,v[key]);else url.searchParams.delete(key);
  }
  return url.href;
 };
 full.onclick=async()=>{
  full.disabled=true;
  try{
   if(OBR?.isAvailable){
    await ready();
    await OBR.modal.open({id:MODAL_ID,url:urlForModal(),fullScreen:true});
   }else if(document.documentElement.requestFullscreen){
    await document.documentElement.requestFullscreen();
   }else{
    throw Error('Le mode plein écran n’est pas autorisé dans cette fenêtre.');
   }
  }catch(e){
   const message=document.getElementById('toast');
   if(message){message.textContent='Plein écran indisponible ici : '+(e?.message||e);message.hidden=false;}
  }finally{full.disabled=false;update();}
 };
 restore.onclick=async()=>{
  try{
   if(inModal&&OBR?.isAvailable){await ready();await OBR.modal.close(MODAL_ID);}
   else if(document.fullscreenElement){await document.exitFullscreen();}
   else {const url=new URL(window.location.href);url.searchParams.delete('view');window.location.replace(url.href);}
  }catch(e){restore.title=e.message||String(e);}
 };
 document.addEventListener('fullscreenchange',update);
 if(inModal){document.body.classList.add('compendium-fullscreen');document.body.dataset.panelSize='full';}
 update();
}
