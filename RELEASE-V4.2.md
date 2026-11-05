# V4.2 — Correction du bouton de retour à droite d'Owlbear

Le retour fonctionnait par le menu d'extension en haut à gauche, pas par l'icône de la barre d'outils à droite.

## Cause probable

Dans la V4.1, le bouton de droite appelait `window.open` depuis l'iframe de fond de l'extension. Les navigateurs peuvent bloquer ces ouvertures lorsqu'elles ne sont pas déclenchées par un clic direct dans la page contenant le lien. Ce blocage est cohérent avec le retour du test réel, mais le navigateur n'a pas pu être inspecté.

## Correction

Le bouton de droite déclenche maintenant `OBR.popover.open`, interface officielle d'Owlbear, ancrée à l'icône. Cette fenêtre contient **le même lien « Retour aux Archives »** que le menu en haut à gauche, déjà vérifié par l'utilisateur. Le clic sur ce lien déclenche le retour vers l'onglet Archives existant si Edge le permet.

**Limite connue :** depuis la barre de droite, il faut maintenant deux clics fiables (icône, puis « Retour aux Archives »). Une bascule directe en un seul clic n'est pas garantie par l'API d'extension et le navigateur. Cela évite un bouton qui ne fait rien. Le menu en haut à gauche conserve son comportement.

- Aucun changement à l'application principale `archives-app-v53-v41.html` : l'écran titre, le canevas, l'icône Owlbear et les sauvegardes sont préservés.
- Aucun changement à Supabase, au Salon Live ni aux pions et cartes.
- Les invitations de retour au joueur depuis Owlbear restent raccordées au canal existant.
- Les anciens manifestes et l'extension V4.1 sont conservés.

## Installation de test

Dans la salle Owlbear, remplacer l'extension V4.1 par une seule extension dont le manifeste est :

https://toniogervais.github.io/archives-owlbear/manifest-v42.json

Ouvrir une scène, cliquer l'icône de droite, confirmer que le petit panneau affiche « Retour aux Archives », puis cliquer ce lien. Vérifier si l'onglet des Archives se réactive sans rechargement.

## Validation

Les tests automatisés de syntaxe et de câblage ne prouvent pas l'ouverture réelle d'un popover dans Owlbear. Il faut valider à l'écran dans Edge.
