# Les Archives de l’Imaginaire

## V4.44 — suppression des tokens et présentation d’images

La suppression native d’un token transféré, dans Owlbear, retire désormais aussi son placement enregistré dans les Archives. Cela s’applique aux tokens cachés dans la couche locale MJ et aux tokens révélés. Ils restent supprimés après actualisation. Les rechargements ordinaires, les bascules caché/révélé, les changements de rôle et les changements de scène conservent les préparations privées. Les anciens placements marqués révélés mais absents de leur scène sont nettoyés au chargement, pour réparer les fantômes créés avant cette version. La cellule d’origine et les fichiers de la bibliothèque restent disponibles pour un nouveau transfert volontaire.

Les menus clic droit de la bibliothèque utilisent leur taille réelle pour se placer dans la fenêtre, y compris près du bas ou du bord droit. Un menu trop haut pour l’écran peut défiler ; les boutons gardent leur hauteur.

**Montrer aux joueurs** était relié à une méthode absente. Cette commande affiche maintenant l’image choisie dans les Archives des joueurs, avec un bouton pour la fermer. **Retirer de l’écran des joueurs** termine la présentation pour tous. Les nouveaux arrivants reçoivent la présentation en cours. La présentation n’ouvre aucune cellule secrète et transmet uniquement l’image choisie et un intitulé générique. Les noms de fichiers, liens privés et autres images de la bibliothèque restent privés. Les images volumineuses ou les formats non pris en charge sont adaptés pour l’affichage, sans modifier l’original de la bibliothèque. Une restauration ou une réouverture côté MJ ne relance pas une ancienne présentation.

Actualiser la salle du MJ et les pages des joueurs. Après cette mise à jour, supprimer dans Owlbear les éventuels anciens tokens cachés à retirer définitivement. La commande **Owlbear : fichiers et transferts… → Retirer** reste également disponible dans la bibliothèque.

## V4.43 — images des cellules et classement multiple

Dans **Réglages de la cellule active**, le bouton **Bibliothèque d’images** est placé à côté de l’import depuis l’ordinateur. La fenêtre de choix propose une recherche par nom, un type de cellule et une sous-catégorie. **Utiliser cette image** applique l’illustration à la cellule choisie, avec son aperçu, sans recréer la cellule ni modifier ses descriptions et indices. Le sélecteur d’image de la barre de raccourcis propose le même accès.

Dans la bibliothèque d’images, sélectionner une image par clic gauche, puis en ajouter ou en retirer par **Ctrl + clic gauche** (ou Cmd sur Mac). Les cases à cocher permettent aussi la sélection, notamment sur tablette. Le compteur et la bordure mettent en évidence la sélection. Cliquer sur **Déplacer la sélection…**, choisir le type et la sous-catégorie de destination puis **Valider**. Il est possible de créer une sous-catégorie directement dans cette fenêtre. Le clic droit sur une image sélectionnée permet également d’opérer sur tout le lot. La commande **Copier** conserve les originaux et crée des copies dans la destination.

Le classement fonctionne pour une seule image et pour un lot. Une transaction unique empêche un déplacement partiel si l’enregistrement échoue. Les images conservent leurs fichiers, noms et dimensions d’origine ; le classement reste privé et persiste après rechargement. Les cellules déjà illustrées ne sont pas déplacées par le classement de leurs images dans la bibliothèque. Actualiser les pages du MJ et des joueurs pour charger cette version.

## V4.42 — canevas, fiches MJ et dossier des joueurs

La molette zoome et dézoome autour du pointeur, en tenant compte du panneau latéral. Les boutons de zoom utilisent la dernière position de la souris dans le canevas. Un acte sans titre apparaît comme **Acte sans nom** et les commandes restent alignées. Les menus des cellules et des flèches sont placés selon leur hauteur réelle ; ils deviennent défilants sur un écran trop petit.

Une **Fiche MJ** comporte maintenant un sélecteur **Choisir une cellule…** et le bouton **Ajouter une fiche**. Jusqu’à quatre fiches sont affichées côte à côte, avec leurs descriptions et indices indépendants. Chaque croix retire une fiche. Les petits écrans peuvent faire défiler les fiches horizontalement.

