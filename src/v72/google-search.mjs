import {isGM,notice} from '../v63/ui.mjs?v=4500';
const key='ArchivesGoogleEngineCx';let session='',loaded='',target='',query='',operation=0;
const $=id=>document.getElementById(id);
function setup(){const config=$('archives-google-config');if(config)config.open=true;$('archives-google-cx')?.focus()}
function search(text,id) {
  if(!isGM())return;operation++;target=id||'';query=String(text||'JDR concept art').slice(0,300);
  const frame=$('image-search-frame'),cx=$('archives-google-cx')?.value.trim()||localStorage.getItem(key)||'';
  if(!/^[A-Za-z0-9:_-]{5,150}$/.test(cx)){setup();notice('La recherche Google intégrée demande l’identifiant d’un moteur Google. Renseigne-le une seule fois dans cette fenêtre.');return}
  localStorage.setItem(key,cx);$('archives-google-config').open=false;
  if(loaded!==cx){loaded=cx;session=crypto.randomUUID();frame.src='./google-search-v449.html?v=4500#'+new URLSearchParams({cx,session});}
  else frame.contentWindow.postMessage({type:'archives-google-query',session,query},'*');
}
function install(){
  const config=$('archives-google-config');if(!config)return;
  $('archives-google-cx').value=localStorage.getItem(key)||'';
  $('archives-google-save').onclick=()=>{loaded='';search($('image-picker-query').value,target)};
  $('image-picker-query').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();window.DuneApp.runImageSearch()}});
}
window.addEventListener('message',event=>{
  const frame=$('image-search-frame'),data=event.data;if(event.source!==frame?.contentWindow||data?.session!==session||!session||!isGM())return;
  if(data.type==='archives-google-ready'){frame.contentWindow.postMessage({type:'archives-google-query',session,query},'*');return}
  if(data.type!=='archives-google-image'||typeof data.url!=='string'||!/^https:\/\//.test(data.url))return;
  const version=operation,cell=target;
  void (async()=>{
    try{
      const response=await fetch(data.url,{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error();
      const blob=await response.blob();if(!/^image\/(png|jpeg|webp|gif)$/.test(blob.type))throw Error();
      const original=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
      if(!isGM()||operation!==version)return;
      if(!cell){notice('Sélectionne une cellule avant d’appliquer cette image.');return}
      window.DuneApp.commitCellPicture(cell,{bgImg:original,bgFit:'contain',bgZoom:1,bgOffsetX:0,bgOffsetY:0});window.DuneApp.closeImagePicker();notice('Image originale appliquée à la cellule.');
    }catch{notice('Le site source bloque le téléchargement direct. Importe cette image depuis ton appareil pour la conserver dans les sauvegardes.')}
  })();
});
window.ArchivesGoogleSearch={search,setup};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
