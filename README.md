# Les Archives de l’Imaginaire — Owlbear V4.22.3

## Diagnostic de liaison SoundShow 4.22.3

Lorsqu'une tablette affiche un écran noir et alterne « connexion vidéo » et « liaison interrompue », la nouvelle version distingue les étapes : serveur de mise en relation, recherche du PC, validation du code puis connexion prête. Elle affiche une explication ciblée (ancien code, serveur inaccessible, WebRTC/pare-feu) et conserve le bouton **Réessayer la connexion**. Le lecteur n'annonce plus « Prêt » pendant une tentative interrompue. La perte du seul serveur de signalisation ne détruit plus une connexion de données déjà ouverte.

Sur le PC, le connecteur **0.1.2** ajoute une section repliable **Diagnostic de connexion**, avec nombre de tentatives reçues, lecteurs effectivement prêts et demandes refusées. Le connecteur ne publie ni mot de passe ni code de session dans ce diagnostic. La connexion directe WebRTC peut encore être bloquée par un réseau invités, le pare-feu, ou une configuration NAT imposant un relais TURN ; cette version ne prétend pas contourner ces restrictions.

Après réception fiable des images et du son, l'étape prévue est la télécommande SoundShow intégrée directement dans Les Archives (lecture, pause, arrêt et volume), sans multiplier les panneaux de réglages.



## Diagnostic SoundShow et reconnexion 4.22.2

La commande SoundShow indique désormais séparément le nombre de joueurs présents dans la salle Owlbear et le nombre de lecteurs qui ont réellement confirmé leur connexion au connecteur PC. Cette confirmation provient du lecteur visible, pas de la simple présence d'un joueur ni de la surveillance cachée. Si un lecteur n'arrive pas à établir la connexion, sa tablette affiche un message et le bouton **Réessayer la connexion**. Une nouvelle commande **Relier les joueurs** rafraîchit aussi le diagnostic sans fermer les lecteurs déjà actifs. Les statuts sont limités à des informations de connexion ; ni mot de passe ni code de session ne sont renvoyés dans le diagnostic. Le réseau de la tablette et SoundShow réel doivent encore être validés sur place.


## Correctif de réception SoundShow 4.22.1

Dans Owlbear, le lecteur joueur s’ouvre dès la transmission du code SoundShow, avec un état visible de connexion, même avant le lancement d’une vidéo. La connexion directe du lecteur ne dépend plus de la réussite de la connexion de surveillance dans l’arrière-plan caché. L’attente initiale reste affichée, puis la fin d’une vidéo ferme le lecteur. Une nouvelle vidéo peut l’ouvrir à nouveau après un retour volontaire au jeu. Une nouvelle action **Relier les joueurs** peut aussi rouvrir un lecteur fermé. Les ouvertures et fermetures sont ordonnées ; la fermeture d’une ancienne fenêtre ne ferme pas la suivante.

Le panneau MJ indique le nombre de participants ayant effectivement le rôle Joueur dans la salle Owlbear, ou le nombre de salles reliées lorsque le code est transmis depuis les Archives principales. Ce nombre ne prouve pas la réception du flux : le lecteur indique son propre état de connexion. L’origine de la panne signalée sur la tablette réelle reste à confirmer par cet état. Le connecteur Windows 0.1.1 déjà installé reste compatible.


## Correctif de démarrage 4.21.1

La commande des Archives démarre indépendamment du chargement des transferts, des documents et de la synchronisation des joueurs. Un échec de création de l’outil est retenté sans bloquer les autres fonctions ; les tentatives sont bornées. Le menu affiche une erreur et un accès au diagnostic si le SDK ou un fichier ne répond pas, au lieu de rester sans indication. Le bouton reste désactivé hors d’une salle Owlbear et ne peut plus ouvrir par défaut une application autonome avec le rôle MJ. Les vérifications d’origine, de rôle et d’accès sont conservées.

