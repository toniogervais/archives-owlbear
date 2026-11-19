"""French labels and short uses for the Companion's factual contact profiles."""
CONTACTS={
'armorer':(2,'Rue','Fournit armures, ajustements sur mesure et modifications de protection.','Mode actuelle, physiologie métahumaine'),
'arms dealer':(4,'Rue','Fournit armes, munitions et modifications d’armement ; son cadre d’activité détermine ce qu’il accepte de vendre.','Lames anciennes, balistique, armurerie, fabricants d’armes'),
'artificer':(5,'Magie','Crée des focus et des objets magiques ; connaît les traditions et d’autres membres de la communauté Éveillée.','Taille des gemmes, théorie magique, métallurgie, tatouage, savoir de sa tradition'),
'bounty hunter':(4,'Rue','Retrouve des personnes recherchées ou des créatures à capturer ; maîtrise pistage et survie.','Comportement animal, forces de l’ordre locales, menaces magiques'),
'chemist':(3,'Ingénierie','Fournit et analyse composés chimiques, toxines ou médicaments selon son équipement et sa spécialité.','Biologie, grossistes en produits chimiques, fabricants de matériel de laboratoire, rumeurs'),
'cleaner':(3,'Rue','Nettoie les scènes de crime et fait disparaître des traces matérielles.','Nettoyage des traces de sang, techniques de police scientifique, biologie métahumaine'),
'city worker':(1,'Gouvernement','Connaît les réseaux et services urbains : eau, électricité, égouts, entretien et circulation.','Connaissance de la région, services municipaux : électricité, égouts, eau, circulation'),
'college professor':(2,'Universitaire','Apporte une expertise spécialisée et des accès au milieu universitaire et à la recherche.','Personnalités universitaires, politique du campus, rumeurs de faculté ; ajouter au moins 3 connaissances liées à sa spécialité'),
'corporate wageslave':(2,'Corporatiste','Connaît le fonctionnement, les habitudes et les rumeurs de sa corporation.','Comptabilité, politique corporatiste, rumeurs corporatistes'),
'deckmeister':(5,'Matrice','Fournit et entretient du matériel matriciel ; connaît réseaux, fabricants et actualité de la Matrice.','Fabricants de matériel matriciel, rumeurs matricielles, théorie matricielle'),
'entertainer':(3,'Médias','Ouvre les portes du spectacle et renseigne sur artistes, célébrités et rumeurs du milieu.','Rumeurs du spectacle, personnalités du spectacle'),
'ganger':(1,'Rue','Connaît son quartier, les gangs et les activités clandestines locales.','Connaissance de la région, crime organisé local, forces de l’ordre locales'),
'government official':(4,'Gouvernement','Aide à comprendre ou à approcher l’administration, les élus et les réseaux de décision.','Procédures légales, gouvernement local, politique locale, psychologie'),
'hitman':(4,'Rue','Spécialiste du meurtre sur contrat, indépendant ou lié à une organisation.','Anatomie métahumaine'),
'id manufacturer':(5,'Rue','Fournit des identités de remplacement et connaît les fichiers administratifs et corporatistes.','Bases de données corporatistes, bureaucratie gouvernementale'),
'lawyer':(3,'Universitaire','Apporte défense juridique, négociation et connaissances des réseaux judiciaires.','Droit, étiquette juridique, personnalités judiciaires, rumeurs'),
'lorekeeper':(4,'Magie','Comprend l’histoire, la nature et les applications de la magie et des traditions occultes.','Arcanes, théorie magique, métaplans, savoir mystique, mythologie, occultisme'),
'news reporter':(2,'Médias','Enquête, échange des informations et peut rendre publics des secrets ou des scandales.','Écriture, personnalités de la haute société, rumeurs locales'),
'policlub member':(1,'Rue','Connaît les objectifs, membres et méthodes de son mouvement ou organisation militante.','Objectifs du groupe, connaissance de la région, membres et méthodes'),
'pickpocket':(1,'Rue','Petit délinquant observateur, utile pour les rumeurs de quartier et les activités criminelles discrètes.','Probabilités des jeux, évaluation d’une cible, psychologie, arnaques courantes'),
'safehouse master':(3,'Rue','Trouve un lieu où se cacher et connaît les moyens de rester à l’abri des recherches.','Techniques de dissimulation, forces de l’ordre locales, crime organisé local'),
'sensei':(4,'Magie','Adepte expérimenté qui enseigne le combat et accompagne la progression d’autres adeptes.','Théorie magique, arts martiaux, techniques de méditation, théologie'),
'smuggler':(3,'Ingénierie','Fait franchir frontières et contrôles à des personnes ou marchandises.','Patrouilles frontalières locales, terrain local, techniques d’infiltration, routes de contrebande'),
'soldier':(2,'Gouvernement','Protège une organisation ou un territoire ; le profil peut être spécialisé en combat, rigging, Matrice ou magie.','Procédures militaires, personnalités de son organisation, tactique des petites unités'),
'squatter':(1,'Rue','Observe la vie des rues et connaît les ressources, rumeurs et habitants de son secteur.','Connaissance de la région, milieu de la rue, rumeurs locales, récupération'),
'store owner':(2,'Rue','Fournit des biens ou services et connaît la clientèle et l’actualité de son quartier.','Connaissance de la région, rumeurs locales, grossistes locaux')}

def localize_contact(e):
    key=e['name'].lower();rating,kind,summary,knowledge=CONTACTS[key]
    e['summary']=summary;e['fields']=[{'label':'Influence typique du contact','value':str(rating)},{'label':'Type principal','value':kind}]
    e['sections']['Connaissances']=knowledge
    import re
    mapping={'Armorer':'Armurerie','Dart Pistol':'Pistolet à fléchettes','Dart Rifle':'Fusil à fléchettes','Chemistry':'Chimie','Instruction':'Enseignement','Performance':'Représentation','Acting':'Comédie','Monofilament Whip':'Fouet monofilament','Rifle':'Fusils','Lockpicking':'Crochetage','Palming':'Escamotage','Etiquette':'Étiquette'}
    for en,fr in mapping.items():e['sections']['Compétences']=re.sub(r'\b'+re.escape(en)+r'\b',fr,e['sections']['Compétences'])
    if key=='college professor':e['sections']['Compétences']='Influence 4 (Enseignement +2), Perception 3 ; choisir une compétence au rang 5 parmi Astral, Escroquerie, Biotech, Électronique ou Ingénierie, et lui ajouter une spécialisation.'
    if key=='soldier':e['sections']['Compétences']='Athlétisme 3, Influence 2, Perception 3 ; choisir un ensemble : Combat rapproché 3 et Armes à feu 3 ; Ingénierie 3 et Pilotage 3 ; Piratage 3 et Électronique 3 ; ou Astral 3, Conjuration 3 et Sorcellerie 3.'
    if key=='artificer':e['title']='Créateur d’artefacts magiques'
    return e
