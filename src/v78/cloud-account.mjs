import {element,button,isGM} from '../v63/ui.mjs?v=4580';
import {publicConnection} from './connection.mjs?v=4580';
export function restoreConnectionLink(){
 if(!isGM()||!location.hash.startsWith('#archives-cloud='))return false;
 try{
  const value=publicConnection(JSON.parse(decodeURIComponent(location.hash.slice('#archives-cloud='.length))));
  localStorage.setItem('archives_supabase_url',value.url);localStorage.setItem('archives_supabase_public_key',value.key);
  const url=document.getElementById('ac-url'),key=document.getElementById('ac-key');if(url)url.value=value.url;if(key)key.value=value.key;
  history.replaceState(null,'',location.pathname+location.search);return true;
 }catch(error){history.replaceState(null,'',location.pathname+location.search);console.warn(error.message);return false}
}
export function mountAccount(view,onChange){
 const detail=element('details',null,'backup-account');detail.id='archives-backup-account';detail.append(element('summary','Mon compte MJ · connexion'));
 const panel=document.getElementById('archives-cloud-panel');let marker,config,configHome;
 if(panel){
  marker=document.createComment('cloud-account-home');panel.before(marker);panel.classList.add('backup-embedded');detail.append(panel);
  const card=panel.querySelector('.ac-card'),anchor=card.querySelector('label[for="ac-url"]');
  configHome=document.createComment('cloud-connection-home');anchor.before(configHome);
  config=element('details',null,'backup-connection');config.id='archives-backup-connection';config.append(element('summary','Configuration de la connexion'));
  const nodes=['label[for="ac-url"]','#ac-url','label[for="ac-key"]','#ac-key','#ac-save-config'].map(s=>card.querySelector(s));const row=nodes.pop()?.parentElement;
  config.append(...nodes.filter(Boolean));if(row)config.append(row);configHome.after(config);
  config.open=!panel.querySelector('#ac-url').value||!panel.querySelector('#ac-key').value;
  const oldRow=panel.querySelector('#ac-create-campaign')?.parentElement;if(oldRow)oldRow.classList.add('backup-old-campaign-actions');
 }
 const share=button('Lien pour un autre appareil',async()=>{
  try{
   const connection=publicConnection({url:document.getElementById('ac-url')?.value,key:document.getElementById('ac-key')?.value}),url=new URL('../../archives.html',import.meta.url);url.search='?resume=1&v=4580';url.hash='archives-cloud='+encodeURIComponent(JSON.stringify(connection));
   link.value=url.href;link.hidden=false;link.focus();link.select();
   try{await navigator.clipboard.writeText(url.href);message.textContent='Lien copié. Ouvre-le sur l’autre appareil, connecte-toi avec le même compte MJ et choisis « Reprendre la dernière sauvegarde ».'}
   catch{message.textContent='Copie ce lien et ouvre-le sur l’autre appareil. Connecte-toi avec le même compte MJ pour retrouver tes sessions.'}
  }catch(error){detail.open=true;config&&(config.open=true);message.textContent=error.message}
 });
 const link=element('textarea');link.id='archives-backup-device-link';link.readOnly=true;link.hidden=true;link.rows=3;link.setAttribute('aria-label','Lien de connexion pour un autre appareil');
 const message=element('p','Ce lien transporte seulement la configuration publique. Le mot de passe du compte MJ reste nécessaire.','studio-hint');message.setAttribute('role','status');detail.append(share,link,message);
 const changed=()=>{if(view.dialog.open)void onChange()};window.addEventListener('archives:cloud-account',changed);
 return {node:detail,open(){detail.open=true},close(){detail.open=false},dispose(){
  window.removeEventListener('archives:cloud-account',changed);
  if(panel&&marker?.isConnected){panel.classList.remove('backup-embedded','open');marker.replaceWith(panel);if(config&&configHome?.isConnected){for(const node of [...config.children].slice(1))configHome.before(node);config.remove();configHome.remove()}document.querySelector('.backup-old-campaign-actions')?.classList.remove('backup-old-campaign-actions')}
 }};
}
restoreConnectionLink();
