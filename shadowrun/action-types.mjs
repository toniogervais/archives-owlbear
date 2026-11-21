// Classement conservateur : ne pas inventer un coût en actions lorsqu'il n'est pas précisé.
export function actionType(entry) {
 const p=entry?.procedure||{};
 const summary=String(entry?.summary||'');
 const direct=String(p.action||'').trim();
 // Les résumés vérifiés des suppléments indiquent parfois le coût en actions sans champ séparé.
 const hasSourceTiming=/\b(?:action\s+mineure|action\s+majeure|mineure\s+(?:libre|légale|illégale|peut)|majeure\s+(?:libre|légale|illégale))\b/i.test(summary);
 const phrase=direct||(hasSourceTiming?summary:'');
 const low=phrase.toLocaleLowerCase('fr');
 const major=/\bmajeur(?:e|es)?\b/.test(low),minor=/\bmineur(?:e|es)?\b/.test(low);
 if(/majeure en combat.*mineure si tous/i.test(low))return {label:'Majeure en combat ; mineure si tous les participants connaissent les Tactiques d’escouade',known:true};
 if(/majeure.*mineure si l.appareil/i.test(low))return {label:'Majeure normalement ; mineure si l’appareil est connecté à une interface de contrôle active',known:true};
 if(/majeure si en combat|majeure en combat|observation.*majeure si en combat/i.test(low))return {label:'Majeure en combat ; hors combat, suivre la durée de la tâche',known:true};
 if(/\bmineure\b.*\bmajeure\b.*attaquer|\bmineure\s*\+\s*\bmajeure\b/i.test(low))return {label:'1 action mineure + 1 action majeure Attaquer',known:true};
 if(/\bmajeur(?:e|es)?\b.*\bmineur(?:e|es)?\b|\bmineur(?:e|es)?\b.*\bmajeur(?:e|es)?\b/.test(low)) {
   if(/\brv\b/.test(low)&&/\bra\b/.test(low))return {label:'Majeure en réalité augmentée ; mineure en réalité virtuelle',known:true};
   return {label:'Action majeure et action mineure',known:true};
 }
 if(major)return {label:'Action majeure',known:true};
 if(minor)return {label:'Action mineure',known:true};
 if(/utiliser une compétence|utilisation d'une compétence/i.test(phrase))return {label:'Action majeure en combat (utiliser une compétence)',known:true};
 if(/intervalle|minute|heure|jour|semaine|durée|récupération/i.test(phrase))return {label:'Durée ou intervalle propre au test, hors du découpage ordinaire des actions',known:false};
 if(/selon la manœuvre|selon le mode|selon l'action|selon la situation/i.test(phrase))return {label:'Variable selon la manœuvre ou la situation',known:false};
 if(/action d.atout/i.test(summary))return {label:'Action d’Atout : son coût en actions dépend de l’attaque ou de l’action associée',known:false};
 if(entry?.kind==='skillguide')return {label:'Variable selon l’utilisation de la compétence ; majeure en combat pour « Utiliser une compétence »',known:false};
 if(entry?.kind==='roll')return {label:'Dépend de l’action à l’origine du jet ; un jet de résistance peut être réactif',known:false};
 if(entry?.kind==='action')return {label:'Action majeure ou mineure non précisée dans la fiche : consulter la règle citée',known:false};
 if(p.test)return {label:'Dépend de l’action à l’origine du jet ; type non précisé dans cette procédure',known:false};
 return null;
}
