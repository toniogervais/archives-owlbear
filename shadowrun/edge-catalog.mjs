import {EDGE_GENERAL} from './edge-general.mjs?v=143';
import {EDGE_COMBAT,EDGE_COMBAT_BONUS} from './edge-combat.mjs?v=143';
import {EDGE_SPECIAL} from './edge-special.mjs?v=143';

export const EDGE_CATEGORIES=['Système de jeu','Combat','Magie','Matrice','Pilotage et drones','Poursuites','Interactions sociales','Exploration et déplacement','Soins et récupération','Créatures et dressage'];
const topic={ 'Système de jeu':'regles',Combat:'combat',Magie:'magie',Matrice:'matrice',
 'Pilotage et drones':'rigging',Poursuites:'rigging','Interactions sociales':'social',
 'Exploration et déplacement':'competences','Soins et récupération':'soins','Créatures et dressage':'creatures'};
const sourcePage=(source,page)=>({source,page,printedPage:page-2});
const safeCost=cost=>String(cost).replace(/\s*points? d[’']Atout/g,'').trim();
const build=(type,category,title,cost,moment,action,summary,source,page,i)=>{
 const kind=type==='action'?'edgeaction':'edgeboost',name=title,
       edgeCost=safeCost(cost),edgeTiming=moment,edgeAction=action,
       section=kind==='edgeaction'?'Actions d’Atout':'Bonus d’Atout';
 return {id:'sr6-edge-'+source+'-'+kind+'-'+i,kind,source,...sourcePage(source,page),
  title,name,category,topic:topic[category]||'regles',path:[section,category],
  edgeCost,edgeTiming,edgeAction,summary,optional:source==='companion',
  tags:[section,'atout','points d’Atout',category,cost,moment,action],
  fields:[
   {label:'Coût en points d’Atout',value:edgeCost},
   {label:'Moment d’utilisation',value:edgeTiming},
   {label:'Action majeure ou mineure',value:edgeAction},
   {label:'Domaine',value:category}
  ]
 };
};
export const EDGE_ENTRIES=[
 ...EDGE_GENERAL.map(([type,cat,title,cost,moment,action,summary,page],i)=>build(type,cat,title,cost,moment,action,summary,'core',page,i)),
 ...EDGE_COMBAT.map(([cat,title,cost,action,summary,page],i)=>build('action',cat,title,cost,'Avant le jet',action,summary,'feu',page,i)),
 ...EDGE_COMBAT_BONUS.map(([cat,title,cost,moment,action,summary,page],i)=>build('bonus',cat,title,cost,moment,action,summary,'feu',page,EDGE_COMBAT.length+i)),
 ...EDGE_SPECIAL.map(([type,cat,title,cost,moment,action,summary,source,page],i)=>build(type,cat,title,cost,moment,action,summary,source,page,i))
];
export const EDGE_COUNTS={
 actions:EDGE_ENTRIES.filter(e=>e.kind==='edgeaction').length,
 bonus:EDGE_ENTRIES.filter(e=>e.kind==='edgeboost').length,
 total:EDGE_ENTRIES.length
};
