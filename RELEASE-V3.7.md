# Les Archives de l’Imaginaire — V3.7

Cette version relie l’interface complète des Archives à la campagne de synchronisation de la salle Owlbear. Elle ajoute une version V51 de l’application, dérivée de la V50. Les fichiers des versions précédentes et le manifeste par défaut sont conservés.

## Utilisation

1. Remplacer l’extension précédente par `https://toniogervais.github.io/archives-owlbear/manifest-v37.json` dans Owlbear. Ne pas garder plusieurs versions actives dans une même salle.
2. Ouvrir Les Archives avec l’icône habituelle. Le canevas complet doit apparaître.
3. La barre supérieure retrouve la campagne liée à cette salle, si le compte est déjà connecté. Si plusieurs campagnes correspondent, choisir explicitement la campagne de synchronisation.
4. « Partager le mode Archives » enregistre ce mode dans l’état partagé.
5. « Partager le mode Owlbear et revenir » vérifie la scène, enregistre le mode, attend la confirmation, puis ferme la vue Archives.
6. « Retour à Owlbear » ferme uniquement cette vue, sans modification du mode partagé. L’icône Owlbear du canevas propose le même retour.

En cas d’absence de connexion, utiliser le panneau habituel de l’extension pour se connecter ou associer une campagne, puis « Actualiser » dans la barre supérieure. Aucune migration SQL supplémentaire n’est prévue par cette version.

## Changements

- Correction du décalage entre les champs attendus par V50 (`mode`, `active_scene_id`) et les champs utilisés par l’extension V3.6 (`active_mode`, `owlbear_scene_id`). Les lectures historiques de V51 utilisent des alias PostgREST pour conserver leur logique.
- Recherche des campagnes possédées par le compte et liées à la salle ouverte. Le choix mémorisé est vérifié contre cette liste.
- Lecture immédiate de l’état, notifications Realtime, vérification de secours toutes les 10 secondes et suppression des abonnements à la fermeture.
- Réponses tardives ignorées après changement de campagne ou fermeture.
- Vérification du rôle Owlbear, du propriétaire Supabase et de la liaison de salle avant chaque nouvelle commande de la barre supérieure. La reprise du mode Owlbear exige que la scène ouverte corresponde à la scène active enregistrée.
- Transmission à l’application intégrée de l’identifiant de campagne et de salle uniquement. Aucun secret, mot de passe ou contenu du canevas n’est envoyé par ce canal.
- Le sélecteur du diagnostic intégré suit la barre supérieure, et les commandes historiques vérifient le contexte de salle.
- Les commandes sont suspendues hors ligne ; le retour simple à la carte reste indépendant.

## Validation du 5 novembre 2026

- 14 tests unitaires : filtrage des campagnes, schéma, RPC, rôles, propriétaire, salle, scène, erreurs, clés publiques, Realtime, secours et réponses tardives.
- 8 tests de commandes d’interface dans un DOM simulé : sélection, retour, écriture refusée, scène incorrecte, ambiguïté, perte de rôle, messages étrangers et déconnexion réseau.
- Les 13 scripts intégrés à V51 passent le contrôle de syntaxe ; les points d’entrée du manifeste sont présents.
- Le scénario Playwright est fourni mais **n’a pas pu être exécuté** : le lancement de Chromium est bloqué par l’environnement de travail. Aucune validation visuelle ou validation en salle réelle n’est revendiquée.

Pour reproduire les tests : `npm ci` puis `npm test`. Pour les essais navigateur : `npx playwright install chromium` puis `npm run test:browser`. Les services externes sont simulés dans ces tests : ils ne modifient aucune vraie campagne.

## Limites à conserver dans le suivi du projet

- Choisir une campagne de synchronisation ne charge pas ses cellules depuis Supabase. Le canevas reste celui conservé localement par l’application ; aucune migration ni séparation nouvelle des canevas par campagne n’est effectuée.
- Les anciennes sauvegardes ouvertes depuis un fichier HTML local ne sont pas transférées automatiquement vers l’application hébergée.
- Enregistrer le mode partagé ne garantit pas encore la bascule ou le verrouillage réel de tous les appareils joueurs. Ces fonctions nécessitent une étape dédiée et des tests multicomptes.
- L’enregistrement des positions conserve le fonctionnement V3.6 et exige que le panneau de l’extension reste ouvert. La V3.7 n’annonce pas une nouvelle accélération des pions.
- Le transfert des images, les règles de confidentialité des données partagées et Sound Show ne sont pas validés par cette livraison.
- Aucun changement n’est apporté à la base Supabase, aux permissions de la salle, aux pions ou aux sauvegardes existantes lors de l’installation.
