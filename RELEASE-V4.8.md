# Les Archives de l'Imaginaire — V4.8 : barre Owlbear

## Modifications uniquement esthétiques

- Barre d'outils flottante : boutons façon Owlbear — surfaces charbon, contours fins, icônes SVG mono-ligne, contrastes plus légers, surbrillance douce. Les commandes, leurs événements et leur ordre sont inchangés.
- Réduire / Afficher la barre d'outils : chevron dédié en tête de barre, indépendant de la poignée de déplacement. En mode réduit restent le chevron et (en MJ) la poignée pour déplacer la barre.
- L'état réduit/ouvert est enregistré sur cet appareil dans une nouvelle clé archives_quick_dock_collapsed_v48. Le positionnement conserve sa clé et le glisser-déposer originaux.
- Barre verticale défilable si l'écran est bas ; barre horizontale défilable si l'écran est étroit. Chevron accessible au tactile et au clavier.
- Les onglets d'actes, le dock Owlbear, le diagnostic de synchronisation, les en-têtes et les boutons flottants reçoivent une harmonisation visuelle ; l'icône de diagnostic devient un SVG.
- Aucun bouton historique supprimé ou redirigé. Les réglages de cellule, secrets, invitations, transferts et sauvegardes ne changent pas.

## Conservation de la base

La V4.8 réutilise intégralement le HTML V4.7 et ajoute seulement deux références de ressources cosmétiques. Toutes les données sauvegardées restent intactes, sans migration.

## Liens après publication

- Application : archives-app-v57-v48.html
- Manifeste Owlbear cohérent : manifest-v48.json
- L'ancienne version archives-app-v56-v47.html reste disponible pour revenir en arrière.
- Le nouveau manifeste Owlbear V4.8 cible la nouvelle application et conserve les invitations des joueurs, le grimoire doré et le traitement des transferts. Il ne modifie pas les commandes d'Owlbear.

## Vérification

Tests automatisés en DOM simulé : réduction, réouverture, persistance, mode joueur, poignée de déplacement conservée et commandes existantes intactes.
Les tests réels sur Chrome et tablette Android restent à effectuer. Les icônes Owlbear sont une inspiration stylistique, pas une copie de leurs images propriétaires.
