# Les Archives de l’Imaginaire — prototype V4.0

## Objectif

Les Archives restent le point de départ. Owlbear est ouvert ou réactivé dans un onglet Edge associé (pas intégré dans une iframe). Les invites sont envoyées seulement sur ordre explicite du maître de jeu.

## Utilisation prévue

1. Meneur : ouvrir archives-app-v52-v40.html?main=1 dans Edge. Le canevas s’affiche directement.
2. Cliquer sur l’icône Owlbear : entrer une fois l’adresse de sa salle, puis retrouver cette salle par un clic sur l’icône.
3. Démarrer le Salon Live des Archives. Dans le Salon Live, cliquer manuellement sur « Inviter les joueurs à voir la carte ».
4. Les joueurs connectés au Salon Live reçoivent une invitation au premier plan. Ils acceptent « Afficher Owlbear » ou choisissent de rester dans les Archives.
5. Depuis Owlbear, l’extension V4.0 propose « Retour aux Archives » dans la barre et dans son menu.
6. Depuis le menu de l’extension, le MJ peut inviter les joueurs présents dans Owlbear à revenir. Ceux-ci reçoivent une invitation avec bouton d’acceptation ou de refus.

## Points techniques et limites

- Les anciennes versions et leurs données ne sont pas modifiées. La V4.0 utilise la même origine web et le stockage local déjà employé par V3.8.
- Le Salon Live existant utilise PeerJS. Les invitations Owlbear émises depuis les Archives ne sont transmises qu’aux joueurs connectés à ce Salon Live.
- Les invitations de retour utilisent les messages Owlbear broadcast. Leur auteur est vérifié côté extension comme étant un MJ dans la salle.
- Ces invitations sont éphémères : elles ne sont pas conservées pour les absents, et leur envoi n’est pas un accusé de lecture.
- Les navigateurs peuvent empêcher de donner le focus à un onglet ou créer un nouveau contexte, surtout à partir d’une extension tierce. La bascule en un clic doit être validée en situation réelle.
- Les invitations ne permettent pas de forcer un changement d’application sur Android : les joueurs choisissent toujours d’accepter.
- Les données du canevas ne sont pas transportées par les invitations ; les sauvegardes restent locales selon le fonctionnement actuel.
- La synchronisation complète des modes de campagne Supabase et des joueurs, les pions et les cartes sont des étapes ultérieures. Cette version est une passerelle de navigation.
- Aucune compilation Windows ni installation d’un nouveau logiciel natif.

## État

Développement isolé sur une branche GitHub de travail ; aucun remplacement de la version principale. Tests statiques et de syntaxe à lancer par GitHub Actions avant publication. Validation sur Edge et Owlbear non réalisée.