Le **Dossier des joueurs** conserve la recherche et remplace la liste de tri par des boutons à icônes : Tous, Personnages, Groupes, Lieux, Objets, Ressources, Événements et **Autre**. Dans la salle Owlbear, le MJ choisit **Autre → Ajouter un fichier dans Autre**, saisit le titre public puis **Partager dans Autre**. Les fichiers de la bibliothèque proposent également **Ajouter au dossier des joueurs** ou **Retirer du dossier des joueurs**. Les joueurs consultent les documents et lancent eux-mêmes les sons/vidéos, sans démarrage imposé.

Les fichiers restent enregistrés dans la bibliothèque du MJ ; il doit être connecté pour leur chargement. Limites existantes : documents de 25 Mo, sons/vidéos de 8 Mo, et 100 fichiers dans le dossier. Les originaux privés, les noms de fichiers d’origine et les liens vers les cellules ne sont jamais publiés par cette fonction. Une restauration de campagne remet les fichiers en privé : le MJ choisit ceux à repartager. Actualiser les salles du MJ et des joueurs pour charger cette version. Le connecteur SoundShow 0.3.3 reste compatible.

## V4.41 — reprise automatique de la vidéo des joueurs

Le lecteur surveille désormais l’arrivée du flux vidéo, au-delà de la seule connexion au PC. Si un flux annoncé reste absent ou se coupe alors que la vidéo doit jouer, il tente de rétablir la réception automatiquement. Les mises à jour de lecture ne repoussent pas indéfiniment ce contrôle. Les tentatives sont limitées et le bouton **Réessayer la connexion** reste disponible si la liaison ne revient pas.

Les pauses et arrêts du MJ, les changements de vidéo et les onglets masqués sont distingués d’une panne. Le retour sur l’onglet conserve une liaison qui fonctionne ; une liaison déjà interrompue peut reprendre au retour du réseau. Aucune commande de lecture SoundShow n’est renvoyée lors d’une reconnexion.

Un joueur rejoignant la diffusion en cours reçoit la vidéo actuelle et sa piste audio. Les essais automatiques contrôlent cette arrivée tardive et une interruption de transport suivie d’une reprise réelle de l’image et du son, sans nouvelle commande SoundShow.

**Le connecteur Windows 0.3.3 reste compatible.** Pour charger ce correctif, actualiser la salle du MJ et les pages des joueurs. Le réseau Wi-Fi, le PC Windows et la tablette Samsung doivent toujours faire l’objet d’un essai réel.

## V4.40 — vidéo et son directement dans les Archives des joueurs

Une vidéo lancée par le MJ dans SoundShow s’affiche maintenant **dans les Archives ouvertes par le joueur**, au-dessus du canevas et avec sa piste audio. La session vidéo est transmise automatiquement au lecteur de cette vue ; une seconde fenêtre vidéo Owlbear ne joue pas en parallèle sur le même appareil. Le retour à la carte rend la réception au lecteur Owlbear, et la réouverture des Archives reprend la liaison.

**Pour une première utilisation :**

