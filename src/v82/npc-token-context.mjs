/* V4.65 — Commande de fiche sur les tokens Les Archives uniquement, visible au MJ. */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey} from '../v58/model.mjs';
const id='fr.archives-imaginaire.bridge/npc-token-sheet-v82';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
export async function installNpcTokenContext(){
  await OBR.contextMenu.create({
    id,
    icons:[{
      icon:new URL('../../icon-archives-v43.svg',import.meta.url).href,
      label:'Voir les caractéristiques',
      filter:{
        min:1,max:1,roles:['GM'],
        every:[{key:['metadata',assetKey,'hasSheet'],value:true}]
      }
    }],
    onClick(context){
      const item=context.items?.length===1?context.items[0]:null;
      if(!item || item.metadata?.[assetKey]?.hasSheet!==true ||
         item.metadata?.[assetKey]?.id!==item.id)return;
      void (async()=>{
        if(await OBR.player.getRole()!=='GM')return;
        const url=new URL('../../npc-token-v82.html',import.meta.url);
        url.searchParams.set('item',item.id);
        await OBR.modal.open({id:modalId,url:url.href,width:780,height:650});
      })().catch(error=>{
        console.warn('Fiche du personnage Owlbear',error);
        void OBR.notification.show('Impossible d’ouvrir la fiche du personnage.','WARNING').catch(()=>{});
      });
    }
  });
}
