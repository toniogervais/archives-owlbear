# Les Archives de l’Imaginaire — Owlbear V4.17.1

## Une salle, un onglet par personne

Installe ou actualise l’extension avec cette adresse :

https://toniogervais.github.io/archives-owlbear/manifest-v55.json

Le MJ et les joueurs commencent dans la même salle Owlbear. Le MJ utilise le livre pour ouvrir les Archives, puis **Retour à Owlbear** pour afficher la carte. Chaque changement du MJ propose aux joueurs un bouton au centre de leur écran. Le joueur suit ce bouton dans son onglet ; il peut aussi fermer l’invitation.

Aucun code de Salon Live, compte Archives ou paramétrage Supabase n’est nécessaire pour ce parcours. Un joueur doit garder le rôle **Joueur** dans Owlbear. La salle doit avoir l’extension activée.

Le scénario complet est sauvegardé dans le navigateur du MJ, séparément pour chaque salle et compte Owlbear. Lors de la première ouverture, importe ton scénario JSON ou commence un nouveau scénario. Pour reprendre un scénario de l’application autonome, exporte-le d’abord depuis https://toniogervais.github.io/archives-owlbear/archives.html. Garde des sauvegardes JSON pour changer d’appareil ou de navigateur.

## Personnages, documents et tokens

Dans le menu d’une cellule ou d’une image de la bibliothèque, choisis **Envoyer vers Owlbear…**. Le réglage de la cellule contient aussi ce bouton. Dans la bibliothèque, **Owlbear : fichiers et transferts…** permet d’ajouter un fichier et de retrouver les éléments déjà préparés pour la scène.

1. Vérifie le nom et l’aperçu. Un personnage devient un **token rond** par défaut. Tout autre document ou image peut aussi devenir un token en changeant le format.
2. Choisis **Document** pour garder une image ou une page de document entière. Formats : PNG, JPG, WebP, PDF et TXT, 25 Mo maximum. Pour un PDF, choisis la page à transférer. Exporte les autres formats en PDF.
3. Laisse **Révéler aux joueurs maintenant** décoché pour préparer un élément caché, ou coche-le pour le partager immédiatement.
4. Valide le transfert. Le rangement natif d’Owlbear demande un dossier, puis un choix d’image : sélectionne l’image dont le nom et le suffixe sont indiqués dans le message. Ces dialogues concernent uniquement le MJ.

Un élément caché est placé dans la vue locale du MJ : il peut le déplacer avant de le révéler. Dans **Éléments déjà transférés**, les boutons **Révéler**, **Cacher** et **Retirer** agissent sur la scène courante. Un nouvel envoi de la même source dans le même format met à jour son élément et garde sa position.

## Données privées et révélées

Le scénario complet, les cellules non révélées, les indices secrets et le journal MJ ne sont pas envoyés aux joueurs. La vue des Archives est filtrée avant transmission. Les commandes de transfert, les changements de scène et le rôle MJ sont contrôlés dans l’hôte Owlbear.

Les nouveaux transferts utilisent le stockage natif du compte Owlbear du MJ, sans bucket public Supabase. Un élément jamais révélé n’entre pas dans la scène partagée, ses métadonnées ou les messages de la salle. Lors d’une révélation, seuls le nom et le rendu validés deviennent un élément natif de la scène. Cacher un élément déjà révélé ne retire pas les copies que les joueurs auraient conservées.

L’ancienne connexion cloud des Archives reste une fonction séparée. Cette mise à jour ne modifie pas les politiques du projet Supabase existant et ne retire pas d’anciens fichiers déjà publiés par les versions précédentes. Le script `sql/security-audit-readonly-v47.sql` permet d’en vérifier les règles et les buckets.

## Vérification

Les tests de projection vérifient que les secrets restent exclus. Les essais Chromium utilisent des contextes MJ et joueurs distincts et une salle Owlbear simulée : connexion native, un onglet par personne, sauvegarde, invitations, personnages, documents, PDF, tokens, déplacements, rechargement, changement de scène et perte du rôle MJ. La validation finale dans une salle réelle reste nécessaire pour les dialogues de stockage natifs.

## Paramètres et accès joueur — V4.16.1