1. Sur le PC MJ, ouvrir SoundShow 2 Pro, son serveur distant et le [connecteur Windows 0.3.3](https://github.com/toniogervais/archives-owlbear/releases/download/soundshow-bridge-v0.3.3/Archives-SoundShow-Connecteur.exe).
2. Dans le connecteur, saisir l’adresse annoncée par SoundShow et le mot de passe, puis **Connecter SoundShow**. Pour chaque vidéo à diffuser, cliquer sur **Choisir la vidéo** et sélectionner le fichier correspondant. Le fichier reste uniquement sur le PC MJ.
3. Cliquer sur **Ouvrir Owlbear et relier les joueurs**, puis rejoindre sa salle comme MJ. Les joueurs rejoignent cette même salle et ouvrent **Les Archives** avec leur bouton habituel. Garder le connecteur et son onglet Chrome ouverts.
4. Lancer la vidéo dans SoundShow, avec son bouton ou son raccourci habituel. La vidéo s’ouvre dans les Archives des joueurs ; aucune adresse vidéo ni aucun code SoundShow ne leur est demandé.
5. Si la tablette affiche **Autoriser l’image et le son**, toucher ce bouton. Il reste visible tant que le son est bloqué par le navigateur, même lorsque SoundShow envoie de nouveaux états de lecture.

**Revenir au jeu** masque la vidéo. Le bouton discret **Revoir la vidéo du MJ** permet de la réafficher sans attendre le film suivant. La fin du film libère le canevas ; le lecteur reste relié pour le suivant. Le panneau SoundShow du MJ indique le nombre de lecteurs joueurs reliés et les écrans qui doivent encore autoriser le son.

Le **nouveau connecteur 0.3.3 est nécessaire pour transmettre le son** : l’aperçu silencieux de l’ancienne version produisait un flux audio muet. Le son est désormais capturé séparément, sans ajout d’une seconde lecture sur le PC. Après publication, actualiser la salle Owlbear du MJ et celles des joueurs pour charger la V4.40. L’adresse de l’extension reste [manifest-v55.json](https://toniogervais.github.io/archives-owlbear/manifest-v55.json).

Le son diffusé est **celui du fichier vidéo**. Le mixage général des sons de SoundShow continue de sortir par les périphériques configurés dans SoundShow. Les effets visuels de sortie de SoundShow ne sont pas capturés ; le connecteur synchronise une lecture du fichier source. Utiliser Chrome sur le PC et, pour le premier essai, un MP4 H.264 avec audio AAC et des tablettes sur le même Wi-Fi. Les validations automatiques ne remplacent pas l’essai sur le PC Windows et la tablette Samsung du MJ.

# Les Archives de l’Imaginaire — Owlbear V4.26.0

## SoundShow : lecteur complet, sons et vidéos associés aux révélations

**Une seule fenêtre de jeu : Owlbear et son extension Les Archives.** Le MJ dispose dans Les Archives d'une barre SoundShow rétractable et déplaçable. Son icône **Sons** ouvre la grille des sons, désormais plus compacte ; l'icône **Vidéos** affiche les vidéos du projet SoundShow. Un panneau SoundShow apparaît à droite et réduit le canevas sans supprimer ni cacher les cellules. Sa poignée permet de modifier la largeur et son en-tête peut le détacher en fenêtre flottante déplaçable et redimensionnable. Le canevas se recentre quand la disposition change.

La partie supérieure du panneau propose un **lecteur SoundShow** des instances en cours (son ou vidéo), avec lecture/pause, boucle, arrêt, fondu sortant, volume individuel, durée, progression, et saut dans la lecture. La forme d'onde affichée est **indicative** : l'API SoundShow fournit des informations de lecture, mais pas les échantillons nécessaires à une forme d'onde réellement calculée. La position, les durées et les commandes sont, en revanche, celles des lecteurs actifs dans SoundShow. Les cases audio sont plus petites et leur nombre de colonnes varie automatiquement avec la largeur du panneau.

**Médias liés aux cellules.** Depuis les réglages d'une cellule ou son menu contextuel, le MJ peut sélectionner jusqu'à 16 sons et vidéos du projet SoundShow, avec un mode de démarrage propre à chaque média. Les associations sont sauvegardées avec la cellule. Quand le MJ révèle cette cellule (et uniquement au passage masquée → révélée), les commandes de lecture correspondantes partent vers SoundShow une seule fois. Si des médias y sont attachés, le gong générique de révélation ne se superpose pas. Les associations ne figurent pas dans les états de cellules communiqués aux joueurs.

**Vidéos chez les joueurs.** Les vidéos sont lancées via le bouton Vidéos de la télécommande ou par une révélation de cellule ; le lecteur vidéo existant utilise la liaison WebRTC Owlbear et s'affiche comme fenêtre intégrée sur l'écran joueur. Pour chaque source vidéo, le connecteur Windows doit avoir obtenu une première autorisation d'accès au fichier sur le PC MJ : les navigateurs ne peuvent pas lire arbitrairement les fichiers SoundShow sur le disque.

**Ergonomie générale.** Barre de raccourcis existante déplaçable ; barre d'intégrations, barre de commandes, barre SoundShow également repositionnables avec leurs poignées. La grande barre de titre du panneau hôte « Les Archives de l'Imaginaire » est supprimée, tout en conservant le retour vers Owlbear. Un bouton plein écran a été ajouté ; si le navigateur refuse le plein écran d'une fenêtre intégrée, l'interface affiche l'alternative F11.

La télécommande et les médias de révélations sont **réservés au MJ**. Le connecteur refuse les commandes inconnues et les lecteurs verrouillés ; les données privées des cellules et les mots de passe SoundShow ne sont pas transmis aux joueurs. Version connecteur Windows **0.3.3**. Les fonctions sont vérifiées en tests automatiques ; leurs interactions sur PC Windows/Chrome et tablettes Android doivent être validées en conditions réelles.



## Grille SoundShow latérale — sons au clic depuis le canevas

La vue MJ des Archives, ouverte **dans Owlbear**, dispose maintenant d'une barre SoundShow indépendante, rétractable sur le côté droit. Son icône **Sons** affiche un **panneau de grille latéral à droite du canevas**. Le panneau prend sa propre largeur dans la disposition, sans recouvrir les cellules : le canevas se réduit et se recentre pour conserver l'ensemble des informations. La barre se réduit à une languette et peut se redéployer. Le bouton SoundShow existant ouvre aussi cette grille.

La grille récupère automatiquement les sons, noms, catégories, couleurs, nombre de lectures, état de lecture et verrouillages du projet SoundShow via le connecteur Windows **0.3.1**. Les catégories masquées dans SoundShow restent masquées ; les cases verrouillées sont désactivées. La recherche et les filtres par catégorie restent accessibles sans sortir des Archives.

Par défaut, **clic gauche / appui tactile = lecture normale** (respectant les réglages du son dans SoundShow), **clic droit = fondu enchaîné** et **Maj + clic = fondu d'entrée**. Les associations gauche, droite, milieu, double et Maj+gauche peuvent être personnalisées dans « Préférences des clics » puis sont conservées localement pour chaque projet. Les actions disponibles sont lecture, fondu d'entrée, fondu enchaîné, remplacement, bascule lecture/arrêt et bascule lecture/fondu. La WebSocket API de SoundShow ne fournit pas une commande générique garantissant la reproduction de toutes les personnalisations de souris de l'interface SoundShow : ces associations sont définies dans Les Archives. Les boucles, sorties audio, réglages des éléments et fondus restent ceux de SoundShow.

La grille transmet les commandes au SoundShow sur le **PC du MJ**, via l'authentification locale existante, et n'est jamais accessible aux joueurs. Les effets sont confirmés par les snapshots de SoundShow, pas supposés à la réception d'un clic. L'ancienne télécommande complète conserve les commandes de contrôle global et vidéo. Tests automatiques en cours d'actualisation ; vérifier ensuite la sensation des clics sur le matériel réel.



## Télécommande SoundShow intégrée dans Les Archives — sons et vidéos

Depuis la salle Owlbear, le MJ ouvre l'extension **Les Archives**, puis clique sur son icône **SoundShow**. Une télécommande s'affiche directement dans cette fenêtre : deux filtres **Sons** et **Vidéos**, une recherche dans les éléments du projet, lecture immédiate ou avec fondu d'entrée. Une seconde partie **En cours de lecture** propose pause, reprise, arrêt, fondu de sortie et volume individuel. Les boutons globaux permettent pause/reprise, arrêt général ou fondu général ; un curseur définit le volume par défaut des sons suivants.

Cette télécommande pilote **le véritable SoundShow 2 Pro sur le PC**, avec les commandes de son API WebSocket v2, et non une imitation de lecteur audio. Le routage audio (PC/enceintes) reste configuré dans SoundShow ; les vidéos sources continuent à être diffusées en fenêtres intégrées dans Owlbear. Les sons ne sont pas copiés sur les tablettes, et aucun nouveau mot de passe ou onglet n'est nécessaire.

Sécurité : seule l'extension du MJ peut envoyer une commande au connecteur local, sous contrôle d'un jeton éphémère associé à la liaison Owlbear. Le connecteur limite les commandes aux fonctions prévues, contrôle les identifiants du projet et des lecteurs et ne permet ni modification de projet ni téléchargement de fichiers. Le bouton peut signaler l'envoi d'une commande, mais son effet est confirmé par les états successifs de SoundShow. Cette version nécessite le **connecteur Windows 0.3.0**. Les essais en environnement simulé ne remplacent pas une vérification sur le PC du MJ et les tablettes réelles.



## Owlbear reste le programme principal

Le connecteur SoundShow **0.2.1** ouvre maintenant uniquement **Owlbear Rodeo** avec le bouton **« Ouvrir Owlbear et relier les joueurs »**. Il n’ouvre plus un onglet autonome des Archives. Lorsque le MJ rejoint sa salle dans cet onglet Owlbear, l’extension Les Archives demande une liaison locale de manière automatique ; la session n’est placée ni dans l’URL ni dans le presse-papiers. La communication vérifie l’onglet Owlbear d’origine, le domaine des Archives, l’adresse de boucle locale du connecteur et le rôle GM. Les joueurs restent cantonnés à la réception des vidéos.

Les Archives restent accessibles **depuis le bouton de l’extension dans Owlbear**, dans la même interface. La vidéo s’ouvre sous forme de fenêtre intégrée à Owlbear ou à ses Archives embarquées. Aucune nouvelle fenêtre autonome Les Archives n’est nécessaire. Les codes manuels sont conservés en dépannage. Ce parcours utilise le lien d’ouverture du navigateur ; il faut donc rejoindre Owlbear depuis le bouton du connecteur pour la mise en relation automatique. La connexion sur le matériel réel doit encore être confirmée.



## Vidéos SoundShow — une seule connexion, dans Les Archives ou Owlbear

Le connecteur Windows 0.2.1 **prépare la diffusion automatiquement** dès que SoundShow est connecté. Il peut reprendre sans intervention les fichiers vidéo dont Chrome possède toujours l'autorisation. Un bouton principal **Ouvrir Les Archives et relier les joueurs** ouvre l'application et transmet la session au MJ en toute sécurité : plus de code SS2 à copier-coller ni de page de test à ouvrir. L'autorisation s'appuie sur une requête ponctuelle du programme local, un identifiant aléatoire d'ouverture et la vérification du rôle MJ. La session est ensuite propagée vers Owlbear et le Salon Live.

Les vidéos se présentent dans une **fenêtre intégrée**, et non dans une page séparée ni systématiquement en plein écran. Dans Owlbear, le lecteur utilise un modal de 780 × 500 pixels ; dans Les Archives, un panneau flottant adapté à la largeur de l'écran. L'utilisateur conserve le bouton **Revenir au jeu** et peut autoriser le son si nécessaire. Les anciens codes restent disponibles sous **Dépannage**.

Pour des raisons de sécurité, la première association du fichier vidéo sur le PC et la connexion au serveur SoundShow local restent nécessaires. La nouvelle liaison automatique nécessite le connecteur 0.2.0, qui doit être construit et installé une fois. Les connexions WebRTC sur un réseau réel restent à confirmer ; cette modification ne transforme pas le navigateur du joueur en contrôleur SoundShow. La télécommande SoundShow depuis Les Archives sera traitée ensuite.



## Démarrage des vidéos en boucle 4.22.4

Le lecteur PC règle désormais la boucle et la position de départ **avant** de lancer la capture du fichier. Lorsqu'une vidéo SoundShow tourne en boucle sans fin explicite, sa position est ramenée dans la durée réelle du fichier au lieu de rester bloquée à la dernière image. La liaison WebRTC prépare un petit nombre de candidats réseau à l'avance. Sur la tablette, le lecteur distingue l'annonce de la vidéo, la réception du flux et la première image ; il affiche le délai constaté jusqu'à cette image.

Cette correction vise notamment les vidéos déjà en lecture lorsque le joueur arrive. La baisse réelle de latence dépend des conditions du réseau et reste à mesurer sur la tablette. Le connecteur Windows **0.1.3** reprend le correctif de boucle (nécessite une nouvelle construction de l'exécutable). La télécommande sécurisée dans Les Archives reste un chantier distinct, à intégrer sans donner le droit de piloter SoundShow aux lecteurs joueurs.



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
