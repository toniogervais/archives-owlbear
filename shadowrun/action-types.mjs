// Classement conservateur : ne pas inventer un coût en actions lorsqu'il n'est pas précisé.
export function actionType(entry) {
 const p=entry?.procedure||{}, phrase=String(p.action||'').trim();
 const low=phrase.toLocaleLowerCase('fr');
 const major=/\bmajeur(?:e|es)?\b/.test(low),minor=/\bmineur(?:e|es)?\b/.test(low);
 if(/\bmajeur(?:e|es)?\b.*\bmineur(?:e|es)?\b|\bmineur(?:e|es)?\b.*\bmajeur(?:e|es)?\b/.test(low)) {
   if(/\brv\b/.test(low)&&/\bra\b/.test(low))return {label:'Majeure en réalité augmentée ; mineure en réalité virtuelle',known:true};
   return {label:'Action majeure et action mineure',known:true};
 }
 if(major)return {label:'Action majeure',known:true};
 if(minor)return {label:'Action mineure',known:true};
 if(/utiliser une compétence|utilisation d'une compétence/i.test(phrase))return {label:'Action majeure en combat (utiliser une compétence)',known:true};
 if(/intervalle|minute|heure|jour|semaine|durée|récupération/i.test(phrase))return {label:'Durée ou intervalle propre au test, hors du découpage ordinaire des actions',known:false};
 if(/selon la manœuvre|selon le mode|selon l'action|selon la situation/i.test(phrase))return {label:'Variable selon la manœuvre ou la situation',known:false};
 if(entry?.kind==='skillguide')return {label:'Variable selon l’utilisation de la compétence ; majeure en combat pour « Utiliser une compétence »',known:false};
 if(entry?.kind==='roll')return {label:'Dépend de l’action à l’origine du jet ; un jet de résistance peut être réactif',known:false};
 if(entry?.kind==='action')return {label:'Action majeure ou mineure non précisée dans la fiche : consulter la règle citée',known:false};
 if(p.test)return {label:'Dépend de l’action à l’origine du jet ; type non précisé dans cette procédure',known:false};
 return null;
}
