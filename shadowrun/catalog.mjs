import {normalize} from './model.mjs?v=142';
import {THEMES,topicOf,topicsOf,hasRoll} from './themes.mjs?v=142';

export const KIND_NAMES={rule:'Règles',indexed:'Rubriques des livres',action:'Actions',edgeaction:'Actions d’Atout',edgeboost:'Bonus d’Atout',roll:'Jets',dice:'Jets D6',skillguide:'Compétence',equipment:'Équipement',npc:'PNJ',creature:'Bestiaire',reference:'Références',page:'Pages'};
export const EQUIPMENT_ORDER=['Armes','Munitions et explosifs','Armures et protections','Modifications et accessoires','Augmentations','Matrice et logiciels','Véhicules','Drones','Équipement général','Matériel magique','PACKs','Équipement pour créatures'];
const n=normalize;
function match(text,expressions){
 for(const [pattern,name] of expressions)if(pattern.test(text))return name;
 return '';
}
const from=(e)=>[e.name,e.title,...(e.path||[])].filter(Boolean).map(n);
const path=(e)=> (e.path||[]).map(n).join(' | ');
function equipmentSub(e){
 const cat=e.category||'Équipement général',label=n(e.name||e.title),trail=path(e);
 const check=arr=>match(label,arr)||match(trail,arr);
 switch(cat){
 case 'Armes':{
  // Prefer the precise printed family of the item's own table row.
  // Earlier path components can contain a previous heading on a multi-column page.
  const last=n((e.path||[]).at(-1)||'');
  const precise=match(last,[
   [/pistolets? de poche/,'Pistolets de poche'],[/pistolets? legers?/,'Pistolets légers'],
   [/pistolets? lourds?/,'Pistolets lourds'],[/pistolets? automatiques?/,'Pistolets automatiques'],
   [/mitraillettes?/,'Mitraillettes'],[/mitrailleuses?/,'Mitrailleuses'],
   [/shotguns?|fusils? a pompe/,'Shotguns'],[/fusils?/,'Fusils'],
   [/armes? tranchantes/,'Armes tranchantes'],[/armes? contondantes/,'Armes contondantes']
  ]);
  if(precise)return precise;
  const named=match(label,[
   [/arbalet|arbalete/,'Arbalètes'],[/\barc\b|arc a poulies/,'Arcs et armes de trait'],
   [/taser|pulsar|shock/,'Tasers'],[/pistolet|predator|manhunter|slivergun|roomsweeper|guardian/,'Pistolets'],
   [/mitraillette|smg/,'Mitraillettes'],[/shotgun|fusil a pompe/,'Shotguns'],
   [/mitrailleuse|minigun/,'Mitrailleuses'],[/fusil|carabine|sniper/,'Fusils'],
   [/lance.roquette|lance.grenade|lanceur/,'Lanceurs'],
   [/grenade|explosi|mine|charge explosive/,'Explosifs'],
   [/katana|sabre|epee|dague|couteau|hache|machette|lame|rapiere/,'Armes tranchantes'],
   [/matraque|batte|marteau|tonfa|bete|gourdin|poing americain/,'Armes contondantes']
  ]);
  if(named)return named;
  return check([
   [/pistolet[s]? de poche/,'Pistolets de poche'],[/pistolet[s]? leger/,'Pistolets légers'],
   [/pistolet[s]? lourd/,'Pistolets lourds'],[/pistolet[s]? automatique/,'Pistolets automatiques'],
   [/mitraillette/,'Mitraillettes'],[/shotgun|fusils? a pompe/,'Shotguns'],[/fusils?/,'Fusils'],
   [/mitrailleuse|canon.s? d.assaut/,'Mitrailleuses et canons'],
   [/arbalet/,'Arbalètes'],[/armes? de jet|armes? de trait/,'Arcs, jets et traits'],
   [/armes? tranchantes/,'Armes tranchantes'],[/armes? contondantes/,'Armes contondantes'],
   [/armes? de melee|corps a corps/,'Armes de mêlée'],
   [/taser/,'Tasers'],[/lanceur/,'Lanceurs'],[/explosif|dispersion/,'Explosifs'],
   [/armes? (exotique|speciale|cybernetique)/,'Armes spéciales']
  ])||'Autres armes';
 }
 case 'Armures et protections':
  return check([[/casque|masque balistique/,'Casques et masques'],[/bouclier/,'Boucliers'],
   [/modification|accessoire|renfort d.armure/,'Modifications d’armures'],
   [/vêtement|vetement|costume|manteau|robe|collection|mode/,'Vêtements blindés'],
   [/armure|protection|gilet/,'Armures et gilets']])||'Autres protections';
 case 'Augmentations':
  return check([[/cyberbras|cyberjambe|membre cybernetique/,'Membres cybernétiques'],
   [/implant cerebral|encephal|cerebral/,'Implants cérébraux'],
   [/implant auriculaire|cyberoreille/,'Implants auditifs'],
   [/cyberoeil|implant oculaire/,'Implants visuels'],
   [/implant corporel/,'Implants corporels'],[/arme cybernetique/,'Armes cybernétiques'],
   [/bioware de culture/,'Bioware de culture'],[/bioware/,'Bioware'],
   [/augmentation|cyberware|implant/,'Autres augmentations']])||'Autres augmentations';
 case 'Matrice et logiciels':
  return check([[/commlink/,'Commlinks et applis'],[/cyberdeck|cyberhack/,'Cyberdecks et cyberhacks'],
   [/cyberjack/,'Cyberjacks'],[/autosoft|e.soft/,'Autosofts'],
   [/programme|cyberprogram|logiciel|agent/,'Programmes et logiciels'],
   [/serveur|terminal|ordinateur/,'Serveurs et terminaux'],
   [/marqueur|rfid|derivateur|relais|boitier|gadget|accessoire/,'Appareils et accessoires']])||'Autre matériel matriciel';
 case 'Drones':
  return check([[/drone[s]? aquatique|sous.marin/,'Drones aquatiques'],
   [/drone[s]? aerien|drone[s]? aeriens|rotor|volant/,'Drones aériens'],
   [/drone[s]? anthropomorphe/,'Drones anthropomorphes'],
   [/drone[s]? terrestre|drone[s]? roulant|roues|chenille/,'Drones terrestres'],
   [/microdrone/,'Microdrones'],[/minidrone/,'Minidrones'],
   [/petit.s? drones?|drones? de petite taille/,'Petits drones'],
   [/drones? moyens?|drones? de taille moyenne/,'Drones moyens'],
   [/grands? drones?|drones? de grande taille/,'Grands drones'],
   [/drone/,'Autres drones']])||'Autres drones';
 case 'Véhicules':
  return check([[/moto|bike/,'Motos'],[/pick.up/,'Pick-up'],[/voiture/,'Voitures'],
   [/fourgon|camion/,'Fourgons et camions'],[/aeroglisseur/,'Aéroglisseurs'],
   [/militaire|securite|blind/,'Véhicules militaires'],
   [/sous.marin|submersible/,'Sous-marins et submersibles'],[/bateau|navire|voilier|embarcation/,'Bateaux et navires'],
   [/helicopter/,'Hélicoptères'],[/avion|voilure fixe/,'Avions'],[/dirigeable/,'Dirigeables'],
   [/vertical|adac|adav/,'Décollage vertical'],[/vehicule aerien|planeur/,'Véhicules aériens'],
   [/vehicule|car|engin/,'Autres véhicules']])||'Autres véhicules';
 case 'Munitions et explosifs':
  return check([[/grenade/,'Grenades'],[/roquette|missile/,'Roquettes et missiles'],
   [/explosi|mine|detonat/,'Explosifs'],[/fleche|carreau/,'Flèches et carreaux'],
   [/munition|balle|cartouche/,'Munitions et balles']])||'Autres consommables';
 case 'Modifications et accessoires':
  return check([[/modification d.armure|blindage/,'Modifications d’armures'],
   [/accessoires? pour armes?|visee|silencieux|chargeur|holster|fourreau|etui/,'Accessoires d’armes'],
   [/personnalisation|modifications? d.armes?|canon|crosse|rail|stabilisateur/,'Modifications d’armes'],
   [/mod.s? electronique|autopilote|senseurs/,'Modifications électroniques'],
   [/chassis|armature|propulsion|motorisation|man[iœ]abilite/,'Modifications de véhicules'],
   [/accessoire/,'Autres accessoires'],[/modification/,'Autres modifications']])||'Autres modifications';
 case 'Équipement général':
  return check([[/biotech|medikit|medical|medicale|medic/,'Médical et biotech'],
   [/survie|plein air|camping/,'Survie et plein air'],[/intrusion|effraction|securite/,'Intrusion et sécurité'],
   [/senseurs?|radar|scanner/,'Senseurs'],[/optique|imagerie|visuel|vision/,'Optique et imagerie'],
   [/audio|auditif|oreille/,'Audio'],[/outil|bricolage|atelier/,'Outils'],
   [/chimique|toxine|drogue/,'Produits chimiques'],
   [/identit|sin|creditube/,'Identité et finances'],[/communication|contre.mesure/,'Communication']])||'Divers et quotidien';
 case 'PACKs':
  return check([[/packs? d.armes?/,'PACKs d’armes'],[/packs? d.augmentations?/,'PACKs d’augmentations'],
   [/packs? de personnages?/,'PACKs de personnages'],[/packs? de vehicules?|vehicule|voiture|moto/,'PACKs de véhicules'],
   [/packs? de drones?/,'PACKs de drones'],[/packs? d.armures?/,'PACKs d’armures'],
   [/packs? de logiciels?|hacker|decker/,'PACKs matriciels']])||'Autres PACKs';
 case 'Matériel magique':
  return check([[/focus/,'Focus'],[/reactif/,'Réactifs'],[/loge/,'Loges magiques'],[/formule/,'Formules magiques']])||'Autre matériel magique';
 default:return (e.path||[]).at(-1)||'Divers';
 }
}
function usefulLast(e){
 const parts=(e.path||[]).filter(Boolean);
 return [...parts].reverse().find(p=>!/(^(?:table(s)?|introduction|generalites|équipement|catalogue d.equipement|arsenal|table des matieres|matrices?)$)/i.test(n(p)))||'Généralités';
}
function themeFacet(e){
 const candidates=(e.path||[]).map(v=>String(v).trim()).filter(Boolean);
 const generic=/^(?:informations de jeu|introduction|generalites|guide pratique|catalogue d.equipement|table des matieres|tables recapitulatives)$/i;
 const useful=candidates.filter(p=>!generic.test(n(p)));
 const family=useful[0]||'Généralités';
 const subcategory=useful.length>1?useful[useful.length-1]:KIND_NAMES[e.kind]||'Rubriques';
 return {family,subcategory};
}
export function classifyEntry(e){
 if(e.kind==='edgeaction'||e.kind==='edgeboost')return {family:e.category||'Système de jeu',subcategory:e.path?.at(-1)||e.category||'Atout'};
 if(e.kind==='equipment')return {family:e.category||'Équipement général',subcategory:equipmentSub(e)};
 if(e.kind==='creature')return {family:e.habitat||'Habitats non précisés',subcategory:usefulLast(e)==='Généralités'?'Créatures':usefulLast(e)};
 if(e.kind==='npc')return {family:(e.path||[]).find(p=>/gang|securite|opposition|contact|militaire|corporati|profil/i.test(n(p)))||'Profils de PNJ',subcategory:usefulLast(e)==='Généralités'?'Profils':usefulLast(e)};
 const key=topicOf(e);
 const family=THEMES[key]?.[0]||'Autres règles';
 return {family,subcategory:usefulLast(e)};
}
export function entryMatchesKind(e,kind){
 if(kind==='favorites'||!kind)return true;
 if(kind==='indexed')return Boolean(e.sourceOnly);
 return kind==='rolls'?hasRoll(e):kind==='dice'?hasRoll(e)||e.kind==='skillguide':e.kind===kind;
}
export function catalogHierarchy(entries,{kind='',topic='',source='',favorites=null,practicalOnly=false}={}){
 const maps=new Map();
 for(const e of entries){
  if(!entryMatchesKind(e,kind)||topic&&!topicsOf(e).includes(topic)||source&&e.source!==source||favorites&&!favorites.has(e.id)||practicalOnly&&!e.summary&&!e.attributes&&!e.fields?.length)continue;
  const info=kind?classifyEntry(e):topic?themeFacet(e):{family:KIND_NAMES[e.kind]||'Références',subcategory:classifyEntry(e).family};
  let node=maps.get(info.family);if(!node){node={name:info.family,count:0,subs:new Map()};maps.set(info.family,node);}
  node.count++;node.subs.set(info.subcategory,(node.subs.get(info.subcategory)||0)+1);
 }
 const order=kind==='equipment'?EQUIPMENT_ORDER:[];
 return [...maps.values()].map(x=>({name:x.name,count:x.count,children:[...x.subs].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'fr'))})).sort((a,b)=>{
  const i=order.indexOf(a.name),j=order.indexOf(b.name);
  if(i!==-1||j!==-1)return (i<0?999:i)-(j<0?999:j);
  return b.count-a.count||a.name.localeCompare(b.name,'fr');
 });
}
// Navigation rapide : huit grandes portes d'entrée, les 12 catégories sources
// et leurs sous-catégories restent inchangées et consultables dans les fiches.
export const QUICK_EQUIPMENT_GROUPS=[
 {name:'Armes',categories:['Armes','Munitions et explosifs']},
 {name:'Armures',categories:['Armures et protections']},
 {name:'Augmentations',categories:['Augmentations']},
 {name:'Matrice',categories:['Matrice et logiciels']},
 {name:'Véhicules / drones',categories:['Véhicules','Drones']},
 {name:'Matériel',categories:['Équipement général','Modifications et accessoires']},
 {name:'Magie',categories:['Matériel magique']},
 {name:'PACKs / divers',categories:['PACKs','Équipement pour créatures']}
];
export function quickEquipmentFacet(e){
 const group=QUICK_EQUIPMENT_GROUPS.find(g=>g.categories.includes(e.category));
 const family=group?.name||'PACKs / divers';
 const detail=n(classifyEntry(e).subcategory);
 const cat=e.category;
 let subcategory;
 if(family==='Armes'){
  if(cat==='Munitions et explosifs')subcategory='Munitions';
  else if(/pistolet/.test(detail))subcategory='Pistolets';
  else if(/fusil|mitraillette|mitrailleuse|shotgun|canon/.test(detail))subcategory='Armes longues';
  else if(/tranchant|contondant|melee|corps a corps/.test(detail))subcategory='Corps à corps';
  else if(/arbalet|arc|trait|jet/.test(detail))subcategory='Arcs & arbalètes';
  else if(/explosif|lanceur|grenade/.test(detail))subcategory='Explosifs & lanceurs';
  else subcategory='Autres armes';
 }else if(family==='Véhicules / drones')subcategory=cat;
 else if(family==='Matériel')subcategory=cat==='Équipement général'?'Matériel général':'Accessoires & modifications';
 else if(family==='PACKs / divers')subcategory=cat;
 else if(family==='Augmentations')subcategory=/bioware/.test(detail)?'Bioware':/cyber|implant|membre/.test(detail)?'Cyberware':'Autres augmentations';
 else if(family==='Matrice')subcategory=/commlink/.test(detail)?'Commlinks':/cyberdeck|cyberhack|cyberjack/.test(detail)?'Cyberdecks':/programme|logiciel|autosoft/.test(detail)?'Logiciels':'Autre matériel matriciel';
 else if(family==='Armures')subcategory=/armure|gilet|vetement/.test(detail)?'Armures & vêtements':'Protections & accessoires';
 else subcategory='Matériel magique';
 return {family,subcategory};
}
export function quickCatalogHierarchy(entries,options={}){
 if(options.kind!=='equipment')return catalogHierarchy(entries,options);
 const counts=new Map(QUICK_EQUIPMENT_GROUPS.map(x=>[x.name,{name:x.name,count:0,subs:new Map()}]));
 for(const e of entries){
  if(!entryMatchesKind(e,'equipment')||options.source&&e.source!==options.source||
     options.topic&&!topicsOf(e).includes(options.topic)||
     options.practicalOnly&&!e.summary&&!e.attributes&&!e.fields?.length||
     options.favorites&&!options.favorites.has(e.id))continue;
  const {family,subcategory}=quickEquipmentFacet(e),g=counts.get(family);
  if(!g)continue;
  g.count++;g.subs.set(subcategory,(g.subs.get(subcategory)||0)+1);
 }
 return [...counts.values()].filter(g=>g.count).map(g=>({
  name:g.name,count:g.count,
  children:[...g.subs].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'fr'))
 }));
}

export function matchFacet(e,{kind='',topic='',family='',subcategory=''}={}){
 if(!family&&!subcategory)return true;
 const quick=kind==='equipment'&&QUICK_EQUIPMENT_GROUPS.some(g=>g.name===family);
 const info=quick?quickEquipmentFacet(e):kind?classifyEntry(e):topic?themeFacet(e):{family:KIND_NAMES[e.kind]||'Références',subcategory:classifyEntry(e).family};
 // Keep precise existing links and searches usable even after replacing the deep menu.
 const precise=quick&&subcategory===classifyEntry(e).subcategory;
 return (!family||info.family===family)&&(!subcategory||info.subcategory===subcategory||precise);
}
