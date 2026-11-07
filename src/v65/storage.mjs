import {button,element,isGM} from '../v63/ui.mjs';
import {storageAmounts,storageText} from './storage-model.mjs';
function install(){
  if(!isGM())return;
  const content=document.getElementById('settings-content');if(!content)return;
  const section=element('section',null,'owl-settings-section');section.id='archives-storage-meter';
  section.append(element('h3','Stockage des Archives'));
  const values=element('div',null,'storage-values'),available=element('strong','Calcul…'),used=element('span'),capacity=element('span'),progress=element('progress');
  available.dataset.storageAvailable='';used.dataset.storageUsed='';capacity.dataset.storageCapacity='';
  progress.max=1;progress.value=0;progress.setAttribute('aria-label','Stockage utilisé des Archives');
  values.append(available,used,capacity);const status=element('p','','owl-settings-note');status.setAttribute('role','status');
  const refreshButton=button('Actualiser',()=>{void refresh();});
  section.append(values,progress,element('p','Estimation pour les images, campagnes et documents enregistrés dans ce navigateur, sur cet appareil. Le stockage d’Owlbear est séparé.','owl-settings-note'),refreshButton,status);content.prepend(section);
  let loading=false;
  async function refresh(){
    if(loading)return;loading=true;refreshButton.disabled=true;
    try{
      if(!navigator.storage?.estimate)throw Error('Ce navigateur ne communique pas l’espace disponible.');
      const result=storageAmounts(await navigator.storage.estimate());
      available.textContent=storageText(result.available)+' disponibles';used.textContent=storageText(result.used)+' utilisés';capacity.textContent='Capacité estimée : '+storageText(result.capacity);progress.value=result.ratio;status.textContent='';
    }catch(error){available.textContent='Capacité indisponible';used.textContent=capacity.textContent='';status.textContent=error.message;progress.removeAttribute('value');}
    finally{loading=false;refreshButton.disabled=false;}
  }
  const settings=document.getElementById('settings-modal');if(settings)new MutationObserver(()=>{if(settings.classList.contains('open'))void refresh();}).observe(settings,{attributes:true,attributeFilter:['class']});
  const timer=setInterval(()=>{if(settings?.classList.contains('open'))void refresh();},5000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});void refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
