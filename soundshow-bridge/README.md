# SoundShow 2 → tablettes des joueurs

Version d’essai 0.3.0. La nouveauté est une **télécommande complète pour les sons et les vidéos** directement dans Les Archives, au sein d'Owlbear. Le connecteur prépare la liaison vidéo automatiquement, retrouve les fichiers déjà autorisés et transmet la connexion à l'extension Les Archives **depuis Owlbear** sans codes manuels. Il conserve la correction de démarrage des vidéos en boucle. Les gains de temps dépendent du réseau et doivent être vérifiés sur la tablette. SoundShow reste le déclencheur : ses boutons, ses raccourcis clavier et sa télécommande lancent les vidéos. Le connecteur suit leur lecture et un onglet Chrome sur le PC diffuse la vidéo source aux lecteurs des Archives et d’Owlbear.

## Ce qu’il faut

- Un PC Windows avec SoundShow **2 Pro**, ou un essai Pro actif.
- Chrome sur le PC, avec l’onglet du connecteur ouvert pendant la partie.
- Des tablettes ou téléphones avec un navigateur compatible WebRTC. Aucun SoundShow à y installer.
- Un réseau qui autorise la communication entre appareils. Première cible : PC et tablettes sur le même Wi-Fi, sans isolation « invités ». Internet sert à la signalisation PeerJS et aux applications web.

Aucun outil ni abonnement vidéo payant supplémentaire. Le connecteur utilise des composants libres. Les flux passent directement entre navigateurs ; aucun fichier vidéo n’est déposé sur GitHub, Supabase ou le serveur de signalisation. Il n’y a pas de relais TURN payant. Certains réseaux isolés pourront empêcher la connexion ; cette version ne promet pas la diffusion sur Internet à travers tous les routeurs.

La version 0.1.2 ajoute le diagnostic facultatif dans le connecteur : nombre de tentatives reçues, lecteurs confirmés et erreurs de liaison (sans codes secrets). La version 0.1.1 corrige le refus des adresses privées comme `192.168.x.x` annoncées par SoundShow. Elle garde le serveur du connecteur accessible uniquement sur ce PC, exige sa clé administrateur et refuse les adresses publiques, les domaines externes et les redirections avant tout envoi du mot de passe. Un serveur injoignable affiche désormais une erreur d’adresse/port explicite.

## Utiliser la télécommande du MJ

Ouvre Owlbear **depuis le bouton du connecteur Windows**, puis la salle comme MJ et **Les Archives** via leur extension. Clique sur **SoundShow : sons, vidéos et télécommande** dans la barre des Archives.

- **Sons / Vidéos** : explore ou recherche les éléments audio et vidéo du projet SoundShow, puis lance-les normalement ou en fondu d'entrée
- **En cours de lecture** : pause, reprise, arrêt, fondu de sortie et volume de chaque lecteur non verrouillé
- **Commandes générales** : pause de tout, reprise, arrêt général ou fondu général ; volume par défaut des sons suivants

Les boutons contrôlent SoundShow 2 lui-même par sa WebSocket API version 2. Les sons sortent par les périphériques configurés dans SoundShow, pas automatiquement sur les tablettes des joueurs. La réception vidéo reste assurée par les lecteurs WebRTC intégrés à Owlbear. Aucun second onglet Archives ni saisie du code SS2 n'est nécessaire. Si SoundShow est déconnecté, les commandes se désactivent. Les joueurs n'ont pas accès à la télécommande.

## Installation simplifiée — Owlbear est le programme central

