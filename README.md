# archives-owlbear
Extension Owlbear Rodeo pour Les Archives de l’Imaginaire : synchronisation des scènes, des cartes et des interactions entre meneur de jeu et joueurs.

## Passer des Archives à Owlbear

- Archives : [ouvrir l’application](https://toniogervais.github.io/archives-owlbear/archives.html).
- Owlbear : [adresse de l’extension V4.15](https://toniogervais.github.io/archives-owlbear/manifest-v55.json). Actualise la salle si l’extension est déjà installée.
- Dans les Archives, clique sur **Owlbear**. Si aucune salle n’est enregistrée, colle son lien une seule fois. Laisse les Archives ouvertes.
- Dans Owlbear, clique sur l’**icône du livre** pour afficher ton scénario en cours. **Retour à Owlbear** ramène à la carte.
- Si le navigateur ne permet pas la liaison directe, ouvre **État de synchronisation** dans les Archives, puis **Copier le code de secours**. Colle-le une fois dans **Connexion de secours** dans Owlbear. Ce code est privé et différent du code du Salon Live.

## Envoyer une cellule ou une image

- Dans Owlbear, ouvre la carte voulue. Dans le menu de l’extension, ouvre **Transferts vers Owlbear**, connecte ton compte Archives, choisis ta campagne et clique sur **Utiliser la scène ouverte**. Recommence le choix de scène quand tu changes de carte.
- Dans les Archives, utilise **Envoyer à Owlbear** dans le menu d’une cellule ou d’une image. Vérifie la campagne indiquée, puis confirme. Owlbear place les nouveaux éléments au centre de la vue du MJ. Tu peux ensuite les déplacer et les redimensionner. Le panneau d’envoi d’image permet aussi de saisir une position et une échelle avant la publication.

Le projet Supabase doit disposer du stockage de révélations existant et de la [table de transferts](sql/archives-cell-transfers-v45.sql). Ce script peut être réexécuté pour ajouter les champs de placement à une installation existante. Les seules images publiées par le transfert sont celles confirmées par le MJ. Une image publiée est accessible aux personnes qui possèdent son URL.
