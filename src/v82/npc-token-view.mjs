/* V4.66 — Fiche Owlbear privée et moniteurs de blessures modifiables. */
import OBR from '../../assets/owlbear-transfer-sdk-v55.mjs';
import {assetKey,sceneKey,privateArtworkStore} from '../v58/model.mjs';
import {validSession} from '../v56/link.mjs';
import {ATTRIBUTES,COMBAT,SECTIONS,privateTokenSheet,updatePrivateTokenCondition} from './npc-token-model.mjs?v=4700';
const modalId='fr.archives-imaginaire.bridge/npc-token-view-v82';
const $=id=>document.getElementById(id);
const element=(tag,cls,text)=>{
  const node=document.createElement(tag);if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const status=$('status'),sheetRoot=$('sheet'),saveStatus=$('save-status');
let currentId=null,active=true,writeQueue=Promise.resolve();
function fail(message){sheetRoot.hidden=true;status.hidden=false;status.textContent=message;}
function feedback(message,error=false){
  saveStatus.textContent=message;
  saveStatus.classList.toggle('error',error);
  saveStatus.hidden=false;
}
$('close').addEventListener('click',()=>{
  // Ne pas toucher à la sélection : Owlbear garde toutes ses actions natives.
  void OBR.modal.close(modalId).catch(()=>feedback('Impossible de fermer la fiche depuis Owlbear.',true));
});
window.addEventListener('pagehide',()=>{active=false;},{once:true});
function stats(title,keys,values){
  const section=element('section'),heading=element('h2',null,title),grid=element('div','stats');
  for(const key of keys){
    const box=element('div','stat');box.append(element('small',null,key),element('strong',null,values[key]||'—'));grid.append(box);
  }
  section.append(heading,grid);return section;
}
// A fresh copy of the private record is read on each change. This prevents
// an old Owlbear popup from overwriting recently edited characteristics.
async function withPrivateRecord(id,operation){
  if(!active||await OBR.player.getRole()!=='GM')
    throw Error('Modification réservée au maître de jeu.');
  if(!await OBR.scene.isReady())throw Error('La scène Owlbear a été fermée.');
  const scene=(await OBR.scene.getMetadata())?.[sceneKey];
  if(!scene)throw Error('La scène n’est plus reliée aux Archives.');
  const store=await privateArtworkStore(OBR.room.id,OBR.player.id);
  try{
    const record=await store.get(id);
    if(!record||record.id!==id||record.scene!==scene||record.kind!=='TOKEN')
      throw Error('Ce personnage ne se trouve plus dans la scène.');
    if(!privateTokenSheet(record))throw Error('Ce personnage n’a pas de fiche enregistrée.');
    const [shared,local]=await Promise.all([
      OBR.scene.items.getItems([id]),OBR.scene.local.getItems([id])
    ]);
    const present=[...shared,...local].some(item=>item.id===id&&
      item.metadata?.[assetKey]?.id===id&&
      item.metadata[assetKey].version===record.version&&
      item.metadata[assetKey].hasSheet===true);
    if(!present)throw Error('Ce token n’est plus présent dans la scène Owlbear.');
    if(!active||await OBR.player.getRole()!=='GM'||
       (await OBR.scene.getMetadata())?.[sceneKey]!==scene)
      throw Error('Modification réservée au MJ dans la scène active.');
    return await operation(record,store);
  }finally{store.close();}
}
function scheduleSave(kind,patch){
  if(!active||!currentId)return;
  const id=currentId;
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
    const updated=await withPrivateRecord(id,async(record,store)=>{
      const next=updatePrivateTokenCondition(record,kind,patch);
      await store.put(next);
      return next;
    });
    if(!active||currentId!==id)return;
    render(updated,privateTokenSheet(updated));
    feedback('Enregistré');
  }).catch(error=>{if(active)feedback(error?.message||'Enregistrement des blessures impossible.',true);});
  return writeQueue;
}
function track(kind,name,value){
  const wrapper=element('div','track'),head=element('strong');
  wrapper.dataset.kind=kind;
  head.append(element('span',null,name),element('span','track-count',value.total?value.damage+' / '+value.total:'—'));
  wrapper.append(head);
  const controls=element('div','track-controls');
  function numeric(label,value,max,update){
    const field=element('label','track-field'),span=element('span',null,label),input=element('input');
    input.type='number';input.min='0';input.max=String(max);input.step='1';
    input.inputMode='numeric';input.value=String(value);
    input.setAttribute('aria-label',name+' — '+label);
    input.addEventListener('change',()=>{
      const next=Number(input.value);
      if(!Number.isInteger(next)||next<0||next>max){
        feedback('Entre une valeur entière entre 0 et '+max+'.',true);
        input.value=String(value);return;
      }
      if(next!==value)void scheduleSave(kind,{[update]:next});
    });
    field.append(span,input);return field;
  }
  controls.append(numeric('Cases totales',value.total,60,'total'),
    numeric('Dégâts',value.damage,value.total,'damage'));
  wrapper.append(controls);
  const remaining=element('small','track-remaining',value.total?
    'Cases restantes : '+(value.total-value.damage):'Renseigne le total pour ajouter des cases.');
  wrapper.append(remaining);
  if(value.total){
    const boxes=element('div','boxes');boxes.setAttribute('role','group');
    boxes.setAttribute('aria-label',name+' : blessures à cocher');
    for(let i=0;i<value.total;i++){
      const box=element('button','track-box'+(i<value.damage?' mark':''));
      box.type='button';
      box.setAttribute('aria-pressed',String(i<value.damage));
      box.setAttribute('aria-label',name+' : case '+(i+1)+' sur '+value.total);
      box.title=i<value.damage?'Retirer les blessures à partir de cette case':'Marquer les blessures jusqu’à cette case';
      box.addEventListener('click',()=>void scheduleSave(kind,{damage:i<value.damage?i:i+1}));
      boxes.append(box);
    }
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
  const tracks=element('section');tracks.append(element('h2',null,'Points de vie et moniteurs de blessures'));
  const grid=element('div','tracks');
  grid.append(track('physical','Physique',sheet.condition.physical),
    track('stun','Étourdissement',sheet.condition.stun));
  tracks.append(grid);sheetRoot.append(tracks);
  status.hidden=true;sheetRoot.hidden=false;
}
async function load(){
  try{
    const id=new URLSearchParams(location.search).get('item');
    if(!validSession(id))throw Error('Identifiant du token invalide.');
    await new Promise(resolve=>OBR.onReady(resolve));
    currentId=id;
    const record=await withPrivateRecord(id,record=>record);
    render(record,privateTokenSheet(record));
    OBR.player.onChange(player=>{
      if(player.role!=='GM'){
        active=false;sheetRoot.replaceChildren();
        void OBR.modal.close(modalId).catch(()=>fail('Fiche réservée au MJ.'));
      }
    });
  }catch(error){fail(error?.message||'Impossible d’afficher les caractéristiques.');}
}
void load();
