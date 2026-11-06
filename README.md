# archives-owlbear
Extension Owlbear Rodeo pour Les Archives de l’Imaginaire : synchronisation des scènes, des cartes et des interactions entre meneur de jeu et joueurs.

## Jouer depuis Owlbear dans un seul onglet

- Ouvre ta salle Owlbear et utilise l’[adresse de l’extension](https://toniogervais.github.io/archives-owlbear/manifest-v55.json). Actualise la salle si l’extension est déjà installée.
- Clique sur l’**icône du livre** pour ouvrir les Archives dans la salle. Le scénario est sauvegardé dans le navigateur pour cette salle et ce compte Owlbear.
- Si tu as déjà un scénario dans l’[application web des Archives](https://toniogervais.github.io/archives-owlbear/archives.html), exporte-le en JSON et choisis **Importer un scénario** la première fois dans Owlbear. Les sauvegardes du site et de la salle sont distinctes.
- Les joueurs rejoignent la salle Owlbear. Au changement d’écran du MJ, un bouton au centre leur permet de suivre la partie. Ils peuvent fermer l’invitation en touchant le fond ou en appuyant sur Échap.
- **Retour à Owlbear** ramène le MJ à la carte dans le même onglet. Les joueurs retrouvent les éléments révélés quand ils reviennent dans les Archives.

La liaison des versions précédentes reste disponible si tu ouvres Owlbear depuis l’application web des Archives.

## Envoyer une cellule ou une image

- Dans Owlbear, ouvre la carte voulue. Dans le menu de l’extension, ouvre **Transferts vers Owlbear**, connecte ton compte Archives, choisis ta campagne et clique sur **Utiliser la scène ouverte**. Recommence le choix de scène quand tu changes de carte.
- Dans les Archives, utilise **Envoyer à Owlbear** dans le menu d’une cellule ou d’une image. Vérifie la campagne indiquée, puis confirme. Owlbear place les nouveaux éléments au centre de la vue du MJ. Tu peux ensuite les déplacer et les redimensionner. Le panneau d’envoi d’image permet aussi de saisir une position et une échelle avant la publication.

Le projet Supabase doit disposer du stockage de révélations existant et de la [table de transferts](sql/archives-cell-transfers-v45.sql). Ce script peut être réexécuté pour ajouter les champs de placement à une installation existante. Les seules images publiées par le transfert sont celles confirmées par le MJ. Une image publiée est accessible aux personnes qui possèdent son URL.
