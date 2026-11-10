/* Les Archives · Google Drive import (GM only). OAuth stays in Google; no private token is persisted. */
const KEY='archives:google-drive:picker-config:v1';
const TYPES={'application/vnd.google-apps.document':['application/vnd.openxmlformats-officedocument.wordprocessingml.document','.docx'],'application/vnd.google-apps.spreadsheet':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.xlsx'],'application/vnd.google-apps.presentation':['application/vnd.openxmlformats-officedocument.presentationml.presentation','.pptx']};
let accessToken='',expiresAt=0,loading,tokenClient=null,pickerReady=false,dialog=null;
const config=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const isGM=()=>!document.body.classList.contains('player-mode')&&!document.body.classList.contains('strict-readonly')&&(!window.DuneApp?.getState||(!window.DuneApp.getState()?.playerMode&&!window.DuneApp.getState()?.strictReadOnly));
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('Le service Google ne répond pas : '+src));document.head.appendChild(script)})}
async function ready(){
  if(!loading)loading=Promise.all([loadScript('https://accounts.google.com/gsi/client'),loadScript('https://apis.google.com/js/api.js')]).then(()=>new Promise((res,rej)=>{window.gapi.load('picker',{callback:()=>{pickerReady=true;res()},onerror:()=>rej(Error('Google Picker indisponible'))})})).catch(e=>{loading=null;throw e});
  await loading;
}
async function oauth(c){
  await ready();
  if(accessToken&&Date.now()<expiresAt-60000)return accessToken;
  return new Promise((resolve,reject)=>{
    tokenClient=window.google.accounts.oauth2.initTokenClient({
      client_id:c.clientId,scope:'https://www.googleapis.com/auth/drive.file',
      callback:r=>{if(r.error||!r.access_token){reject(Error(r.error_description||r.error||'Connexion Google refusée'));return}
        accessToken=r.access_token;expiresAt=Date.now()+(Number(r.expires_in)||3500)*1000;resolve(accessToken)}
    });
    tokenClient.requestAccessToken({prompt:accessToken?'':'consent'});
  });
}
function mimeAllowed(file,input){
  const accept=(input.accept||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(!accept.length)return true;
  const name=file.name.toLowerCase(),mime=file.type.toLowerCase();
  return accept.some(v=>v.startsWith('.')?name.endsWith(v):v.endsWith('/*')?mime.startsWith(v.slice(0,-1)):v===mime);
}
async function download(id,name,mime,token){
  const native=TYPES[mime],url=native?
    'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'/export?mimeType='+encodeURIComponent(native[0]):
    'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media';
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!res.ok)throw Error('Téléchargement Google Drive impossible (HTTP '+res.status+').');
  const blob=await res.blob();
  if(blob.size>75*1024*1024)throw Error('Fichier supérieur à 75 Mo : importe-le depuis ton ordinateur.');
  const targetName=native?name.replace(/\.[^.]+$/,'')+native[1]:name;
  return new File([blob],targetName,{type:native?native[0]:mime||blob.type||'application/octet-stream'});
}
function notice(t){const n=document.getElementById('archives-drive-status')||document.createElement('output');n.id='archives-drive-status';n.setAttribute('role','status');n.style.cssText='position:fixed;bottom:16px;right:16px;max-width:360px;background:#221b31;color:#fff0ce;border:1px solid #c6a56a;border-radius:8px;padding:12px;z-index:999999;box-shadow:0 8px 24px #0009';n.textContent=t;document.body.appendChild(n);clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.remove(),11000)}
function configure(){
  if(!isGM())return;
  dialog?.remove();dialog=document.createElement('dialog');dialog.id='archives-drive-dialog';dialog.style.cssText='color:#f7e8ce;background:#1b1528;border:1px solid #b99a5f;border-radius:14px;padding:24px;width:min(530px,94vw);box-shadow:0 10px 60px #000b;z-index:999999';
  const c=config();dialog.innerHTML='<form method="dialog" style="display:grid;gap:12px"><h2 style="margin:0;font-size:20px">Google Drive · Connexion</h2><p>Configuration unique du sélecteur Google pour les Archives. Ces identifiants publics restent dans ce navigateur. Ne saisis jamais de clé secrète ni de mot de passe Google.</p><label>Identifiant OAuth du client Web<input name="clientId" required placeholder="…apps.googleusercontent.com" style="width:100%;padding:9px"></label><label>Clé API Google Picker<input name="apiKey" required placeholder="AIza…" style="width:100%;padding:9px"></label><label>Numéro du projet Google Cloud<input name="appId" required inputmode="numeric" placeholder="123456789012" style="width:100%;padding:9px"></label><p style="font-size:12px">Origine JavaScript autorisée : '+location.origin+'. Active Google Picker API et Google Drive API dans ton projet Google Cloud.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button value="cancel">Annuler</button><button value="save">Enregistrer</button></div></form>';
  for(const k of ['clientId','apiKey','appId'])dialog.querySelector('[name="'+k+'"]').value=c[k]||'';
  dialog.addEventListener('close',()=>{if(dialog.returnValue==='save'){const form=dialog.querySelector('form');const values=Object.fromEntries(new FormData(form));if(!values.clientId.endsWith('.apps.googleusercontent.com')||!/^\d+$/.test(values.appId)||!values.apiKey.trim()){notice('Vérifie les paramètres Google Cloud.');return}localStorage.setItem(KEY,JSON.stringify(values));notice('Google Drive configuré. Tu peux choisir un fichier.')}dialog.remove();dialog=null},{once:true});
  document.body.append(dialog);dialog.showModal();
}
function chooseInput(){return new Promise(resolve=>{
 const opts=[...document.querySelectorAll('input[type=file]')].filter(e=>!e.disabled).map(e=>({el:e,name:((e.closest('label')?.textContent||document.querySelector('label[for="'+e.id+'"]')?.textContent||e.id||e.accept||'Fichier')).trim().slice(0,90)}));
 const d=document.createElement('dialog');d.style.cssText='background:#1d1629;color:#f7e8ce;border:1px solid #b99a5f;border-radius:12px;padding:22px;max-width:95vw;width:450px;z-index:999999';d.innerHTML='<h3>Importer depuis Google Drive</h3><p>Dans quelle rubrique veux-tu ajouter ton fichier ?</p><select style="width:100%;padding:12px;background:#281f35;color:white"></select><div style="display:flex;gap:8px;margin-top:15px"><button data-cancel>Annuler</button><button data-ok>Choisir sur Drive</button><button data-config>Configurer Google</button></div>';
 const select=d.querySelector('select');for(const o of opts){const x=document.createElement('option');x.value=String(opts.indexOf(o));x.textContent=o.name;select.append(x)}
 const finish=v=>{d.close();d.remove();resolve(v)};
 d.querySelector('[data-cancel]').onclick=()=>finish(null);d.querySelector('[data-ok]').onclick=()=>finish(opts[Number(select.value)]?.el||null);d.querySelector('[data-config]').onclick=()=>{finish(null);configure()};d.oncancel=()=>finish(null);document.body.append(d);d.showModal()
 })}
