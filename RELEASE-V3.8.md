# Version V3.8 — Archives d'abord (version de développement)

## Ce qui change
- Nouvelle entrée principale **archives.html** : ouvre directement le canevas et ses cellules.
- L'icône Owlbear du canevas ouvre la carte dans un onglet distinct sans fermer les Archives.
- Le lien de salle Owlbear est demandé une seule fois et reste modifiable via les paramètres du navigateur (stockage local).
- Une extension V3.8 propose un accès simplifié aux Archives depuis Owlbear : un bouton d'ouverture et un retour unique, sans barre « Partager le mode ».
- Les versions V3.7, V3.6 et les fichiers précédents sont intacts.

## Ce qui n'est pas encore résolu
- Le stockage local de l'application hébergée n'est pas automatiquement fusionné avec les anciennes sauvegardes locales, ni entre les contextes navigateur et iframe Owlbear.
- Le basculement automatique des joueurs et les règles de verrouillage côté serveur ne sont pas validés.
- Le transfert des images et les permissions Owlbear avancées ne sont pas intégrés par ce simple changement d'interface.
- Cette livraison ne remplace pas la nécessité de valider en salle réelle et avec les fichiers existants.
- La page principale et les noms d'onglets ont été étudiés pour limiter les manipulations, mais les restrictions des fenêtres des navigateurs peuvent imposer l'autorisation d'ouvrir une fenêtre.

## Pour tester après publication
1. Ouvrir https://toniogervais.github.io/archives-owlbear/archives.html
2. Vérifier l'affichage immédiat du canevas sans écran titre.
3. Cliquer sur l'icône Owlbear ; la première fois, coller le lien complet de la salle.
4. Vérifier que la carte s'ouvre sans fermer le canevas.
5. En option, installer le manifeste V3.8 dans Owlbear **à la place** de la V3.7 pour tester le retour depuis Owlbear.

Ne pas créer ni modifier sa campagne principale lors du premier test, car les stockages locaux peuvent rester séparés.
