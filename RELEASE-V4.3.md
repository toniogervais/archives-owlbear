# V4.3 — Icône des Archives et retour épuré depuis Owlbear

## Modification de l'icône

- Nouveau fichier `icon-archives-v43.svg` : grimoire ouvert et étoile, teintes or, **fond intégralement transparent**.
- Ancien pictogramme : rectangle de fond opaque susceptible d'être réduit à un carré dans l'interface d'Owlbear.
- L'icône est utilisée dans la barre de droite **et** dans l'action d'extension en haut à gauche.
- Le nom de fichier change pour forcer le rafraîchissement du cache, sans modifier `icon.svg`.

## Retour aux Archives

- Le bouton de droite ouvre un minuscule panneau contenant **une seule commande** : « Retour aux Archives ».
- Le lien s'appuie sur `focusArchives` éprouvé depuis la V4.1.
- Il conserve l'onglet Archives existant si Edge autorise le ciblage d'un onglet nommé.
- Le menu d'extension en haut à gauche reste inchangé ; le MJ y retrouve l'invitation des joueurs.
- Le module de fond continue d'écouter les invitations reçues par les joueurs dans Owlbear.

**Limitation :** le retour depuis l'icône de droite nécessite encore **deux clics**. L'API officielle de l'outil Owlbear n'offre pas de méthode de navigation garantie vers un onglet Edge externe. Un `window.open` dans le script d'arrière-plan a déjà échoué. Éviter de présenter ce comportement comme une bascule directe en un clic.

## Précautions

Seules de nouvelles ressources de l'extension sont créées. Les Archives V4.1, les campagnes, les sauvegardes, les modes et les services de synchronisation ne sont pas modifiés.

## Installation

Remplacer la seule extension Les Archives V4.2, sans en garder une deuxième, par ce manifeste :

https://toniogervais.github.io/archives-owlbear/manifest-v43.json

Dans Owlbear, vérifier que l'icône représente désormais un livre, non un carré blanc. Cliquer à droite : un seul grand bouton « Retour aux Archives » apparaît. Cliquer dessus : Edge tente de réactiver le canevas.

La transparence et l'affichage doivent encore être vérifiés dans une vraie salle Owlbear.
