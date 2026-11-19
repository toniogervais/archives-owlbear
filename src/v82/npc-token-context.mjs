/* Fiche des personnages Owlbear : commande explicite du menu du token, réservée au MJ.
 * Les clics de sélection, déplacements et menus natifs Owlbear sont conservés.
 */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey} from '../v58/model.mjs';
const id='fr.archives-imaginaire.bridge/npc-token-sheet-v82';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
const isCharacter=item=>item?.layer==='CHARACTER'&&
  item.metadata?.[assetKey]?.id===item.id&&
  item.metadata[assetKey].kind==='TOKEN';

export async function installNpcTokenContext(){
  let registered=false,closed=false,changeQueue=Promise.resolve(),opening=false;
  async function openSheet(item){
    if(closed||opening||!isCharacter(item)||await OBR.player.getRole()!=='GM')return;
    if(!await OBR.scene.isReady())return;
    opening=true;
    try{
      const [actual]=await OBR.scene.items.getItems([item.id]);
      if(!isCharacter(actual)||actual.metadata[assetKey].hasSheet!==true)return;
      if(closed||await OBR.player.getRole()!=='GM')return;
      const url=new URL('../../npc-token-v82.html',import.meta.url);
      url.searchParams.set('item',actual.id);
      url.searchParams.set('v','4710');
      await OBR.modal.open({id:modalId,url:url.href,width:780,height:650});
    }finally{opening=false;}
  }
  const menu={
    id,
    icons:[{
      icon:new URL('../../icon-archives-v43.svg',import.meta.url).href,
      label:'Caractéristiques et PV',
      // Seul le meneur dispose de cette commande native Owlbear.
      filter:{min:1,max:1,roles:['GM'],
        every:[{key:['metadata',assetKey,'hasSheet'],value:true}]}
    }],
    onClick(context){
      const item=context.items?.length===1?context.items[0]:null;
      if(!isCharacter(item)||item.metadata?.[assetKey]?.hasSheet!==true)return;
      void openSheet(item).catch(error=>{
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
  // La sélection du token ne doit jamais ouvrir automatiquement la fiche.
  // Écouter seulement le rôle pour créer/retirer la commande du menu MJ.
  const off=OBR.player.onChange(()=>{
    void refresh().catch(error=>console.warn('Menu privé Owlbear',error));
  });
  window.addEventListener('pagehide',()=>{
    closed=true;off?.();
    void changeQueue.finally(()=>registered?OBR.contextMenu.remove(id):undefined).catch(()=>{});
  },{once:true});
  await refresh();
}
