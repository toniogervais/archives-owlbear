import {button,element,isGM,nativeEditor,requireGM,request,sheet} from '../v63/ui.mjs?v=4420';
import {libraryRequest} from '../v60/request.mjs';
const extensions={'application/pdf':'pdf','text/plain':'txt','image/png':'png','image/jpeg':'jpg','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm','video/ogg':'ogv'};
export function openAddFile(onShared){
  requireGM();if(!nativeEditor())return;
  const view=sheet('archives-dossier-add','Ajouter un fichier','Dossier des joueurs · Autre');
  const file=element('input');file.type='file';file.accept='.pdf,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.ogv';file.setAttribute('aria-label','Document, son ou vidéo à partager');
  const title=element('input');title.type='text';title.maxLength=120;title.placeholder='Nom montré aux joueurs';title.setAttribute('aria-label','Nom montré aux joueurs');
  const share=button('Partager dans Autre',async()=>{
    try{
      requireGM();if(!file.files?.[0]||!title.value.trim())return;
      view.busy(true);view.status.textContent='Ajout du fichier au dossier…';
      const result=await libraryRequest({action:'import',file:file.files[0],name:file.files[0].name,title:title.value.trim()});
      // Un fichier déjà importé peut avoir un autre titre privé : utiliser le titre choisi pour ce partage.
      await libraryRequest({action:'rename',fileId:result.entry.id,title:title.value.trim()});
      await libraryRequest({action:'dossier-share',fileId:result.entry.id});
      view.dialog.close();await onShared?.();
    }catch(error){view.status.textContent=error.message}finally{if(view.dialog.open){view.busy(false);share.disabled=!file.files?.length||!title.value.trim()}}
  });share.disabled=true;
  const update=()=>{share.disabled=!file.files?.length||!title.value.trim()};
  file.onchange=()=>{if(file.files?.[0])title.value=file.files[0].name.replace(/\.[^.]+$/,'').slice(0,120);update()};title.oninput=update;
  view.content.append(element('p','Le fichier entier et le nom ci-dessous seront accessibles aux joueurs dans Autre. La lecture des sons et vidéos reste à leur choix.','studio-hint'),file,title,element('p','PDF, texte et images : 25 Mo maximum. Sons et vidéos : 8 Mo maximum. Le MJ doit rester connecté pour leur chargement.','studio-hint'),share);
}
export function openSharedFile(record){
  const view=sheet('archives-dossier-detail',record.title,'Dossier des joueurs · Autre');
  let objectUrl='',media;
  view.cleanup(()=>{if(media){media.pause();media.removeAttribute('src');media.load()}if(objectUrl)URL.revokeObjectURL(objectUrl)});
  view.status.textContent='Chargement du fichier…';
  void (async()=>{
    const result=await request('dossier',{action:'get',fileId:record.file.id});
    if(!view.dialog.open)return;
    if(!(result.blob instanceof Blob)||!extensions[result.entry?.mime])throw Error('Ce fichier ne peut pas être consulté.');
    const {blob,entry}=result;objectUrl=URL.createObjectURL(blob);
    if(entry.mime==='text/plain'){
      const text=await blob.text();if(!view.dialog.open)return;
      view.content.append(element('pre',text,'dossier-text'));
    }else if(entry.mime.startsWith('image/')){
      const img=element('img');img.src=objectUrl;img.alt=entry.title;img.className='dossier-media';view.content.append(img);
    }else if(entry.mime==='application/pdf'){
      const object=element('object');object.data=objectUrl;object.type='application/pdf';object.className='dossier-pdf';object.setAttribute('aria-label',entry.title);
      object.append(element('p','Utilise « Enregistrer le fichier » si le PDF ne s’affiche pas sur cet appareil.'));view.content.append(object);
    }else{
      media=element(entry.mime.startsWith('audio/')?'audio':'video');media.src=objectUrl;media.controls=true;media.playsInline=true;media.preload='metadata';media.volume=.65;media.className='dossier-media';media.setAttribute('aria-label',entry.title);
      media.addEventListener('error',()=>{view.status.textContent='Ce navigateur ne peut pas lire ce format. Tu peux enregistrer le fichier pour l’ouvrir.'});view.content.append(media);
    }
    const download=element('a','Enregistrer le fichier');download.href=objectUrl;download.download=entry.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)+'.'+extensions[entry.mime];view.content.append(download);
    view.status.textContent=media?'Fichier prêt. Utilise le bouton lecture pour démarrer avec le son.':'Fichier prêt.';
  })().catch(error=>{if(view.dialog.open)view.status.textContent=error.message});
}
export async function removeSharedFile(record){requireGM();await libraryRequest({action:'dossier-unshare',fileId:record.file.id})}
export const dossierFilters=[
  ['','Tous','<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'],
  ['personnage','Personnages','<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'],
  ['groupe','Groupes','<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>'],
  ['lieu','Lieux','<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'],
  ['objet','Objets','<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5"/>'],
  ['ressource','Ressources','<path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4zM12 6v15"/>'],
  ['evenement','Événements','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M7 14h3M14 17h3"/>'],
  ['autre','Autre','<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3zM9 15h6M12 12v6"/>']
];
