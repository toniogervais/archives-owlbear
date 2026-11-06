# Les Archives de l’Imaginaire — V4.6 de validation

Les Archives restent le programme principal. Owlbear Rodeo garde les cartes, scènes et pions natifs. Aucun module Chrome, Edge ou Opera n'est requis. Le MJ installe l'extension **dans la salle Owlbear**.

## Ce qui change par rapport à la V4.5

- Dans le menu de l'extension Owlbear, une rubrique discrète « Connexion MJ pour les transferts » permet de connecter **une seule fois** le compte Supabase du meneur. Les paramètres URL et clé *publique* restent dans les réglages avancés.
- Les mots de passe saisis ne sont pas conservés par notre script ; la session est persistée par Supabase comme dans Les Archives.
- Un portrait externe HTTPS doit réellement pouvoir être téléchargé (CORS), être en PNG/JPEG/WebP, peser moins de 15 Mo ; il est copié sur le bucket de partage existant après confirmation du MJ. Le programme ne devine plus les dimensions ni le MIME à partir de l'URL.
- Un transfert de personnage envoie une image sur la couche CHARACTER (token), en tentant de positionner le token au centre de la vue du MJ, plutôt qu'aux coordonnées 0,0.
- Un nouvel envoi d'une cellule déjà liée doit réutiliser l'élément Owlbear par métadonnées et conserver sa position. Les titres sont actualisés.
- Les Archives affichent un résultat « transfert terminé », « échec » ou « encore en attente » lors des vérifications périodiques.
- Le transfert reste **volontaire** pour chaque cellule. Nom, catégorie et portrait seulement : aucun secret, indice ou description de MJ.
- L'invitation aux joueurs part automatiquement lorsque le MJ clique sur le passage vers Owlbear dans Les Archives et lorsqu'il utilise le retour depuis Owlbear. Les joueurs doivent l'accepter.

## Préalables avant essai de tokens

1. Ouvrir Les Archives V4.6 puis, avec un compte de meneur, accéder à une campagne liée à Owlbear.
2. Installer uniquement **manifest-v46.json** dans la salle Owlbear en remplaçant l'ancien manifeste, sans installer d'extension de navigateur.
3. Dans le menu de l'extension Owlbear, ouvrir « Connexion MJ pour les transferts » ; utiliser les identifiants du compte Archives, plus les paramètres publics Supabase si non enregistrés. Actualiser ensuite une fois Owlbear.
4. **Avant de cliquer pour transférer**, installer le schéma SQL fourni dans **sql/archives-cell-transfers-v45.sql** dans le projet Supabase relié à la campagne. Ce SQL n'a pas été exécuté par ChatGPT et doit être examiné puis validé dans Supabase.
5. Dans Owlbear, ouvrir une **scène de démonstration** et l'associer à la campagne selon le système de scènes V3.7.
6. Dans Les Archives, sélectionner une cellule de catégorie personnage ; dans Réglages de la cellule active, cliquer « Révéler dans Owlbear », confirmer et observer la progression.

## Tester les joueurs sans toucher à Supabase

1. MJ : démarrer le Salon Live des Archives ; joueur : rejoindre ce Salon Live depuis son appareil.
2. MJ : depuis Les Archives, cliquer sur Owlbear. Le joueur connecté aux Archives doit voir une invitation au centre de l'écran, puis choisir « Afficher Owlbear ».
3. MJ : depuis Owlbear, cliquer « Retour aux Archives ». Un message d'invitation doit apparaître dans la session Owlbear des joueurs qui ont l'extension activée dans cette salle. Ils choisissent « Revenir aux Archives » ou « Rester sur Owlbear ».

## Limites honnêtes

- La transition directe en **un clic** dans les deux sens n'est toujours pas garantie par les navigateurs web : le bouton de droite Owlbear ouvre encore son petit panneau puis le lien. Le menu en haut à gauche donne un lien de retour direct.
- Les invitations existent au centre de la page active, mais les messages sont éphémères et exigent une connexion active aux salons. Android peut suspendre des onglets en arrière-plan.
- L'envoi de tokens requiert une connexion à Supabase, une scène Owlbear active et la prise en charge des images distantes. Ce code n'a pas été essayé avec les comptes, salles et politiques SQL réels de l'utilisateur.
- La partie éditeur/canevas historique est copiée à l'identique à l'exception des références vers les modules V4.6 ; les versions V4.5 et antérieures restent disponibles.
- Les demandes de transfert s'appuient sur les fonctions officielles Owlbear de création d'images et de modifications d'items, sous réserve des tests réels.

## Liens

- Page Les Archives V4.6 : `https://toniogervais.github.io/archives-owlbear/archives-app-v55-v46.html`
- Manifeste Owlbear V4.6 : `https://toniogervais.github.io/archives-owlbear/manifest-v46.json`

## État

Tests automatiques de syntaxe et de câblage à passer avant publication. L'installation SQL et le test réel sont des étapes distinctes.
