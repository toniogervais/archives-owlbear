# Compendium Shadowrun 6

Extension indépendante des Archives, consultation également possible dans un navigateur.

- Consultation : https://toniogervais.github.io/archives-owlbear/shadowrun/
- Manifest Owlbear : https://toniogervais.github.io/archives-owlbear/shadowrun/manifest.json

Recherche commune, filtres par type / ouvrage / domaine, favoris, notes personnelles, navigation au clavier et affichage téléphone/tablette. Le lecteur local peut ouvrir la section recherchée et retrouver n’importe quelle page. Les originaux anglais sont identifiés. Les options du Companion ne remplacent pas silencieusement les règles de base.

Les textes des six livres ne sont pas hébergés dans le dépôt public. Dans **Mes livres**, importer le fichier personnel `SR6_Compendium_FR_V1_1.html` déjà fourni, ou `SR6_Compendium_six_ouvrages.json`, pour les consulter et les rechercher. L’import du HTML lit uniquement les données intégrées et n’exécute aucun de ses scripts. Les anciens imports des cinq livres restent compatibles. Les textes, favoris et notes utilisent le stockage de cet appareil ; leur import n’envoie pas les livres à un serveur.

## État de la couverture

Lire `data/coverage.json` pour les nombres issus de la dernière génération. Cette version fournit l’index des 1 252 pages, 217 rappels rédigés en français, 1 231 entrées d’équipement et 229 profils chiffrés, dont 181 de Wild Life. Une référence d’index n’est pas un rappel rédigé. Les descriptions narratives anglaises et les sections sans rappel restent dans leur langue source. La rédaction française exhaustive et l’audit de chaque entrée d’équipement restent à poursuivre.

Les attributs, moniteurs, déplacements, valeurs matricielles et astrales des profils conservent leurs cellules source. Le tableau de comparaison rend la localisation inspectable. Les formules d’esprit F deviennent P, les dommages S deviennent E, et les deux R du furfur sont distingués par leur position dans le tableau. Les ambiguïtés réelles du PDF sont signalées ; aucune valeur n’est recalculée silencieusement.

## Inventaires MJ

Un panier permet d’attribuer de l’équipement à un token existant. Le MJ est contrôlé au moment de chaque lecture et écriture. Une fiche Archives est mise à jour dans son enregistrement privé atomique ; les autres inventaires sont locaux et identifiés par salle, scène, compte et token. Aucun contenu d’inventaire ou de fiche n’est placé dans les métadonnées publiques de scène. L’entrée Équipement Shadowrun est ajoutée au menu natif des tokens ; sélectionner un token n’ouvre pas de fiche.

## Validation et génération

```sh
npm run test:sr6
python3 shadowrun/extract_profiles.py /chemin/du/dossier-de-travail
python3 shadowrun/build_compendium.py /chemin/du/dossier-de-travail
```

Les générateurs exigent les PDF fournis et l’extraction initiale dans `analysis_sources/` et `artifacts/`, hors dépôt. Ils écrivent les index et données factuelles dans `shadowrun/data/`, puis un import complet séparé dans `artifacts/`. Ne pas ajouter cet import ni les PDF au dépôt public.
