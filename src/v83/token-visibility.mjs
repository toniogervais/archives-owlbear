/* V4.67 — Revealing and hiding Archive tokens from the Owlbear map.
 * A never-revealed token is local to the GM. A previously revealed item
 * stays in Owlbear's shared scene so its native Show/Hide keeps working.
 */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey} from '../v58/model.mjs';

const menuId='fr.archives-imaginaire.bridge/token-visibility-v83';
const icon=new URL('../../icon-archives-v43.svg',import.meta.url).href;
const key=['metadata',assetKey,'kind'];
const privateKey=['metadata',assetKey,'privateForGM'];
const forGM=(filters)=>({min:1,max:1,roles:['GM'],every:[{key,value:'TOKEN'},...filters]});

export async function installTokenVisibilityMenu(){
  let registered=false,closed=false,queue=Promise.resolve();
  const menu={
    id:menuId,
    icons:[
      {icon,label:'Révéler aux joueurs',filter:forGM([{key:privateKey,value:true}])},
      {icon,label:'Cacher aux joueurs',filter:forGM([{key:privateKey,value:false},{key:'visible',value:true}])},
      {icon,label:'Révéler aux joueurs',filter:forGM([{key:privateKey,value:false},{key:'visible',value:false}])}
    ],
    onClick(context){
      void (async()=>{
        if(closed||await OBR.player.getRole()!=='GM')return;
        const item=context.items?.length===1?context.items[0]:null;
        if(!item||item.metadata?.[assetKey]?.id!==item.id||item.metadata?.[assetKey]?.kind!=='TOKEN')return;
        const shared=(await OBR.scene.items.getItems([item.id]))
          .find(entry=>entry.metadata?.[assetKey]?.id===item.id);
        const reveal=!shared?.visible;
        if(typeof window.ArchivesTokenVisibility!=='function')
          throw Error('Le transfert Owlbear ne répond pas. Actualise la salle.');
        await window.ArchivesTokenVisibility(item.id,reveal);
        if(closed||await OBR.player.getRole()!=='GM')return;
        void OBR.notification.show(reveal?'Token révélé aux joueurs.':'Token caché aux joueurs.','SUCCESS').catch(()=>{});
      })().catch(error=>{
        console.warn('Visibilité token Archives',error);
        void OBR.notification.show(error?.message||'Modification du token impossible.','WARNING').catch(()=>{});
      });
    }
  };
  async function reconcile(){
    if(closed)return;
    const role=await OBR.player.getRole();
    if(role==='GM'&&!registered){await OBR.contextMenu.create(menu);registered=true;}
    else if(role!=='GM'&&registered){await OBR.contextMenu.remove(menuId);registered=false;}
  }
  function refresh(){
    queue=queue.catch(()=>{}).then(reconcile);return queue;
  }
  const off=OBR.player.onChange(()=>{void refresh().catch(console.warn);});
  window.addEventListener('pagehide',()=>{
    closed=true;off?.();
    void queue.finally(()=>registered?OBR.contextMenu.remove(menuId):undefined).catch(()=>{});
  },{once:true});
  await refresh();
}
