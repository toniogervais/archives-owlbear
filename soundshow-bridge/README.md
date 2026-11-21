# SoundShow dans les Archives 4.73

La télécommande MJ pilote SoundShow 2 depuis les Archives principales et depuis les Archives ouvertes dans Owlbear. Les joueurs reçoivent la vidéo dans leur écran de jeu. Ils peuvent rejoindre une diffusion en cours.

## Démarrer une séance

1. Sur le PC du MJ, ouvre le projet dans SoundShow 2 Pro ou son essai Pro. Dans **Options → Intégrations → Serveur distant**, démarre le serveur avec son mot de passe.
2. Lance le [connecteur Windows 0.4.0](https://github.com/toniogervais/archives-owlbear/releases/download/soundshow-bridge-v0.4.0/Archives-SoundShow-Connecteur.exe). Dans sa fenêtre de navigateur, saisis l’adresse du serveur SoundShow et son mot de passe, puis choisis **Connecter SoundShow**.
3. Pour utiliser le Salon Live des Archives, clique sur **Ouvrir les Archives du MJ** et rejoins ta partie habituelle. Si ta table utilise Owlbear, tu peux aussi choisir **Ouvrir Owlbear et relier les joueurs** puis rejoindre ta salle MJ. La fenêtre ouverte par le connecteur reçoit la télécommande. Laisse le programme et son onglet ouverts.
4. Dans les Archives, clique sur **Sons**. Une case déclenche le son sur les sorties de SoundShow. Le lecteur du panneau propose la pause, la reprise, la boucle, le volume, le déplacement dans la piste, l’arrêt et le fondu. Le clic droit effectue un fondu enchaîné selon les préférences du MJ.

## Improviser une vidéo

**Lancer depuis SoundShow.** Ouvre sa fenêtre de projection sur le PC. Dans le connecteur, clique sur **Partager la fenêtre de projection**, puis désigne cette fenêtre dans le sélecteur de Chrome ou Edge. Choisis le partage audio de la fenêtre s’il est proposé. Le connecteur indique **image et son** ou **image seule**. Ce choix vaut pour la séance. Lance ensuite tes vidéos au clavier dans SoundShow ou depuis les cases **Vidéos** des Archives. La liaison avec chaque lecteur est établie dès que la projection est prête. Entre deux vidéos, les pistes transmettent du noir et du silence. La fermeture du partage libère la capture.

**Choisir un fichier au dernier moment.** Dans les Archives, ouvre **Vidéos → Diffuser une vidéo du PC…** et choisis le fichier. Le connecteur lit l’original sur le PC et diffuse son image et sa piste sonore. Cette option fonctionne sans associer le fichier à un bouton SoundShow et sans l’importer dans la campagne. La fin du fichier ou **Arrêter la vidéo du PC** rend la main à la projection SoundShow si elle est active. MP4 H.264/AAC et WebM sont de bons premiers essais dans Chrome Windows.

**Utiliser des associations existantes.** Le connecteur conserve **Associer des fichiers aux boutons SoundShow** et les autorisations de fichier que le navigateur a mémorisées. Ce mode reste disponible lorsque le partage de projection est arrêté. Les médias attachés aux cellules se déclenchent à leur révélation.

## Sur les écrans des joueurs

Ouvre le Salon Live ou la salle Owlbear avec le rôle joueur. La première lecture sonore peut demander un appui sur **Autoriser l’image et le son**. **Revenir au jeu** masque la vidéo pour ce joueur. L’arrivée de la prochaine vidéo la réaffiche. Si la fenêtre partagée transmet seulement l’image, **Diffuser une vidéo du PC…** permet d’envoyer sa piste son telle qu’elle est décodée sur le PC.

Le connecteur utilise WebRTC entre le PC et les navigateurs. La signalisation utilise Internet. Sur une table locale, le PC et les tablettes doivent pouvoir communiquer sur le Wi-Fi. Les originaux restent sur le PC. Le premier affichage dépend notamment de la connexion déjà établie, du décodage, du Wi-Fi et du nombre d’écrans.

Le compteur du connecteur indique les lecteurs confirmés. Si aucun lecteur n’apparaît, vérifie que l’appareil joueur a rejoint le même Salon Live ou la même salle. Le code de secours sous **Connexion manuelle** sert à distribuer la session de lecture. L’authentification de la télécommande MJ se fait dans la fenêtre ouverte depuis le connecteur. La simulation du connecteur permet un essai sans SoundShow installé.

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
