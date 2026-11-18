/* Fiche des personnages Owlbear : sélection directe pour le MJ et bouton natif de secours.
 * Aucun clic joueur ne peut demander la fiche privée.
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
  let selectedId=null,lastRole=null,selectionEpoch=0;
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
  function selectionChanged(player){
    const next=Array.isArray(player.selection)&&player.selection.length===1?
      player.selection[0]:null;
    const moved=next!==selectedId,alreadyGM=lastRole==='GM';
    selectedId=next;lastRole=player.role;
    if(player.role!== 'GM'||!alreadyGM||!moved||!next||closed||!registered)return;
    const epoch=++selectionEpoch;
    // A simple click selects a character in Owlbear. Open its fiche without
    // replacing the native select/move tools. Ignore fast deselection or a
    // selection changed while the async scene request was running.
    void(async()=>{
      const [item]=await OBR.scene.items.getItems([next]);
      if(closed||epoch!==selectionEpoch||!isCharacter(item)||!item.metadata[assetKey].hasSheet)return;
      const current=await OBR.player.getSelection();
      if(closed||epoch!==selectionEpoch||current?.length!==1||current[0]!==next)return;
      await openSheet(item);
    })().catch(error=>console.warn('Sélection du personnage Owlbear',error));
  }
  // Do not open a modal for a token already selected before reloading the app.
  lastRole=await OBR.player.getRole();
  const existing=await OBR.player.getSelection();
  selectedId=Array.isArray(existing)&&existing.length===1?existing[0]:null;
  const off=OBR.player.onChange(player=>{
    selectionChanged(player);
    void refresh().catch(error=>console.warn('Menu privé Owlbear',error));
  });
  window.addEventListener('pagehide',()=>{
    closed=true;selectionEpoch++;off?.();
    void changeQueue.finally(()=>registered?OBR.contextMenu.remove(id):undefined).catch(()=>{});
  },{once:true});
  await refresh();
}
