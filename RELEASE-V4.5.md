# Les Archives de l'Imaginaire — prototype V4.5

Objectif : Les Archives restent le logiciel principal, Owlbear reste le logiciel de cartes et de pions. Aucun module de navigateur Chrome/Edge/Opera nécessaire.

## Actions

- Quand le MJ clique l'icône Owlbear du canevas, une invitation apparaît au centre de l'écran des joueurs connectés au Salon Live ; chacun accepte ou reste aux Archives.
- Quand le MJ utilise Retour aux Archives dans le menu ou panneau Owlbear, l'extension Owlbear diffuse une invitation de retour aux joueurs de la salle. Le choix est manuel.
- Le bouton Révéler dans Owlbear est ajouté dans les réglages de la cellule sélectionnée. Un dialogue confirme le partage. Le MJ choisit chaque transfert.
- Personnage → image sur la couche CHARACTER (token avec nom). Lieu avec image → MAP. Autres cellules → PROP.
- Aucun texte de description, secret ou indice n'est transféré par cette fonction : uniquement titre, catégorie, image et identité technique de la cellule.
- Une image locale est publiée dans le bucket Supabase existant uniquement après confirmation.
- Envoyer la même cellule une deuxième fois doit mettre à jour l'élément lié quand l'extension le retrouve par ses métadonnées.

## Préparatifs nécessaires pour le transfert

1. Installer une fois sql/archives-cell-transfers-v45.sql dans Supabase (n'a PAS encore été exécuté). Les politiques RLS réservent lecture/écriture au propriétaire de campagne.
2. La campagne doit déjà être liée à la salle et à une scène active via le système de synchronisation existant.
3. Le même compte MJ doit être authentifié dans l'extension Owlbear : la session d'un onglet Archives ne se partage pas nécessairement avec l'iframe Owlbear.
4. L'extension charge le constructeur d'images du SDK Owlbear version 2.4.0 lors du premier transfert depuis esm.sh. L'hôte doit disposer d'une connexion réseau et les images doivent permettre CORS.

## Limitations à respecter

- L'extension Owlbear de salle reste nécessaire, mais PAS d'extension Chrome, Opera ou Edge, ni pour le MJ ni pour les joueurs.
- La réactivation des onglets sans rechargement est tentée, non garantie sur tous les navigateurs ni Android. Le bouton à droite dans Owlbear utilise encore un panneau puis le lien.
- Les invitations sont éphémères et nécessitent que les joueurs soient connectés aux bons salons. Elles n'imposent pas une navigation sans consentement.
- Révéler à Owlbear ne révèle pas automatiquement la cellule dans le canevas des Archives : ce sont deux actions distinctes.
- Aucun SQL n'a été installé ni token réel créé dans la salle de l'utilisateur. Les tests sont des contrôles de code, pas une validation intégrée sur Owlbear.
- La version en service, les anciennes sauvegardes et les extensions précédentes ne sont pas modifiées.

## Liens envisagés après validation

archives-app-v54-v45.html (écran titre conservé) ; manifest-v45.json (extension Owlbear de salle).
