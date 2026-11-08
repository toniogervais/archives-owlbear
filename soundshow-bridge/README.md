# SoundShow 2 → tablettes des joueurs

Version d’essai 0.1.0. SoundShow reste le déclencheur : ses boutons, ses raccourcis clavier et sa télécommande lancent les vidéos. Le connecteur suit leur lecture et un onglet Chrome sur le PC diffuse la vidéo source aux lecteurs des Archives et d’Owlbear.

## Ce qu’il faut

- Un PC Windows avec SoundShow **2 Pro**, ou un essai Pro actif.
- Chrome sur le PC, avec l’onglet du connecteur ouvert pendant la partie.
- Des tablettes ou téléphones avec un navigateur compatible WebRTC. Aucun SoundShow à y installer.
- Un réseau qui autorise la communication entre appareils. Première cible : PC et tablettes sur le même Wi-Fi, sans isolation « invités ». Internet sert à la signalisation PeerJS et aux applications web.

Aucun outil ni abonnement vidéo payant supplémentaire. Le connecteur utilise des composants libres. Les flux passent directement entre navigateurs ; aucun fichier vidéo n’est déposé sur GitHub, Supabase ou le serveur de signalisation. Il n’y a pas de relais TURN payant. Certains réseaux isolés pourront empêcher la connexion ; cette version ne promet pas la diffusion sur Internet à travers tous les routeurs.

## Première installation sur le PC

1. Télécharger **Archives-SoundShow-Connecteur.exe** depuis la [version d’essai](https://github.com/toniogervais/archives-owlbear/releases/tag/soundshow-bridge-v0.1.0).
2. Lancer ce programme. Il ouvre une page locale. Garder sa fenêtre et cet onglet ouverts. Python et Node.js ne sont pas nécessaires avec cet exécutable.
3. Dans SoundShow : **Options → Intégrations → Serveur distant**. Définir un mot de passe puis démarrer le serveur. Le connecteur appelle uniquement le SoundShow de ce PC ; l’option « Autoriser les origines externes » n’est pas nécessaire pour cette liaison native.
4. Dans la page du connecteur, entrer l’adresse `ws://127.0.0.1:8080/ws` (adapter le port si nécessaire) et ce mot de passe. Le mot de passe reste en mémoire sur le PC et n’est jamais transmis aux joueurs.
5. Pour chaque bouton vidéo à diffuser, cliquer sur **Choisir la vidéo** et choisir le même fichier que dans SoundShow. Cela ne crée pas une deuxième copie du fichier. Dans Chrome, l’autorisation du fichier peut être mémorisée ; au prochain lancement, utiliser **Autoriser les vidéos mémorisées**. Un navigateur sans cette fonction demandera de rechoisir les fichiers à chaque session.
6. Cliquer sur **Préparer la diffusion**, puis **Copier le code**.
7. Dans les Archives, ouvrir le bouton **SoundShow**, coller le code puis choisir **Relier les joueurs**. Dans Owlbear, les joueurs de la salle reçoivent la connexion automatiquement. Dans le Salon Live autonome, les joueurs déjà présents et les nouveaux arrivants la reçoivent par leur liaison avec le MJ.
8. Lancer la vidéo dans SoundShow avec son raccourci habituel. Aucun second clic de lecture dans les Archives. Si le navigateur joueur bloque le son, toucher **Autoriser l’image et le son**.

Le code autorise la réception des vidéos de la session. Le partager uniquement avec les joueurs. **Terminer la diffusion** dans le connecteur invalide ce code. Les lecteurs ne peuvent pas piloter SoundShow ni parcourir les fichiers du PC.

Quand Owlbear est ouvert depuis les Archives principales, la connexion SoundShow est transmise automatiquement à cette salle. Une modification faite dans l’éditeur intégré revient également aux Archives principales. Le transfert vérifie l’origine et la fenêtre de salle ouverte par le MJ. Sur la tablette, le lecteur autonome des Archives se coupe quand son onglet passe à l’arrière-plan pour éviter de doubler le son pendant la bascule vers Owlbear.

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