Le manifeste garde son adresse d’installation et utilise des adresses d’entrée sans paramètres. Les scripts de démarrage restent versionnés pour leur actualisation. Le lien [Diagnostic de chargement](https://toniogervais.github.io/archives-owlbear/diagnostic.html) vérifie les fichiers depuis le navigateur de l’utilisateur, sans lire les campagnes ni transmettre de résultat automatiquement. Il ne vérifie pas la connexion interne d’une salle. La cause de la panne signalée dans la salle réelle n’a pas encore été confirmée par un journal d’erreur.


## Une salle, un onglet par personne

Installe ou actualise l’extension avec cette adresse :

https://toniogervais.github.io/archives-owlbear/manifest-v55.json

Le MJ et les joueurs commencent dans la même salle Owlbear. Le MJ utilise le livre pour ouvrir les Archives, puis le **bouton Owlbear en bas au centre** pour afficher la carte. Les deux autres boutons de retour ont été retirés du canevas intégré. À chaque bascule du MJ, une petite fenêtre demande ce que font les joueurs : **Les joueurs restent**, **Inviter à suivre** ou **Suivi obligatoire**. Maintiens son en-tête pour la déplacer ; sa position est mémorisée pour cette salle et ce compte MJ et reste accessible après un changement de taille de fenêtre.

Une invitation simple présente le bouton central de bascule et **Rester sur cet écran** ; elle peut aussi être fermée par Échap ou par un clic sur le fond. Le suivi obligatoire garde le bouton central affiché, sans option de refus, jusqu’à ce que le joueur valide la bascule. Le MJ ne déplace pas automatiquement le navigateur du joueur. Il peut demander ces changements à une seule personne dans **Joueurs et écrans**, en choisissant la destination puis **Inviter** ou **Imposer la bascule**. Les autres joueurs gardent leur écran.

Aucun code de Salon Live, compte Archives ou paramétrage Supabase n’est nécessaire pour ce parcours. Un joueur doit garder le rôle **Joueur** dans Owlbear. La salle doit avoir l’extension activée.

Le scénario complet est sauvegardé dans le navigateur du MJ, séparément pour chaque salle et compte Owlbear. Lors de la première ouverture, importe ton scénario JSON ou commence un nouveau scénario. Pour reprendre un scénario de l’application autonome, exporte-le d’abord depuis https://toniogervais.github.io/archives-owlbear/archives.html. Dans Owlbear, utilise la sauvegarde complète `.archives` pour changer d’appareil ou de navigateur. Les anciens scénarios JSON restent importables.

## Interface et commandes — V4.21

La barre en haut à gauche regroupe des icônes homogènes, des onglets d’actes plus lisibles et des infobulles. La suppression reste à l’écart de la sauvegarde. Les fenêtres, catalogues, aperçus et images s’ouvrent et se ferment avec des fondus courts. La fermeture rend immédiatement les aperçus natifs inactifs, puis retire leur affichage après le fondu. Les transitions et animations ajoutées respectent **FX : OFF** et la préférence système de réduction des animations.

| Commande | Action |
| --- | --- |
| Sauvegarde | Enregistrer ou restaurer la campagne complète |
| Catalogue | Retrouver les cellules et les bibliothèques existantes |
| Dossier des joueurs | Consulter les éléments explicitement révélés |
| Préparer plusieurs transferts | Préparer jusqu’à 20 éléments ensemble |
| Joueurs et écrans | Voir Archives, Owlbear, invitation en attente ou déconnexion |

Les commandes de campagne, de transfert et de suivi restent réservées au MJ. En haut à gauche, les joueurs gardent **Dossier des joueurs**, **Journal des révélations**, **Mes notes** et les actes révélés. Le journal retrouve ses trois parties : **Notes & #Tags**, **Fil des Révélations** et **Récit continu**. Le fil et le récit sont construits à partir des informations explicitement révélées et se mettent à jour sans fermer le journal. Le journal privé du MJ n’est jamais envoyé aux joueurs. Les notes de session personnelles et le carnet **Mes notes** sont conservés séparément, pour chaque salle et compte, dans ce navigateur. Les commandes de sauvegarde de campagne, de catalogue, de suppression et d’édition des actes restent retirées de la barre des joueurs.

**Mes notes** ouvre un carnet personnel enregistré automatiquement dans ce navigateur, séparément pour chaque salle et compte Owlbear. Les mises à jour du MJ ne l’écrasent pas. Son contenu n’est envoyé ni au MJ, ni aux autres joueurs, ni dans les sauvegardes de campagne. **Enregistrer une copie** télécharge un fichier texte ; conserver cette copie permet de changer d’appareil.

## Disposition personnelle et gestes tactiles

Pour redimensionner une cellule, maintiens le doigt ou le clic sur sa petite flèche en bas à droite, puis glisse sans relâcher. La zone tactile est agrandie. Le geste reste actif en sortant de la flèche et s’arrête au relâchement ou à l’annulation du pointeur. Les flèches du clavier permettent aussi d’ajuster la taille quand la poignée a le focus.

Chaque joueur garde sa propre position, sa propre taille et ses regroupements de cellules. Les mises à jour de contenu continuent d’arriver, tandis que les déplacements et dimensions du canevas MJ ne remplacent pas les siens, même sur une cellule qu’il n’a pas encore déplacée. Ces préférences et ses notes de journal sont retrouvées au rechargement, pour cette salle et ce compte sur cet appareil. Les mises à jour reçues pendant un redimensionnement sont appliquées après le geste.

Dans les réglages d’une cellule, l’**aperçu en direct** permet de zoomer/dézoomer avec le curseur, la molette ou deux doigts, puis d’attraper l’image pour la déplacer. L’image garde ses proportions et le fichier original est conservé. Double-clique sur un aperçu sans image pour choisir **Rechercher sur Google**, **Choisir sur l’ordinateur** ou **Bibliothèque des Archives**. Google s’ouvre dans son onglet ; l’adresse directe de l’image peut ensuite être appliquée à la cellule.

La roue crantée affiche **Stockage des Archives** : espace disponible, espace utilisé et capacité estimée pour ce navigateur et cet appareil. La valeur est actualisée à l’ouverture, pendant l’affichage et avec **Actualiser**. Elle ne représente pas le quota du compte Owlbear. Si le navigateur ne fournit pas l’estimation, l’interface le signale sans inventer une capacité restante.

## Sauvegarde complète de campagne

Dans la salle Owlbear, le bouton de sauvegarde en haut à gauche, ou **Paramètres → Sauvegardes → Campagne complète**, ouvre l’export et la restauration. **Enregistrer la campagne** produit un seul fichier `.archives` contenant le scénario complet, le journal MJ, la bibliothèque d’images de cet appareil, les fichiers originaux de **Documents et autres** de cette salle et de ce compte MJ, leurs liens et les cadrages de tokens. Le classement des images est également conservé. Les scènes, cartes et placements natifs d’Owlbear se conservent séparément dans Owlbear.

**Restaurer une campagne…** vérifie le fichier avant toute écriture et affiche les nombres d’actes, de cellules, de documents et d’images. **Restaurer cette campagne** arrête d’abord les présentations audio et vidéo en cours, puis remplace le scénario et fusionne les bibliothèques et les cadrages. Les fichiers récents absents de la copie sont conservés. L’état de révélation du scénario est conservé ; les originaux de la bibliothèque ne sont pas automatiquement présentés aux joueurs.

Avant la restauration, une copie de récupération de la campagne actuelle est enregistrée sur cet appareil pour cette salle et ce compte. **Récupérer une version précédente** permet de vérifier puis de restaurer cette copie. En cas d’échec d’écriture pendant la restauration des bibliothèques, les données antérieures sont rétablies. Si un autre onglet a modifié le scénario, le contrôle de version existant refuse son remplacement.

Le format vérifie l’intégrité du descriptif et de chaque original, refuse les fichiers tronqués et conserve les fichiers binaires sans les convertir en texte. Limites : 512 Mo par sauvegarde, dont 64 Mo pour le scénario et la bibliothèque d’images. Les limites habituelles de chaque document et média restent applicables. Cette sauvegarde contient les secrets du MJ et doit rester privée. Aucun fichier de campagne n’est publié dans le dépôt GitHub ni envoyé aux joueurs par cette fonction.

## Retrouver un élément, préparer un lot et suivre les joueurs

Après un transfert, **Voir dans Owlbear**, dans les réglages de la cellule ou son menu contextuel, centre uniquement la vue du MJ sur l’élément de la scène ouverte puis prépare le retour à la carte dans le même onglet. Cela ne révèle pas un élément caché. La fenêtre de bascule laisse le MJ décider du suivi des joueurs.

**Préparer plusieurs transferts** réunit les cellules du scénario, la bibliothèque d’images et les documents privés de cette salle. Sélectionne jusqu’à 20 éléments, puis ajuste le nom, le format et le cadrage de chaque aperçu. Les PDF permettent le choix d’une page. **Placer le lot caché** ou **Placer le lot et révéler** détermine la visibilité de tout le lot. Les nouveaux éléments sont espacés sur la carte ; un élément déjà transféré garde sa position. Les rendus du lot sont limités à 30 Mo au total.

Les nouveaux rendus sont rangés ensemble dans un seul choix de dossier Owlbear, puis sélectionnés ensemble dans son sélecteur d’images. Les choix natifs restent nécessaires pour une première importation. Tous les rendus déjà importés sont réutilisés directement. Chaque sélection est vérifiée avant de placer les éléments du lot. Si la scène ou le rôle change pendant le placement, l’opération s’arrête et indique le nombre d’éléments déjà placés.

**Joueurs et écrans** indique l’écran annoncé par chaque joueur de la salle, signale une invitation en attente et garde les déconnexions visibles pendant la session. Une confirmation de changement d’écran ne contient que l’écran et l’état d’invitation, sans donnée de campagne. L’identité et le rôle du participant sont vérifiés par l’hôte Owlbear.

Le **Dossier des joueurs** rassemble les cellules et indices déjà révélés, ainsi que les tokens et documents actuellement partagés dans la scène Owlbear. Une recherche et des filtres permettent de les retrouver et de les consulter en grand. Le MJ dispose du même dossier filtré pour vérifier ce qui est disponible. Les cellules masquées, indices secrets, journaux MJ, originaux privés et références internes ne sont pas inclus. Les médias audio et vidéo conservent leur lecteur de présentation existant.

## Personnages, documents et tokens

Pour un **personnage**, les réglages de cellule et le menu contextuel proposent directement **Owlbear · Placer caché** et **Owlbear · Placer et révéler**. Ces actions placent le token sans ouvrir d’aperçu à valider, sans demander de revenir sur la carte et sans ajouter de doublon. Elles reprennent le dernier cadrage de cette image, ou un cadrage centré si elle est nouvelle. **Cadrer / préparer…** reste disponible pour ajuster le zoom et déplacer l’image avant le placement. Les documents conservent leur aperçu pour choisir le texte et la page à transférer.

La bibliothèque d’images propose également **Placer caché** et **Placer et révéler** directement sur les portraits de personnages. Le clic droit donne accès à **Cadrer le token…**. Les autres images gardent **Vers Owlbear**, avec le choix du format dans l’aperçu. **Owlbear : fichiers et transferts…** permet d’ajouter un fichier et de retrouver les éléments déjà préparés pour la scène.

1. Vérifie le nom et l’aperçu. Un personnage devient un **token rond** par défaut. Tout document ou image peut aussi devenir un token en choisissant ce format.
2. Le cadrage proposé est centré. Pour l’ajuster, **zoome ou dézoome**, puis **attrape et déplace l’image dans le token**, à la souris ou au doigt. Le zoom fonctionne avec la molette, le curseur ou deux doigts. L’image garde ses proportions. Aucun autre réglage de cadrage n’est nécessaire.
3. Clique directement sur **Placer caché** ou **Placer et révéler**. L’aperçu se ferme après le placement. Le dernier cadrage transféré est mémorisé pour cette source ; remplacer son image rétablit une proposition centrée.
4. Lors de la première importation d’un nouveau rendu, Owlbear demande encore un dossier puis la sélection de l’image **Archives · …** indiquée à l’écran. Le même rendu déjà importé est ensuite réutilisé directement, même sur une autre scène ou après rechargement, dans le même navigateur et compte MJ.

Le format **Document** conserve une image entière ou la page PDF choisie. Formats : PNG, JPG, WebP, PDF et TXT, 25 Mo maximum. Exporte les autres formats en PDF. Le format et la page PDF du dernier transfert sont également retrouvés à la réouverture.

Un élément caché est placé dans la vue locale du MJ : il peut le déplacer avant de le révéler. Dans **Éléments déjà transférés**, les boutons **Révéler**, **Cacher** et **Retirer** agissent sur la scène courante. Un nouvel envoi de la même source dans le même format met à jour son élément et garde sa position.

## Données privées et révélées

Le scénario complet, les cellules non révélées, les indices secrets et le journal MJ ne sont pas envoyés aux joueurs. La vue des Archives est filtrée avant transmission. Les commandes de transfert, les changements de scène et le rôle MJ sont contrôlés dans l’hôte Owlbear.

Les nouveaux transferts utilisent le stockage natif du compte Owlbear du MJ, sans bucket public Supabase. Un élément jamais révélé n’entre pas dans la scène partagée, ses métadonnées ou les messages de la salle. Lors d’une révélation, seuls le nom et le rendu validés deviennent un élément natif de la scène. Pour un token, seuls les pixels visibles à l’intérieur du cercle sont exportés ; l’image originale et les réglages de cadrage restent privés. Les cadrages et les références des rendus déjà importés sont conservés séparément pour chaque salle et compte MJ dans le navigateur. Cacher un élément déjà révélé ne retire pas les copies que les joueurs auraient conservées.

L’ancienne connexion cloud des Archives reste une fonction séparée. Cette mise à jour ne modifie pas les politiques du projet Supabase existant et ne retire pas d’anciens fichiers déjà publiés par les versions précédentes. Le script `sql/security-audit-readonly-v47.sql` permet d’en vérifier les règles et les buckets.

## Vérification

Les tests de projection vérifient que les secrets restent exclus. Les essais Chromium utilisent des contextes MJ et joueurs distincts et une salle Owlbear simulée : connexion native, un onglet par personne, sauvegarde, invitations, personnages, documents, PDF, tokens, déplacements, rechargement, changement de scène et perte du rôle MJ. Les essais de cadrage vérifient aussi les vrais gestes souris, molette et deux doigts, l’égalité exacte entre l’aperçu et le fichier exporté, la conservation des anciens transferts et la réutilisation après changement de scène et rechargement. Les nouveaux essais vérifient aussi les écritures interrompues avec retour aux données précédentes, la copie de récupération, les imports groupés, le dossier filtré, les états des joueurs et les fondus avec mouvement réduit. La validation finale dans une salle réelle reste nécessaire pour les dialogues de stockage natifs.

## Paramètres et accès joueur — V4.16.1

Dans Owlbear, les paramètres du MJ sont regroupés en **Apparence**, **Sons** et **Sauvegardes**. Les exports partiels, l’impression et l’accès aux anciennes campagnes cloud restent disponibles dans **Options avancées**. Les commandes de connexion de l’ancien Salon Live et la mise à jour par fichier HTML sont retirées du menu intégré.

Les joueurs demandent à rejoindre la salle Owlbear ; le MJ accepte leur entrée. Aucun second code Archives n’est nécessaire. Leur vue ne propose pas d’écran titre, de comptes, de campagnes ni de paramètres MJ, et ne restaure aucune connexion cloud. Le bouton de retour mène à la carte Owlbear. La protection des données repose sur le contrôle du rôle par l’hôte et le filtrage avant transmission, indépendamment des menus affichés.

La sauvegarde complète du scénario et du journal MJ reste disponible. Cette mise à jour n’ajoute pas de verrou par mot de passe pour une personne utilisant physiquement le même profil de navigateur que le MJ.

## Documents et autres — V4.17

Dans le catalogue, ouvre **Documents et autres** puis **Ajouter des fichiers**. Les PDF, TXT et images peuvent peser jusqu’à 25 Mo ; les sons et vidéos jusqu’à 8 Mo par fichier. Formats audio : MP3, WAV, OGG et M4A ; vidéo : MP4, WebM et OGV, selon les codecs lisibles par le navigateur.

La bibliothèque conserve les originaux sur l’appareil du MJ, séparément pour chaque salle et compte Owlbear. L’ajout, la recherche, le renommage et la consultation restent privés. **Enregistrer l’original** permet de récupérer un fichier. Les sauvegardes JSON du scénario ne contiennent pas cette bibliothèque ; la sauvegarde complète `.archives` ajoutée en V4.19 conserve aussi ses originaux.

Le menu d’une cellule et son réglage proposent **Documents liés…**. Tu peux importer un document pour cette cellule ou choisir un fichier déjà présent dans la bibliothèque. Ces liens restent uniquement côté MJ. Le bouton **Voir toute la bibliothèque** permet de retrouver les fichiers qui ne sont pas liés à la cellule.

Pour un document ou une image, **Aperçu et transfert…** conserve le choix entre document entier, page PDF et token rond, avec révélation volontaire. Les personnages gardent leur transfert direct en token depuis la cellule ou la bibliothèque d’images.

Pour un son ou une vidéo, **Aperçu et présentation…** ouvre un lecteur privé. Laisse **Révéler aux joueurs maintenant** décoché pour garder le fichier privé. En le cochant puis en cliquant sur **Présenter aux joueurs**, tu partages uniquement le fichier et le nom vérifiés. Les joueurs disposent d’un lecteur dans leur onglet Owlbear et cliquent sur **Lire** ; la lecture n’est pas synchronisée entre les appareils. Aucun code supplémentaire ni compte Archives n’est nécessaire.

**Arrêter la présentation** ferme les lecteurs de la salle. Une bascule du MJ rend également la place au bouton de changement d’écran habituel. Les joueurs qui ont déjà reçu le média peuvent en conserver une copie. Une nouvelle présentation reste possible depuis la bibliothèque.

Les médias sont transmis aux membres de la salle par messages Owlbear découpés sous la limite de 16 Ko, avec contrôle du rôle de l’émetteur, de la taille et de l’intégrité du fichier reçu. Les originaux non révélés, les noms de fichiers privés, les liens vers les cellules et le reste de la bibliothèque ne sont jamais inclus dans ces messages. Aucun hébergement public de fichier n’est ajouté. La réception des joueurs reste en mémoire et n’ouvre pas la bibliothèque privée du MJ.

Les tests de cette version couvrent les limites de taille, les fichiers déguisés, l’intégrité, les commandes forgées par un joueur, la persistance et les liens privés, le PDF transformé en token, la lecture réelle d’un WAV et d’un WebM et l’arrivée d’un joueur après le début d’une présentation dans une salle simulée. L’intégration Soundshow demeure séparée de ce lecteur de médias.

La V4.17.1 purge aussi les éléments locaux de l’extension après un changement de scène ou de rôle, y compris lorsqu’une création native se termine tardivement. Les tests vérifient ce cas avec un élément privé absent du suivi en mémoire.
