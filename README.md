# Les Archives de l’Imaginaire — Owlbear V4.16

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
