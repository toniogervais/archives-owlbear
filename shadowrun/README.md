# Compendium Shadowrun 6

Extension indépendante des Archives, consultation également possible dans un navigateur.

- Consultation : https://toniogervais.github.io/archives-owlbear/shadowrun/
- Manifest Owlbear : https://toniogervais.github.io/archives-owlbear/shadowrun/manifest.json

Recherche commune, filtres par type / ouvrage / domaine, favoris, notes personnelles, navigation au clavier et affichage téléphone/tablette. Le lecteur local peut ouvrir la section recherchée et retrouver n’importe quelle page. Les originaux anglais sont identifiés. Les options du Companion ne remplacent pas silencieusement les règles de base.

Les textes et les illustrations des six livres sont accessibles par le lien personnel de la table et restent hors du dépôt public. **Mes livres** accepte les anciens fichiers HTML et JSON, le fichier V2, le fichier V2.1 compressé, ainsi que chaque PDF source. L’import du HTML ne lit que les données et n’exécute aucun script du fichier. Les PDF sont traités sur cet appareil ; aucun texte ni PDF n’est envoyé à un serveur.

## Lecture fiable des passages (1.4.4)

Lors d'un nouvel import d'un **PDF personnel**, le compendium conserve localement la typographie des titres (texte court et taille de police). Le lecteur s'en sert pour couper un passage avant la rubrique imprimée suivante, y compris quand le sommaire appelle la rubrique autrement ou que le paragraphe continue à la page suivante. Les documents et le texte intégral restent sur l'appareil ; aucun PDF n'est publié dans le dépôt.

Les anciens fichiers V2 / V2.1 restent compatibles mais ne contiennent pas nécessairement ces repères de police. Pour bénéficier des nouvelles limites typographiques sur ces fichiers, réimporter le PDF concerné via **Mes livres**. Une suite de page inférée sans ancrage certain est signalée comme telle ; elle n'est jamais certifiée automatiquement.

Le sommaire nomme « Magie » la sous-rubrique des soins du livre de base (PDF 126), alors que l'intitulé imprimé est « Sorts » ; le renvoi conserve les deux noms sans les fusionner. Premiers soins, médikit, soins magiques et récupération naturelle disposent chacun de leur procédure et de leur jet.

## Consultation par thème et par table

Le sommaire regroupe quinze thèmes. Le filtre « Jets à prévoir » réunit les procédures qui donnent une réserve et les passages de test indexés. Les compétences, les notes et les favoris se consultent dans le panneau Owlbear. Sa taille suit la fiche ouverte.

Le manifeste personnel de la table ouvre le même client avec accès aux six ouvrages. Le lecteur récupère le texte du livre et les planches à la demande. La recherche intégrale démarre lors de la première recherche. Un lien vers la page d’origine permet de consulter aussi les tableaux et les illustrations dans leur mise en page. Le service de lecture vérifie l’accès de la table pour chaque requête. Conserver les liens de table et les originaux hors du dépôt public.

## Contenu et rapidité

Cette version contient 372 rappels français, 1 231 références d’équipement et 255 profils chiffrés, dont 181 de Wild Life et 26 nouveaux contacts du Companion. Les valeurs des contacts et des créatures conservent leurs cellules originales. Les rubriques supplémentaires restent directement lisibles dans les livres personnels : leur présence dans l’index ne signifie pas que toutes disposent déjà d’un résumé français rédigé.

Les situations courantes affichent le jet, l’opposition, le seuil, le résultat, les limites et les liens vers le matériel utile. Les questions ordinaires, les accents, les synonymes et une faute de frappe sont pris en charge. Les résultats du catalogue s’affichent immédiatement ; le chargement des livres et leur recherche ne bloquent pas les fiches. Les passages longs des fiches déjà résumées ne sont préparés qu’à leur ouverture.

`build_fast_personal.py` corrige le démarrage du fichier V2, conserve ses tables auditées et ses avertissements de divergence, compresse ses livres et prépare l’index en arrière-plan. Le fichier V2.1 conserve les 1 252 pages, les 3 322 rubriques, les 1 318 passages de tests et les quatre fac-similés. Son contenu intégral demeure personnel. Ne jamais ajouter les fichiers HTML générés ou leurs données de livres à ce dépôt.

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
