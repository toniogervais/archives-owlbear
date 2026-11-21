// Techniques de combat : Feu nourri, p. imprimées 88–93. Les coûts sont ceux de l'index p. 92.
export const EDGE_COMBAT=[
 // [domaine, nom, coût, action associée, résumé en français, page PDF]
 ['Exploration et déplacement','Adroit comme un singe','2','Accompagne Escalader','Augmenter la distance d’escalade couverte par succès ; une Allonge accrue modifie cette distance.',90],
 ['Combat','Ancré au sol','2','Accompagne un test de défense','Résister à un renversement en utilisant un test d’Athlétisme + Agilité, dont les succès augmentent la résistance au renversement.',90],
 ['Combat','Armoire à glace','2','Accompagne Intercepter','Réduire le déplacement de l’adversaire intercepté ; une réussite suffisante le stoppe au contact.',91],
 ['Combat','Attaque ciblée : Destruction d’arme','5','Accompagne toute attaque (action majeure)','Viser l’arme plutôt que le porteur ; selon les dommages et sa Structure, la détruire ou diminuer durablement ses Scores Offensifs.',91],
 ['Combat','Attaque ciblée : Neutraliser','2','Accompagne toute attaque (action majeure)','Au lieu d’endommager la cible, provoquer l’état Désorienté si la valeur des dommages modifiée dépasse sa Réaction.',91],
 ['Combat','Béquille','2','Accompagne toute attaque (action majeure)','Frapper la jambe ou une articulation afin de réduire les possibilités de mouvement de l’adversaire.',91],
 ['Combat','Claque assourdissante','2','Accompagne toute attaque (action majeure)','Si les succès nets dépassent la Volonté, infliger l’état Assourdi pendant un nombre de rounds égal aux succès nets ; pas de dommages.',91],
 ['Combat','Clouer','2','Accompagne une attaque avec arme de jet ou de trait (action majeure)','Clouer une cible au mur ou au sol : si la valeur de dommages modifiée dépasse son Agilité, elle subit Immobilisé.',91],
 ['Combat','Coup bas','2','Accompagne une attaque de mêlée (action majeure)','Si la valeur de dommages modifiée dépasse la Volonté, infliger Confus pendant un nombre de rounds égal aux succès nets ; sans dommages.',91],
 ['Combat','Démonstration de force','1','Accompagne Bloquer (action mineure)','Sous conditions, remplacer le Score Défensif du personnage par le Score Offensif de son arme de mêlée.',91],
 ['Combat','Diversion','2','Accompagne une attaque de mêlée (action majeure)','Détourner l’attention de la cible avec un objet ou un coup inattendu pour gêner sa riposte.',91],
 ['Combat','Enchevêtrer','2','Accompagne une lutte avec arme exotique (action majeure)','Avec un fouet, une chaîne ou des bolas, immobiliser la cible par une manœuvre de lutte et un test adapté.',92],
 ['Combat','Évasion karmique','2','Accompagne Bloquer ou Esquiver (action mineure)','Profiter d’une défense active pour limiter les effets d’état causés par l’attaque.',92],
 ['Interactions sociales','Faire le mort','3','Accompagne Utiliser une compétence — Escroquerie (majeure en combat)','Tromper un adversaire en se faisant passer pour inconscient, vaincu ou plus grièvement blessé.',92],
 ['Combat','Fracture','4','Accompagne toute attaque (action majeure)','Viser un membre précis avec un malus de 4 D6 afin de diminuer ses capacités selon les conditions du texte.',92],
 ['Combat','Frappe à la gorge','2','Accompagne une attaque de mêlée (action majeure)','Si les succès nets dépassent l’Agilité, infliger l’état Muet pendant autant de rounds.',92],
 ['Combat','Frappe aveuglante','4','Accompagne toute attaque (action majeure)','En cas de succès, infliger Aveuglé à un niveau égal à la moitié des succès nets arrondie au supérieur.',92],
 ['Exploration et déplacement','Parkour','2','Accompagne Sprinter (action majeure)','Combiner déplacements horizontaux et verticaux lors d’un sprint sur des obstacles.',92],
 ['Combat','Portée étendue','1','Accompagne une attaque de mêlée (action majeure)','Avec deux armes de mêlée, étendre de deux mètres la portée proche pendant la confrontation.',92],
 ['Interactions sociales','Présence intimidante','2','Accompagne Utiliser une compétence — Influence (majeure en combat)','Exploiter sa prestance pour renforcer son intimidation ; appliquer les conditions de la manœuvre.',92],
 ['Combat','Prompt à dégainer','2','Accompagne Dégainer rapidement (mineure) puis Attaquer (majeure)','Autorise le dégainé rapide avec n’importe quelle arme de mêlée, suivi de l’attaque.',93],
 ['Combat','Protéger l’essentiel','2','Accompagne Intercepter (action mineure)','Se déplacer pour intercepter un coup destiné à un allié proche et subir les dommages à sa place.',93],
 ['Interactions sociales','Provocation','1','Accompagne Influence (action majeure en combat)','Influence + Charisme contre Volonté + Intuition ; augmenter le Score Défensif de l’allié protégé selon les succès nets.',93],
 ['Combat','Projection','4','Accompagne une lutte (action majeure)','Projeter une cible saisie au moyen d’un test de Combat rapproché + Force opposé à Constitution + Force.',93],
 ['Combat','Repousser un adversaire','2','Accompagne une attaque de mêlée après déplacement','Transformer des succès d’une charge en distance de recul imposée à l’ennemi.',93],
 ['Combat','Retour à l’envoyeur !','3','Accompagne Éviter (mineure), puis saisir et lancer','Récupérer et relancer une grenade pendant sa trajectoire, après un test d’Athlétisme + Réaction.',93],
 ['Combat','Riposte','4','Accompagne Bloquer (mineure)','Réduire de deux la base des dommages reçus, puis infliger des dommages en retour si la défense réussit.',93],
 ['Exploration et déplacement','Roulé-boulé','1','Accompagne l’état À terre, pendant une attaque subie','Modifier d’un mètre au plus le point de chute pour mieux se placer.',93],
 ['Exploration et déplacement','Se rattraper aux branches','2','Accompagne Tomber, test d’Athlétisme (réactif)','Athlétisme + Agilité : chaque succès réduit la distance de chute donnant lieu à des dommages.',94],
 ['Combat','Simuler','2','Accompagne toute attaque (majeure)','Ne pas infliger de dommages : diminuer le Score Défensif de l’adversaire au round suivant selon les succès nets.',94],
 ['Combat','Tir de couverture','3','Accompagne une attaque en rafales ou automatique (majeure)','Sacrifier une part des dommages pour conférer un niveau de couvert aux alliés face aux ennemis concernés.',94],
 ['Combat','Transfert de force','3','Accompagne Faire trébucher et un test défensif (mineure)','Par un test d’Athlétisme + Agilité, retourner l’élan de l’attaque adverse pour la renverser.',94],
 ['Exploration et déplacement','Vif comme le vent','3','Accompagne Sprinter (majeure)','Convertir des succès de sprint en niveaux de Couvert temporaire jusqu’à Couvert IV.',94]
];
export const EDGE_COMBAT_BONUS=[
 ['Combat','Je l’ai déjà vu dans une tridéo','4','Pour la prochaine action','Aucune action supplémentaire','Utiliser une technique d’art martial non apprise pour une seule action, sans bénéficier de la réduction de coût issue d’une technique acquise.',95],
 ['Soins et récupération','Se rétablir','3 par niveau / 5 sans niveau','Pendant la récupération','Action majeure','Réduire d’un niveau un état invalidant subi dans la rencontre, ou supprimer un état sans niveau pour cinq points.',95]
];