1. Ouvre SoundShow 2 Pro et son **serveur distant** sur ton PC, puis lance le [connecteur Windows 0.3.0](https://github.com/toniogervais/archives-owlbear/releases/tag/soundshow-bridge-v0.3.0). Le connecteur ouvre automatiquement sa page dans Chrome.
2. Dans cette page, indique l'adresse locale affichée par SoundShow et le mot de passe de son serveur, puis clique sur **Connecter SoundShow**. Les paramètres secrets ne sont pas envoyés aux joueurs.
3. Lors de la première utilisation d'une vidéo, utilise **Choisir la vidéo** pour sélectionner sur ton PC le fichier correspondant au bouton SoundShow. Chrome peut mémoriser l'autorisation du fichier ; lorsque cette autorisation subsiste, le nouveau connecteur retrouve le fichier automatiquement. Sinon, clique sur **Autoriser les vidéos mémorisées**.
4. Clique sur **Ouvrir Owlbear et relier les joueurs**. Le connecteur ouvre **Owlbear, jamais un onglet Archives séparé**. Rejoins ta salle Owlbear comme MJ : l'extension Les Archives installée dans cette salle demande automatiquement au connecteur local la session SoundShow. La demande est limitée au navigateur Owlbear ouvert par le connecteur et vérifie le rôle MJ. Les joueurs présents et nouveaux reçoivent la liaison.
5. Pendant la partie, lance simplement tes vidéos dans SoundShow. Elles apparaissent dans une **fenêtre intégrée à Owlbear**, ou dans la vue **Les Archives** ouverte depuis l'extension Owlbear, suivant l'écran du joueur. Il peut devoir toucher **Autoriser l'image et le son** une fois si Chrome refuse le son automatique.

Le connecteur et son onglet Chrome doivent rester ouverts pendant la diffusion. La fenêtre vidéo reste intégrée à Owlbear ou aux Archives embarquées dans Owlbear ; aucune page de test ni onglet Archives autonome n'est nécessaire. **La salle Owlbear doit être ouverte depuis le bouton du connecteur** pour que l'extension puisse identifier la fenêtre locale qui l'a ouverte. Le navigateur ne peut pas atteindre arbitrairement un onglet Owlbear déjà ouvert sans liaison préalable.

Pour dépanner seulement, déplie **Connexion manuelle** dans le connecteur et **Dépannage : connexion manuelle** dans Les Archives ; les anciens codes `SS2.…` restent utilisables. **Terminer la diffusion** invalide la session. Les lecteurs joueurs ne peuvent ni piloter SoundShow ni parcourir les fichiers du PC.

L'intégration à Owlbear conserve son contrôle des rôles : un compte joueur ne reçoit que la liaison de lecture. L'ouverture de la salle Owlbear depuis les Archives principales permet de transmettre automatiquement cette session à ses joueurs. La fenêtre de vidéo dans Owlbear n'est plus obligatoirement plein écran ; dans Les Archives la vidéo s'affiche dans un panneau flottant.

## Essayer avant d’avoir SoundShow

Dans la page du connecteur, déplier **Essayer avant l’installation de SoundShow**, puis **Activer la simulation**. Associer un fichier au bouton de démonstration, préparer la diffusion et utiliser les commandes de simulation. Elles ne commandent aucun SoundShow réel.

## Ce qui est suivi

Lecture, pause, reprise, déplacement dans la vidéo, volume, silence et arrêt du lecteur. Une vidéo non associée n’est pas diffusée. Cette première version affiche une vidéo à la fois. Si la connexion à SoundShow disparaît, la diffusion est arrêtée pendant la reconnexion. Le connecteur n’envoie aucune commande de déclenchement à SoundShow, y compris après reconnexion.

La diffusion est une lecture de la **vidéo source** synchronisée avec l’état de SoundShow. Les effets, calques, transitions visuelles et mixages de sortie de SoundShow ne sont pas capturés. Il existe un délai de transmission ; ce n’est pas une synchronisation image par image entre appareils. Commencer par un MP4 H.264 avec son AAC, lisible par Chrome. Un format accepté par SoundShow n’est pas forcément accepté par le navigateur du PC.

Les essais automatiques utilisent un faux SoundShow conforme au protocole documenté. Ils ne remplacent pas la validation avec la version installée du logiciel, les raccourcis du MJ et les tablettes réelles. L’autorisation de lecture audio dépend du navigateur et peut être redemandée.

## Développement et vérifications

Pour travailler sur les sources, Python 3.12 ou ultérieur et les dépendances de `requirements.txt` sont nécessaires. Depuis la racine du dépôt :

```sh
python -m pip install -r soundshow-bridge/requirements.txt
python soundshow-bridge/bridge.py
python -m unittest discover -s soundshow-bridge/tests -v
node --test tests/soundshow.test.mjs
```

Le parcours `python soundshow-bridge/tests/browser.py` nécessite Playwright, Chromium et FFmpeg **uniquement pour les tests de développement**. Il établit une vraie connexion WebRTC locale et vérifie les images et le signal audio reçu, les changements de lecture et le rechargement sans commande rejouée. `node tests/browser-soundshow.cjs` vérifie l’intégration à une salle simulée et le refus des connexions annoncées par un joueur.

La construction Windows produit un exécutable autonome avec PyInstaller et effectue un démarrage de contrôle avant publication. Bibliothèques : aiohttp (Apache 2.0), PeerJS 1.5.2 (MIT, licence déjà présente dans `assets/peerjs-1.5.2.LICENSE`). Sources du connecteur et de ses modules : licence MIT dans ce dossier.

Documentation de référence : [connexion à SoundShow 2](https://soundshow.app/fr/docs/websocket-api/getting-started/), [état et événements](https://soundshow.app/fr/docs/websocket-api/state-and-events/), [capture vidéo du navigateur](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/captureStream).
