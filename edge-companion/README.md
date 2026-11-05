# Module Edge — Bascule Les Archives

Source de référence pour la variante V4.4. Le ZIP d'installation complet est livré avec ses icônes PNG et un guide Windows.

Le module Edge écoute un message `archives:return:v44` provenant de l'extension Owlbear sur `toniogervais.github.io` et active l'onglet existant des Archives par l'API `chrome.tabs.update` sans rechargement. Si aucun onglet n'existe, il crée la page de reprise. Aucun contenu de campagne n'est lu.

Pour préparer une installation par Edge « Charger l'extension décompressée », copier le manifeste et les deux scripts dans un dossier **avec** les fichiers `icon16.png`, `icon48.png` et `icon128.png` du ZIP. Ne pas omettre ces icônes.
