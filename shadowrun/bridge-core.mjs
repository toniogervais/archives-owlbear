import {NAMESPACE,safeCart,mergeInventory,updateNpcSheetRecord} from './model.mjs?v=130';
const ASSET='fr.archives-imaginaire.bridge/artwork-v58';const SCENE='fr.archives-imaginaire.bridge/scene-key';
export function createBridge(obr,storage,equipment){
 let active=true;let sequence=Promise.resolve(),identitySequence=Promise.resolve();
 const available=()=>Boolean(obr?.isAvailable);
 async function role(){return available()?await obr.player.getRole():'READER';}
 async function context(){
  if(!active||!available()||await role()!=='GM')throw Error('Le transfert est réservé au MJ connecté dans Owlbear.');
  if(!await obr.scene.isReady())throw Error('Ouvre une scène Owlbear pour équiper un PNJ.');
  const identity=identitySequence.catch(()=>{}).then(async()=>{const metadata=await obr.scene.getMetadata();const ownKey=NAMESPACE+'/scene-key';let id=metadata[SCENE]||metadata[ownKey];if(!id){id=crypto.randomUUID();await obr.scene.setMetadata({[ownKey]:id});}return id;});identitySequence=identity;
  const scene=await identity;
  return {room:obr.room.id,owner:obr.player.id,scene};
 }
 async function target(ctx,id){
  if(!id||typeof id!=='string')throw Error('Choisis un PNJ dans la scène.');
  const [shared,local]=await Promise.all([obr.scene.items.getItems([id]),obr.scene.local.getItems([id])]);
  const token=[...shared,...local].find(x=>x.id===id&&x.layer==='CHARACTER');
  if(!token)throw Error('Ce PNJ n’est plus présent dans la scène.');
  return token;
 }
 async function sameContext(ctx){const now=await context();if(now.room!==ctx.room||now.owner!==ctx.owner||now.scene!==ctx.scene)throw Error('La scène ou le compte a changé. Rouvre l’inventaire du PNJ.');}
 async function tokens(){if(await role()!=='GM'||!await obr.scene.isReady())return [];const [a,b]=await Promise.all([obr.scene.items.getItems(),obr.scene.local.getItems()]);return [...new Map([...a,...b].filter(x=>x.layer==='CHARACTER').map(x=>[x.id,x])).values()].map(x=>({id:x.id,name:x.name||x.text?.plainText||'PNJ sans nom',hidden:x.visible===false,archives:x.metadata?.[ASSET]?.id===x.id})).sort((a,b)=>a.name.localeCompare(b.name,'fr'));}
 async function read(id){const ctx=await context();const token=await target(ctx,id);if(token.metadata?.[ASSET]?.id===id){let record;await storage.atomicArchivesRecord(ctx.room,ctx.owner,id,r=>{if(!r||r.scene!==ctx.scene)throw Error('La fiche Archives de ce PNJ est indisponible sur cet appareil.');record=r;return r;});return {lines:record.sr6Inventory||[],archives:true};}return {lines:(await storage.getStored(storage.inventoryKey({...ctx,token:id})))?.lines||[],archives:false};}
 function write(id,operation){
  const task=sequence.catch(()=>{}).then(async()=>{
   const ctx=await context();const token=await target(ctx,id);await sameContext(ctx);
   const archives=token.metadata?.[ASSET]?.id===id;
   if(archives){
    const next=await storage.atomicArchivesRecord(ctx.room,ctx.owner,id,record=>{if(!record||record.scene!==ctx.scene||record.kind!=='TOKEN')throw Error('La fiche Archives de ce PNJ est indisponible sur cet appareil.');const lines=operation(record.sr6Inventory||[]);return updateNpcSheetRecord(record,lines,equipment);});
    return {lines:next.sr6Inventory,archives:true};
   }
   const key=storage.inventoryKey({...ctx,token:id});const saved=await storage.mutateStored(key,previous=>({lines:operation(previous?.lines||[]),updatedAt:new Date().toISOString(),name:token.name||'PNJ'}));return {lines:saved.lines,archives:false};
  });sequence=task;return task;
 }
 function transfer(id,cart){const clean=safeCart(cart,equipment);return write(id,lines=>mergeInventory(lines,clean));}
 function remove(id,itemId){return write(id,lines=>lines.filter(x=>x.id!==itemId));}
 function replace(id,lines){const clean=lines.length?safeCart(lines,equipment):[];return write(id,()=>clean);}
 async function installMenu(){
  if(!available())return ()=>{};let installed=false,tail=Promise.resolve();
  const menu={id:NAMESPACE+'/inventory-menu',icons:[{icon:new URL('./icon.svg',import.meta.url).href,label:'Équipement Shadowrun',filter:{roles:['GM'],min:1,max:1,every:[{key:'layer',value:'CHARACTER'}]}}],onClick:async ({items})=>{try{if(await role()!=='GM'||items.length!==1)return;const url=new URL('./index.html',import.meta.url);url.searchParams.set('tab','mj');url.searchParams.set('token',items[0].id);await obr.modal.open({id:NAMESPACE+'/inventory',url:url.href,width:1080,height:760});}catch(e){await obr.notification.show(e.message,'WARNING');}}};
  async function reconcile(){if(!active)return;if(await role()==='GM'){if(!installed){await obr.contextMenu.create(menu);installed=true;}}else if(installed){await obr.contextMenu.remove(menu.id);installed=false;}}
  const refresh=()=>{tail=tail.catch(()=>{}).then(reconcile);void tail.catch(()=>{});};const off=obr.player.onChange(refresh);await reconcile();return ()=>{off?.();active=false;void tail.finally(()=>installed?obr.contextMenu.remove(menu.id):undefined).catch(()=>{});};
 }
 return {available,role,tokens,read,transfer,remove,replace,installMenu,context,close(){active=false;}};
}