async function pick(input){
 if(!isGM())throw Error('Import réservé au MJ.');
 const c=config();
 if(!c.clientId||!c.apiKey||!c.appId){configure();return}
 const token=await oauth(c);
 if(!pickerReady)throw Error('Sélecteur Google non chargé.');
 await new Promise((resolve,reject)=>{
  const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
  const builder=new google.picker.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(c.apiKey).setAppId(c.appId).setLocale('fr').setOrigin(location.origin).setTitle('Choisir un fichier pour les Archives');
  if(!input.multiple)builder.setMaxItems(1);else builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
  const picker=builder.setCallback(async data=>{
   if(data.action===google.picker.Action.CANCEL){resolve();return}
   if(data.action!==google.picker.Action.PICKED)return;
   try{
    const all=[];for(const d of data.docs||[]){all.push(await download(d.id,d.name,d.mimeType,token))}
    if(!all.length){resolve();return}
    for(const file of all)if(!mimeAllowed(file,input))throw Error('Format non accepté dans cette fenêtre : '+file.name);
    const transfer=new DataTransfer();for(const f of all)transfer.items.add(f);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    notice(all.length+' fichier(s) importé(s) depuis Google Drive.');resolve();
   }catch(e){reject(e)}
  }).build();picker.setVisible(true)
 });
}
function launch(input){void (async()=>{try{await pick(input||await chooseInput())}catch(e){notice('Google Drive : '+(e.message||e))}})()}
function install(){
 if(document.getElementById('archives-google-drive-button'))return;
 const button=document.createElement('button');button.id='archives-google-drive-button';button.type='button';button.textContent='☁ Google Drive';button.title='Choisir une sauvegarde ou un fichier Google Drive';button.style.cssText='position:fixed;right:12px;top:90px;z-index:9950;background:#31253d;color:#f5e4c5;border:1px solid #a78b5b;border-radius:9px;padding:9px 12px;cursor:pointer;font:600 12px system-ui;box-shadow:0 5px 15px #0008';
 button.onclick=()=>launch(null);document.body.append(button);
 const style=document.createElement('style');style.textContent='body.player-mode #archives-google-drive-button,body.strict-readonly #archives-google-drive-button{display:none!important}';document.head.append(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.ArchivesGoogleDrive={open:launch,configure};
