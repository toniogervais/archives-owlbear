# Les Archives de l’Imaginaire — V4.1

## Corrections

- **Ouverture normale depuis l'écran titre** : URL `archives-app-v53-v41.html` sans paramètre.
- Après « Meneur », choisir « Reprendre la partie en cours » pour retrouver le canevas.
- Le bouton Owlbear du canevas est activé visuellement : contour lumineux, opacité normale, curseur cliquable.
- Au premier passage vers Owlbear, ouverture de la salle dans un onglet Edge nommé. Aux passages suivants, tentative de focus de cet onglet **sans navigation ni rechargement**.
- Le bouton de retour de l'extension Owlbear V4.1 tente de réactiver l'onglet Archives existant, sans recharger le canevas.
- Si l'onglet Archives n'est plus accessible, le lien de secours `archives-app-v53-v41.html?resume=1` retourne au **canevas** plutôt qu'à l'écran titre. Dans ce cas, les informations non enregistrées peuvent être perdues : le navigateur doit recharger la page.
- L'invitation manuelle du MJ vers Owlbear depuis le Salon Live et l'invitation de retour depuis Owlbear sont conservées.
- La V4.1 possède ses propres fichiers : les V3.7, V3.8, V3.9 et V4.0 ne sont pas modifiées.

## Limites réelles du navigateur

Edge peut isoler les onglets après navigation sur Owlbear (Cross-Origin-Opener-Policy) et empêcher `window.open('', nom)` de cibler l'onglet d'origine. Ce prototype **essaie** de réactiver l'onglet sans le recharger, mais la réussite n'est pas garantie avant un essai réel. Les onglets déjà ouverts avant le test doivent être fermés ou remplacés par la V4.1.

Les invitations aux joueurs demandent une installation de l'extension V4.1 **dans la même salle**, et un Salon Live actif pour la liaison depuis Les Archives. L'essai de cette étape reste séparé du test de l'écran titre.

## Procédure de vérification

1. Ouvrir `https://toniogervais.github.io/archives-owlbear/archives-app-v53-v41.html` dans Microsoft Edge : l'écran titre doit apparaître.
2. Cliquer « Meneur » puis « Reprendre la partie en cours » : le canevas doit apparaître.
3. Survoler Owlbear : le curseur doit être une main ; cliquer ouvre la salle.
4. De retour dans les Archives, cliquer à nouveau Owlbear : idéalement, l'onglet existant s'active sans écran de chargement.
5. Installer `https://toniogervais.github.io/archives-owlbear/manifest-v41.json` **à la place** de l'extension précédente (et non en parallèle). Dans Owlbear, tester « Retour aux Archives ».
6. Vérifier que le retour conserve le canevas et la position du travail. Si le programme recharge, le signaler comme défaut de la méthode de navigation, pas comme succès.

## Validation

Tests automatisés de syntaxe et de comportement du navigateur simulé. Test multi-onglet réel avec Edge et OAuth/Owlbear **non encore effectué**.
