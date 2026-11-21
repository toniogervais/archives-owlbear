export const THEMES = {
 regles: ['Système de jeu', 'Tests, Atout, actions et états'],
 competences: ['Compétences', 'Attributs, spécialisations et usages'],
 combat: ['Combat', 'Initiative, attaque, défense et dommages'],
 magie: ['Magie', 'Sorts, esprits, adeptes et astral'],
 rigging: ['Pilotage et drones', 'Véhicules, drones et poursuites'],
 matrice: ['Matrice', 'Actions, programmes et technomancie'],
 creatures: ['Bestiaire', 'Créatures, habitats et pouvoirs'],
 equipement: ['Équipement', 'Matériel, caractéristiques et prix'],
 pnj: ['PNJ et contacts', 'Profils, professionnalisme et contacts'],
 personnage: ['Personnages', 'Création, traits et progression'],
 soins: ['Soins et récupération', 'Premiers soins, médikits et guérison'],
 social: ['Interactions sociales', 'Négociation, influence et intentions'],
 variantes: ['Règles optionnelles', 'Variantes et options de campagne'],
 mj: ['Maîtriser le jeu', 'Scénarios, rencontres et récompenses'],
 univers: ['Sixième Monde', 'Lieux, organisations et vie dans les Ombres']
};
export function topicOf(e) {
 if(e.kind==='edgeaction'||e.kind==='edgeboost')return e.topic||'regles';
 const p=e.page, src=e.source, t=e.topic, k=e.kind;
 if(k==='npc')return 'pnj';
 if(k==='creature')return 'creatures';
 if(k==='equipment')return 'equipement';
 if(['soins','competences','social','regles','pnj'].includes(t))return t;
 if(src==='core'){
  if(p>=100&&p<=109)return 'competences';
  if(p>=40&&p<=59)return p>=46&&p<=50?'combat':'regles';
  if(p>=212&&p<=220)return 'pnj';
  if(p>=125&&p<=127)return 'soins';
  if(p>=236&&p<256&&t==='mj')return 'mj';
 }
 if(src==='feu'&&p>=131&&p<147)return 'pnj';
 if(src==='companion'&&p>=161&&p<=177)return 'pnj';
 return THEMES[t]?t:'univers';
}
export function topicsOf(e){
 const primary=topicOf(e), out=new Set([primary]);
 if(e.optional)out.add('variantes');
 if(e.kind==='equipment'&&['Véhicules','Drones'].includes(e.category))out.add('rigging');
 if(e.kind==='equipment'&&e.category==='Matrice et logiciels')out.add('matrice');
 if(e.kind==='equipment'&&e.category==='Matériel magique')out.add('magie');
 if(primary==='social')out.add('competences');
 if(primary==='soins'&&e.source==='core'&&e.page>=130)out.add('magie');
 return [...out];
}
export function hasRoll(e){
 return e.kind==='roll'||Boolean(e.procedure?.test)||Boolean(e.fields?.some(f=>/^(?:jet|réserve|test)(?: de dés)?$/i.test(f.label)));
}
export function mergeTableRules(rules, extra) {
 const updates=extra?.updates||{};
 return [...rules.map(r=>{
  const u=updates[r.id];
  return u?{...r,...u,procedure:u.procedure?{...r.procedure,...u.procedure}:r.procedure}:r;
 }),...(extra?.rules||[])];
}