Dans Owlbear, les paramètres du MJ sont regroupés en **Apparence**, **Sons** et **Sauvegardes**. Les exports partiels, l’impression et l’accès aux anciennes campagnes cloud restent disponibles dans **Options avancées**. Les commandes de connexion de l’ancien Salon Live et la mise à jour par fichier HTML sont retirées du menu intégré.

Les joueurs demandent à rejoindre la salle Owlbear ; le MJ accepte leur entrée. Aucun second code Archives n’est nécessaire. Leur vue ne propose pas d’écran titre, de comptes, de campagnes ni de paramètres MJ, et ne restaure aucune connexion cloud. Le bouton de retour mène à la carte Owlbear. La protection des données repose sur le contrôle du rôle par l’hôte et le filtrage avant transmission, indépendamment des menus affichés.

La sauvegarde complète du scénario et du journal MJ reste disponible. Cette mise à jour n’ajoute pas de verrou par mot de passe pour une personne utilisant physiquement le même profil de navigateur que le MJ.

## Documents et autres — V4.17

Dans le catalogue, ouvre **Documents et autres** puis **Ajouter des fichiers**. Les PDF, TXT et images peuvent peser jusqu’à 25 Mo ; les sons et vidéos jusqu’à 8 Mo par fichier. Formats audio : MP3, WAV, OGG et M4A ; vidéo : MP4, WebM et OGV, selon les codecs lisibles par le navigateur.

La bibliothèque conserve les originaux sur l’appareil du MJ, séparément pour chaque salle et compte Owlbear. L’ajout, la recherche, le renommage et la consultation restent privés. **Enregistrer l’original** permet de récupérer un fichier. Les sauvegardes JSON du scénario ne contiennent pas cette bibliothèque : garde les fichiers d’origine pour changer d’appareil.

Le menu d’une cellule et son réglage proposent **Documents liés…**. Tu peux importer un document pour cette cellule ou choisir un fichier déjà présent dans la bibliothèque. Ces liens restent uniquement côté MJ. Le bouton **Voir toute la bibliothèque** permet de retrouver les fichiers qui ne sont pas liés à la cellule.

Pour un document ou une image, **Aperçu et transfert…** conserve le choix entre document entier, page PDF et token rond, avec révélation volontaire. Les personnages gardent leur transfert direct en token depuis la cellule ou la bibliothèque d’images.

Pour un son ou une vidéo, **Aperçu et présentation…** ouvre un lecteur privé. Laisse **Révéler aux joueurs maintenant** décoché pour garder le fichier privé. En le cochant puis en cliquant sur **Présenter aux joueurs**, tu partages uniquement le fichier et le nom vérifiés. Les joueurs disposent d’un lecteur dans leur onglet Owlbear et cliquent sur **Lire** ; la lecture n’est pas synchronisée entre les appareils. Aucun code supplémentaire ni compte Archives n’est nécessaire.

**Arrêter la présentation** ferme les lecteurs de la salle. Une bascule du MJ rend également la place au bouton de changement d’écran habituel. Les joueurs qui ont déjà reçu le média peuvent en conserver une copie. Une nouvelle présentation reste possible depuis la bibliothèque.

Les médias sont transmis aux membres de la salle par messages Owlbear découpés sous la limite de 16 Ko, avec contrôle du rôle de l’émetteur, de la taille et de l’intégrité du fichier reçu. Les originaux non révélés, les noms de fichiers privés, les liens vers les cellules et le reste de la bibliothèque ne sont jamais inclus dans ces messages. Aucun hébergement public de fichier n’est ajouté. La réception des joueurs reste en mémoire et n’ouvre pas la bibliothèque privée du MJ.

Les tests de cette version couvrent les limites de taille, les fichiers déguisés, l’intégrité, les commandes forgées par un joueur, la persistance et les liens privés, le PDF transformé en token, la lecture réelle d’un WAV et d’un WebM et l’arrivée d’un joueur après le début d’une présentation dans une salle simulée. L’intégration Soundshow demeure séparée de ce lecteur de médias.

La V4.17.1 purge aussi les éléments locaux de l’extension après un changement de scène ou de rôle, y compris lorsqu’une création native se termine tardivement. Les tests vérifient ce cas avec un élément privé absent du suivi en mémoire.
