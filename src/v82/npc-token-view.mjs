/* V4.65 — Lecture locale, réservée au MJ, d'une fiche associée à un token. */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey,sceneKey,privateArtworkStore} from '../v58/model.mjs';
import {validSession} from '../v56/link.mjs';
import {ATTRIBUTES,COMBAT,SECTIONS,privateTokenSheet} from './npc-token-model.mjs';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
const $=id=>document.getElementById(id);
const element=(tag,cls,text)=>{
  const node=document.createElement(tag);if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const status=$('status'),sheetRoot=$('sheet');
function fail(message){sheetRoot.hidden=true;status.hidden=false;status.textContent=message;}
$('close').addEventListener('click',()=>{
  void OBR.modal.close(modalId).catch(()=>fail('Impossible de fermer la fiche depuis Owlbear.'));
});
function stats(title,keys,values){
  const section=element('section'),heading=element('h2',null,title),grid=element('div','stats');
  for(const key of keys){
    const box=element('div','stat');box.append(element('small',null,key),element('strong',null,values[key]||'—'));grid.append(box);
  }
  section.append(heading,grid);return section;
}
function track(name,value){
  const wrapper=element('div','track'),head=element('strong');
  head.append(element('span',null,name),element('span',null,value.total?value.damage+' / '+value.total:'—'));
  wrapper.append(head);
  if(value.total){
    const boxes=element('div','boxes');
    boxes.setAttribute('aria-label',name+' : '+value.damage+' dégâts sur '+value.total);
    for(let i=0;i<value.total;i++)boxes.append(element('i',i<value.damage?'mark':undefined));
    wrapper.append(boxes);
  }
  return wrapper;
}
function render(record,sheet){
  $('title').textContent=record.title||'Personnage';
  document.title=(record.title||'Personnage')+' · Fiche MJ';
  sheetRoot.replaceChildren();
  sheetRoot.append(element('p','prof','Professionnalisme : '+(sheet.professionnalisme??'—')));
  sheetRoot.append(stats('Caractéristiques',ATTRIBUTES,sheet.attributes));
  sheetRoot.append(stats('Combat et valeurs dérivées',COMBAT,sheet.combat));
  const details=element('div','details');
  for(const [key,label] of SECTIONS){
    if(!sheet.sections[key]?.trim())continue;
    const line=element('div','detail');line.append(element('strong',null,label),element('div',null,sheet.sections[key]));
    details.append(line);
  }
  if(details.childElementCount){
    const section=element('section');section.append(element('h2',null,'Compétences et équipement'),details);
    sheetRoot.append(section);
  }
  const tracks=element('section');tracks.append(element('h2',null,'Moniteurs de blessures'));
  const grid=element('div','tracks');
  grid.append(track('Physique',sheet.condition.physical),track('Étourdissement',sheet.condition.stun));
  tracks.append(grid);sheetRoot.append(tracks);
  status.hidden=true;sheetRoot.hidden=false;
}
async function load(){
  try{
    const id=new URLSearchParams(location.search).get('item');
    if(!validSession(id))throw Error('Identifiant du token invalide.');
    await new Promise(resolve=>OBR.onReady(resolve));
    if(await OBR.player.getRole()!=='GM')throw Error('Cette fiche est réservée au maître de jeu.');
    if(!await OBR.scene.isReady())throw Error('Ouvre une scène Owlbear pour consulter ce personnage.');
    const scene=(await OBR.scene.getMetadata())?.[sceneKey];
    if(!scene)throw Error('La scène Owlbear n’est pas encore reliée aux Archives.');
    const store=await privateArtworkStore(OBR.room.id,OBR.player.id);
    let record;
    try{record=await store.get(id);}finally{store.close();}
    if(!record||record.id!==id||record.scene!==scene||record.kind!=='TOKEN')throw Error('Fiche indisponible dans cette scène. Renvoie le personnage depuis les Archives.');
    const sheet=privateTokenSheet(record);
    if(!sheet)throw Error('Ce personnage n’a pas encore de caractéristiques enregistrées.');
    // An old URL must never reveal data after the token is removed or replaced.
    const [shared,local]=await Promise.all([
      OBR.scene.items.getItems([id]),OBR.scene.local.getItems([id])
    ]);
    const visible=[...shared,...local].some(item=>item.id===id&&
      item.metadata?.[assetKey]?.id===id&&item.metadata[assetKey].version===record.version&&
      item.metadata[assetKey].hasSheet===true);
    if(!visible)throw Error('Ce token n’est plus présent dans la scène Owlbear.');
    if(await OBR.player.getRole()!=='GM')throw Error('Accès à la fiche réservé au maître de jeu.');
    render(record,sheet);
    OBR.player.onChange(player=>{
      if(player.role!=='GM'){sheetRoot.replaceChildren();void OBR.modal.close(modalId).catch(()=>fail('Fiche réservée au MJ.'));}
    });
  }catch(error){fail(error?.message||'Impossible d’afficher les caractéristiques.');}
}
void load();
