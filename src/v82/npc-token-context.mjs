/* V4.66 — La commande n'est même pas enregistrée dans l'interface joueur. */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey} from '../v58/model.mjs';
const id='fr.archives-imaginaire.bridge/npc-token-sheet-v82';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';

export async function installNpcTokenContext(){
  let registered=false,closed=false,changeQueue=Promise.resolve();
  const menu={
    id,
    icons:[{
      icon:new URL('../../icon-archives-v43.svg',import.meta.url).href,
      label:'Voir les caractéristiques',
      // Protection supplémentaire fournie par Owlbear, en plus de l'absence
      // totale de cette commande dans les sessions joueur.
      filter:{
        min:1,max:1,roles:['GM'],
        every:[{key:['metadata',assetKey,'hasSheet'],value:true}]
      }
    }],
    onClick(context){
      const item=context.items?.length===1?context.items[0]:null;
      if(!item||item.metadata?.[assetKey]?.hasSheet!==true||
         item.metadata?.[assetKey]?.id!==item.id)return;
      void (async()=>{
        if(closed||await OBR.player.getRole()!=='GM')return;
        const url=new URL('../../npc-token-v82.html',import.meta.url);
        url.searchParams.set('item',item.id);
        await OBR.modal.open({id:modalId,url:url.href,width:780,height:650});
      })().catch(error=>{
        console.warn('Fiche du personnage Owlbear',error);
        void OBR.notification.show('Impossible d’ouvrir la fiche du personnage.','WARNING').catch(()=>{});
      });
    }
  };
  async function reconcile(){
    if(closed)return;
    const role=await OBR.player.getRole();
    if(role==='GM'&&!registered){
      await OBR.contextMenu.create(menu);
      registered=true;
    }else if(role!=='GM'&&registered){
      await OBR.contextMenu.remove(id);
      registered=false;
    }
  }
  function refresh(){
    changeQueue=changeQueue.catch(()=>{}).then(reconcile);
    return changeQueue;
  }
  const off=OBR.player.onChange(()=>{void refresh().catch(error=>console.warn('Menu privé Owlbear',error));});
  window.addEventListener('pagehide',()=>{
    closed=true;off?.();
    void changeQueue.finally(()=>registered?OBR.contextMenu.remove(id):undefined).catch(()=>{});
  },{once:true});
  await refresh();
}
