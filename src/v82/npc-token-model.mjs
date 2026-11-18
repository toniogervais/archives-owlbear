/* V4.65 — Modèle de fiche PNJ pour les transferts privés Owlbear.
 * Aucun champ de cette fiche ne doit être mis dans les métadonnées d'un objet de scène.
 */
export const ATTRIBUTES = ['CON','AGI','RÉA','FOR','VOL','LOG','INT','CHA','MAG','ESS'];
export const COMBAT = ['SD','I/DI','PA','ME','DÉPLACEMENT','DRAIN'];
export const SECTIONS = [
  ['competences','Compétences'],['sorts','Sorts'],['augmentations','Augmentations'],
  ['equipement','Équipement'],['armes','Armes'],['pouvoirs','Pouvoirs'],['notes','Notes MJ']
];
const text = (value,max) => typeof value==='string' ? value.slice(0,max) :
  typeof value==='number' && Number.isFinite(value) ? String(value).slice(0,max) : '';
const number = (value,max) => Number.isFinite(Number(value)) ?
  Math.max(0,Math.min(max,Math.trunc(Number(value)))) : 0;
export function normalizeTokenNpcSheet(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) return null;
  const attributes={},combat={},sections={},condition={};
  for(const key of ATTRIBUTES) attributes[key]=text(input.attributes?.[key],32);
  for(const key of COMBAT) combat[key]=text(input.combat?.[key],72);
  for(const [key] of SECTIONS) sections[key]=text(input.sections?.[key],12000);
  for(const key of ['physical','stun']){
    const total=number(input.condition?.[key]?.total,60);
    condition[key]={total,damage:Math.min(total,number(input.condition?.[key]?.damage,60))};
  }
  const professionnalisme=input.professionnalisme==='' || input.professionnalisme==null ?
    null : number(input.professionnalisme,99);
  const sheet={professionnalisme,attributes,combat,sections,condition};
  return hasTokenNpcSheet(sheet)?sheet:null;
}
export function hasTokenNpcSheet(sheet) {
  return !!sheet && (
    sheet.professionnalisme!==null && sheet.professionnalisme!==undefined ||
    Object.values(sheet.attributes||{}).some(v=>!!String(v||'').trim()) ||
    Object.values(sheet.combat||{}).some(v=>!!String(v||'').trim()) ||
    Object.values(sheet.sections||{}).some(v=>!!String(v||'').trim()) ||
    ['physical','stun'].some(key=>Number(sheet.condition?.[key]?.total)>0)
  );
}
export function privateTokenSheet(record) {
  return record?.kind==='TOKEN' ? normalizeTokenNpcSheet(record.npcSheet) : null;
}

// Public marker: never include the actual characteristics, notes or wounds.
export function publicTokenMarker(record){
  return {id:record.id,version:record.version,
    hasSheet:record.kind==='TOKEN'&&hasTokenNpcSheet(record.npcSheet)};
}


/* V4.66 — Les blessures modifiées dans Owlbear restent privées au MJ.
 * Le prochain transfert garde les blessures locales tant que les valeurs
 * sources des Archives n'ont pas elles-mêmes été changées.
 */
const kinds=['physical','stun'];
const clampTrack=(value,total)=>Math.min(total,Math.max(0,Number.isFinite(Number(value))?Math.trunc(Number(value)):0));
const sameTrack=(a,b)=>!!a&&!!b&&Number(a.total)===Number(b.total)&&Number(a.damage)===Number(b.damage);
export function updatePrivateTokenCondition(record,kind,patch){
  if(!record||record.kind!=='TOKEN'||!kinds.includes(kind)||
     !patch||typeof patch!=='object')throw Error('Moniteur de blessures invalide.');
  const sheet=privateTokenSheet(record);
  if(!sheet)throw Error('La fiche du personnage est indisponible.');
  const current=sheet.condition[kind];
  const total=patch.total===undefined?current.total:clampTrack(patch.total,60);
  const damage=patch.damage===undefined?current.damage:clampTrack(patch.damage,60);
  if((patch.total!==undefined&&!Number.isInteger(Number(patch.total)))||
     (patch.damage!==undefined&&!Number.isInteger(Number(patch.damage))))
    throw Error('Indique un nombre entier de cases et de blessures.');
  sheet.condition[kind]={total,damage:Math.min(total,damage)};
  return {...record,npcSheet:sheet};
}
export function mergeTransferredTokenCondition(previous,input){
  const sheet=normalizeTokenNpcSheet(input);
  if(!sheet)return {sheet:null,origin:null};
  const origin={};
  for(const kind of kinds){
    const incoming={...sheet.condition[kind]};
    origin[kind]=incoming;
    if(previous?.kind==='TOKEN' &&
       sameTrack(previous?.npcConditionOrigin?.[kind],incoming)){
      const saved=privateTokenSheet(previous)?.condition?.[kind];
      if(saved)sheet.condition[kind]={...saved};
    }
  }
  return {sheet,origin};
}
