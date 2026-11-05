# Les Archives de l'Imaginaire — application Windows (prototype)

## Problème résolu

Owlbear Rodeo refuse d'être intégré dans une iframe d'une page externe (`frame-ancestors`/politique anti-intégration). Ce projet n'essaie **pas** de contourner cette protection. Il utilise **deux vues de navigateur natives WebView2**, chacune chargée comme une page de premier niveau. Une seule fenêtre Windows, aucune ouverture de nouvel onglet pour basculer.

**Les Archives sont le programme d'accueil** et le bouton unique affiche Owlbear. Le bouton change alors en « Retour aux Archives ». L'icône Owlbear déjà présente dans le canevas déclenche aussi la bascule. Les deux vues restent vivantes en mémoire : cacher l'une ne la recharge pas.

## Technique

- Windows 10/11, .NET 8, WinForms, Microsoft Edge WebView2.
- Page Archives actuelle : `archives-app-v51-v37.html` (aucune modification des anciennes versions).
- Page Owlbear : lien officiel `https://www.owlbear.rodeo/...` propre à la salle.
- Profil navigateur local : `%LOCALAPPDATA%\ArchivesImaginaire\WebView2Profile`.
- Lien de salle : `%LOCALAPPDATA%\ArchivesImaginaire\settings.json`.
- Pour changer de salle, clic droit sur le bouton de bascule > « Changer la salle Owlbear… ».

## Compiler (pour la CI, aucune manipulation de code demandée à l'utilisateur)

Un workflow GitHub Windows construit le ZIP contenant l'EXE et ses dépendances, sans nécessiter Node.js sur le PC de l'utilisateur. Décompresser entièrement le ZIP, puis lancer `ArchivesImaginaire.exe`. Ne pas exécuter directement dans le ZIP.

Le runtime Microsoft Edge WebView2 est requis ; il est généralement installé sur Windows récents.

## Limites et risques : à lire avant le test

1. **Prototype non testé dans une salle réelle**. Une compilation Windows réussie ne prouve pas que la connexion Owlbear et les changements de vue fonctionneront parfaitement.
2. Le stockage local WebView2 est **distinct** du stockage Edge : les anciennes cellules enregistrées uniquement dans Edge ne sont **pas importées automatiquement**. Pour un test, ne pas modifier ni créer de campagne principale. L'import/export existant est à utiliser après validation.
3. Les deux vues restent chargées lors d'une bascule mais cette version ne réalise pas encore la synchronisation entre les joueurs ou avec Supabase.
4. Certaines procédures de connexion (notamment authentification par des fournisseurs tiers) peuvent refuser le navigateur intégré et ouvrir le navigateur système. Il faudra tester la méthode de connexion Owlbear employée.
5. Le lien de salle est stocké localement dans le profil Windows, sans publication en ligne. Il peut contenir un code de salle : ne pas partager le fichier `settings.json`.
6. Ce prototype n'installe aucune extension Owlbear, ne change pas les permissions des joueurs ni les données de tes campagnes, et n'écrase pas les fichiers HTML existants.

## Validation visée

- Ouvrir l'exécutable : **Les Archives** apparaissent au premier plan.
- Cliquer sur « Afficher Owlbear » (ou son icône du canevas), puis coller une fois le lien complet de la salle.
- Owlbear apparaît dans **la même fenêtre Windows**, comme page native (non comme iframe).
- Cliquer sur « Retour aux Archives » : revenir au même canevas, sans nouvelle fenêtre ni nouvel onglet.
- Vérifier la persistance d'un affichage simple dans chaque vue, puis effectuer séparément les tests de données.

L'objectif final reste une intégration et une synchronisation approfondies entre les deux logiciels.
