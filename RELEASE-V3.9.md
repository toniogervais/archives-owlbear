# Les Archives de l'Imaginaire — V3.9 (prototype de navigation intégrée)

## Objectif

Corriger la V3.8 : les Archives restent l'application principale, Owlbear ne s'ouvre plus dans un autre onglet.

## Implémentation

- Nouvelle page `archives-integrated-v39.html`, distincte de la V3.8, sans écrasement.
- Le canevas V51 est chargé comme précédemment et reste monté pendant le passage à la carte.
- Le bouton Owlbear ouvre un panneau plein écran à l'intérieur de la page des Archives, contenant une iframe sur le lien de la salle mémorisé dans la V3.8.
- Un seul bouton visible « Retour aux Archives » masque la carte et révèle le canevas préservé.
- Ni `window.open` ni navigation vers un autre onglet ne sont utilisés.
- Le lien de salle enregistré dans la V3.8 est réutilisé, sans nouvelle saisie.

## Limitation majeure

L'intégration de la salle Owlbear dans une iframe est **expérimentale**. Si Owlbear applique des restrictions `frame-ancestors` ou `X-Frame-Options` ou des restrictions d'authentification en contexte tiers, son interface ne s'affichera pas. Nous ne prétendons pas disposer d'un droit ni d'une API autorisant l'intégration inverse. Ne pas utiliser un serveur proxy pour retirer les protections.

La voie officiellement documentée est celle d'une extension qui intègre **les Archives dans Owlbear** en utilisant `OBR.modal.open`. Cette voie est déjà présente dans les versions précédentes. Un basculement dans une fenêtre/onglet unique via extension pourra constituer le repli si l'iframe extérieure échoue.

## Validation

Tests statiques effectués : structure de la page, bouton de retour, réutilisation du lien, absence d'ouverture d'onglet. Aucune validation en situation réelle n'a été effectuée.

La V3.8 publiée reste inchangée. Ne pas mettre la V3.9 en production sans test.
