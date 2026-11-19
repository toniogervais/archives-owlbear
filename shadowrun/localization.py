"""French display names; source names remain searchable and inspectable."""
import json
import re
import unicodedata
from pathlib import Path


def norm(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', s).replace('’', "'").strip()).casefold()


NAMES = '''
Mongolian Death Worm|Ver de la mort de Mongolie
young mongolian death worm|Ver de la mort de Mongolie, jeune
behemoth mongolian death worm|Ver de la mort de Mongolie, géant
Terror Bird|Oiseau-terreur
Saber-Toothed Cats|Félins à dents de sabre
Saber Toothed Cats|Félins à dents de sabre
sabre-toothed tiger|Tigre à dents de sabre
sabre-toothed jaguar|Jaguar à dents de sabre
sabre-toothed lion|Lion à dents de sabre
Century Ferret|Furet centenaire
Cetan Hawk|Faucon Cetan
Demon Duck|Canard démoniaque
Hellcow|Vache infernale
Fimbulwinter Fox|Renard de Fimbulwinter
Ground Wolf|Loup des terres
Jackalope|Jackalope
Pegasus|Pégase
Unicorn|Licorne
greater unicorn|Grande licorne
White Bison|Bison blanc
Avalanche Lynx|Lynx des avalanches
Fireworm|Ver de feu
Rockworm Variants|Variantes de vers de roche
Rockworm|Ver de roche
Exoworm|Exover
Sandworm|Ver des sables
Mountain Eater|Dévoreur de montagnes
Glamourworm|Ver de mirage
Redflower’s Cat|Chat de Redflower
Alchaeran Imperial Eagle|Aigle impérial alchaeran
Arcanus Gorilla|Gorille arcanus
Death Leopard|Léopard de la mort
The Griffons|Les griffons
Griffon|Griffon
Asian Griffon|Griffon asiatique
Pain Pines|Pins de douleur
Shadow Yak|Yak des ombres
Tibetan Luck Fox|Renard porte-bonheur tibétain
Thunderbird, Greater|Grand oiseau-tonnerre
Warmth of the Mountains|Chaleur des montagnes
warmth of the world weave|Chaleur de la trame du monde
Wyverns|Vouivres
Wyvern|Vouivre
European Wyvern|Vouivre européenne
African Wyvern-Kongamato|Vouivre africaine, Kongamato
Smoke Wolf|Loup de fumée
Damper Bunny|Lapin inhibiteur
Scavenge Squirrel|Écureuil récupérateur
Black Forest Gargoyle|Gargouille de la Forêt-Noire
Drop Bear|Ours tombant
Horned Bear|Ours cornu
Greater Wolverine|Grand glouton
Merlin Hawk|Faucon merlin
Mimic Snake|Serpent imitateur
Volleying Porcupine|Porc-épic lanceur
Wisp Spider|Araignée follet
King Hydra|Hydre royale
Hell Hog|Sanglier infernal
Ghede Fly|Mouche Ghede
female ghede fly|Mouche Ghede, femelle
male ghede fly|Mouche Ghede, mâle
adult heqet|Heqet adulte
heqet tadpole|Têtard heqet
Skunk Ape|Singe putois
Snap Dragon|Dragon mordeur
yellow pond turtle|Tortue jaune d’étang
Mist Leopard|Léopard des brumes
Blood Monkey|Singe de sang
Amazonian Angel|Ange amazonien
Blink Sloth|Paresseux-éclair
Nartaki Gorilla|Gorille nartaki
Planar Dart Frog|Grenouille des plans
Spider Beast|Bête araignée
Talis Cat|Chat talis
talis cat (cheetah form)|Chat talis, forme de guépard
talis cat (domestic form)|Chat talis, forme domestique
Void Wasp|Guêpe du vide
Conway’s Cheetah|Guépard de Conway
Firelion|Lion de feu
Bullyphant|Éléphant-taureau
Aerial Ostrich|Autruche aérienne
All-Seeing Leopard|Léopard omnivoyant
Apocalypse Rhino|Rhinocéros de l’Apocalypse
Bone Termites|Termites d’os
Earthshaker|Ébranleur de terre
Fireball Ants|Fourmis boules de feu
Great Weaver Bird|Grand oiseau tisserand
Grimm’s Elephant|Éléphant de Grimm
Metaplanar Meerkat|Suricate métaplanaire
Ozian Baboon|Babouin d’Oz
ResonAnts|Fourmis de Résonance
Void Croc|Crocodile du vide
Combat Wombat|Wombat de combat
Stingwing|Aile-dard
Boom Cactus|Cactus explosif
Chimera|Chimère
Deathrattle|Crotale de la mort
Ethereal Centipede|Mille-pattes éthéré
Gila Demon|Démon de Gila
Greater Armadillo|Grand tatou
Greater Dancing White Lady|Grande dame blanche dansante
Nova Scorpion|Scorpion nova
Rock Lizard|Lézard de roche
Ghost Bear|Ours fantôme
Reigndeer|Renne souverain
Sickly Fox|Renard maladif
Antarctic Sculptors|Sculpteurs antarctiques
Icedrake|Drake de glace
Ice Spider|Araignée de glace
Matrix Hare|Lièvre matriciel
Siberian Bee|Abeille de Sibérie
Snow Moose|Élan des neiges
Snow Owl|Harfang des neiges
Snow Snake|Serpent des neiges
Vampire Penguin|Manchot vampire
Wooly Mammoth|Mammouth laineux
Leviathan|Léviathan
Megalodon|Mégalodon
Abrams Lobster|Homard Abrams
Devilfish|Poisson-diable
Devil Jack Diamond|Diable Jack Diamond
Gorging Shark|Requin glouton
Gungir Whale|Baleine Gungir
New Leatherback|Tortue luth nouvelle
Spitting Pike|Brochet cracheur
Storm Dolphin|Dauphin des tempêtes
Torpedo Shark|Requin-torpille
Neogargoyle|Néogargouille
Noise Pigeons|Pigeons brouilleurs
Noise Pigeon|Pigeon brouilleur
Song Dog|Chien chanteur
Awakened Shepherd|Berger Éveillé
Colonist|Colonisateur
colonist (nymph)|Colonisateur, nymphe
colonist (adult)|Colonisateur, adulte
cockroach|Blatte
Copy Cat|Chat copieur
Fearmonger|Semeur de peur
Gargoyles|Gargouilles
African Gargoyle|Gargouille africaine
Asian Gargoyle|Gargouille asiatique
European Gargoyle|Gargouille européenne
North American Gargoyle|Gargouille nord-américaine
Protean|Protéen
Protean (Corrupted)|Protéen corrompu
Protean (toxic)|Protéen toxique
Tooth Fairy|Fée des dents
Trash Chicken|Poule des détritus
lesion beaver|Castor à lésions
trojan rat|Rat de Troie
Incubus (Mature)|Incube mature
Incubus|Incube
Corpselight|Feu cadavérique
Types of Critters|Types de créatures
Mundane|Ordinaires
Augmented|Augmentées
Engineered|Conçues artificiellement
Awakened|Éveillées
Emerged|Émergées
Side Note: Sapience|À propos de la conscience
Other|Autres
Using Critters|Employer des créatures
Food and food production|Nourriture et production alimentaire
Research and Experimentation|Recherche et expérimentation
Specialized tasks|Tâches spécialisées
Running Wild|Runners et vie sauvage
Security Critters|Créatures de sécurité
Critter Security Trainer|Dresseur de créatures de sécurité
Mess with the Food|Agir sur la nourriture
Make the Critters|Faire aux créatures
a Better Offer|une meilleure offre
Live with the Unpredictability|Gérer l’imprévisibilité
Natural Encounters|Rencontres dans la nature
Reagent Hunting|Collecte de réactifs
Wild Interactions|Interactions sauvages
Acquiring a Critter|Acquérir une créature
Training a Critter|Dresser une créature
Keeping a Critter|Entretenir une créature
Running with Critters|Partir en run avec une créature
Room and Board|Nourriture et hébergement
Food|Alimentation
Herbivore/Omnivore|Herbivore ou omnivore
Carnivore|Carnivore
Exotic|Régime exotique
Forage/Hunt|Chercher sa nourriture ou chasser
Starving Critters|Créatures affamées
Housing|Hébergement
Street and Squatter Lifestyle|Vie à la rue ou en squat
Low Lifestyle|Niveau de vie Bas
Medium Lifestyle|Niveau de vie Moyen
High Lifestyle|Niveau de vie Élevé
New Lifestyle Qualities|Nouveaux traits de niveau de vie
Stay-at-Home Critter|Créature à domicile
Separate Location|Hébergement séparé
Locating a Critter|Localiser une créature
Step One: Find the Habitat|Trouver l’habitat
Step Two: Locate the Critter|Repérer la créature
Taming the Wild|Apprivoiser une créature sauvage
critter reaction roll|Réaction d’une créature
critter training test|Test de dressage
Purchasing a Critter|Acheter une créature
Augmented Critters|Créatures augmentées
Complex Orders|Ordres complexes
Comprehension Test|Test de compréhension
Critter Command Actions|Actions des ordres aux créatures
Attack (Lethal or Non-Lethal)|Attaquer, létal ou non létal
Deliver|Livrer
Fetch|Rapporter
Grapple|Immobiliser une cible
Pack Attack|Attaque en meute
Patrol (Attack or Alarm)|Patrouiller, attaquer ou alerter
Protect|Protéger
Retreat|Se replier
Rescue|Secourir
Teamwork (Specify a Skill)|Travail d’équipe, compétence à préciser
Track|Pister
Use Critter Power|Utiliser un pouvoir de créature
Dogpile|Tous sur la cible
Instinctive Connection|Connexion instinctive
Improvised Command|Ordre improvisé
Look Out!|Attention !
Spread the Love|Partager l’effet
Tamed Critter|Créature apprivoisée
Purchased Critter|Créature achetée
Bonded Critter|Créature liée
Clever Critter|Créature futée
Eager to Please|Désireuse de plaire
Exceptional|Exceptionnelle
Low Maintenance|Peu exigeante
Receptive to Training|Réceptive au dressage
Too Cute|Trop mignonne
Vigilant|Vigilante
Wild Soul|Âme sauvage
Negative Qualities|Traits négatifs
Disobedient|Désobéissante
Distrustful|Méfiante
Feral Frenzy|Frénésie sauvage
High Maintenance|Très exigeante
Jealous|Jalouse
Lover, Not a Fighter|Pacifique
Powerless|Privée de pouvoir
Runt|Avorton
Untrainable|Indressable
Critter Gear|Équipement pour créatures
New Statuses|Nouveaux états
Irradiated #|Irradié (indice)
'''

COMPANION='''
Introduction|Introduction
Life’s Too Short|La vie est trop courte
Game Information: Ways to Play Shadowrun|Règles : façons de jouer à Shadowrun
Alternate Power Levels|Niveaux de puissance alternatifs
Alternative Campaigns|Campagnes alternatives
Building Your Runner|Construire son runner
Twenty Questions|Vingt questions
Sum-to-Ten|Création par somme de dix
Sum-to-Ten Character Creation Example One|Somme de dix, premier exemple
Sum-to-Ten Character Creation Example Two|Somme de dix, second exemple
Point Buy|Création par achat de points
Choose your Metatype/Metavariant|Choisir sa métaespèce ou métavariante
Choose Mundane, Awakened, or Emerged|Choisir Ordinaire, Éveillé ou Émergé
Purchase Special/Metatype Adjustment Points with CP|Acheter les points d’ajustement spéciaux
Purchase Attributes with CP|Acheter les attributs
Purchase Skills with CP|Acheter les compétences
Purchasing Resources with CP|Acheter les ressources
Point Buy Example|Exemple d’achat de points
Life Path|Création par parcours de vie
Contacts|Contacts
Knowledge and Language Skills|Connaissances et langues
Adept Powers, Complex Forms, and Spells|Pouvoirs d’adepte, formes complexes et sorts
Starting down the life path|Commencer le parcours de vie
Adult Life Modules|Modules de vie adulte
Choices Life Modules|Modules de choix de vie
Event Life Modules|Modules d’événements
Life Path Example|Exemple de parcours de vie
Complete Character PACKs|PACKs de personnages complets
Weapons PACKs|PACKs d’armes
Armor PACKs|PACKs d’armures
Augmentation PACKs|PACKs d’augmentations
Drone PACKs|PACKs de drones
Rigger Command Console PACKs|PACKs de consoles de commande de rigger
Drone Autosoft PACKs|PACKs d’autosofts de drones
Vehicle Upgrade PACKs|PACKs d’améliorations de véhicules
Breeding True|Héritages métahumains
Cultural Origins of Metavariants|Origines culturelles des métavariantes
Being Counted and Still Ignored|Recensés et pourtant ignorés
Life and Death: Mortality in the Sixth World|Vie et mort dans le Sixième Monde
Dwarf|Nains
Elven|Elfes
Ork|Orks
Troll|Trolls
Metasapients: They Think Therefore They Are|Métaconscients : ils pensent, donc ils existent
Creating a Metavariant or Metasapient Player Character|Créer un PJ métavariant ou métaconscient
Special modifications|Modifications spéciales
What It Is, What It Wants|L’Infection et ses besoins
Strain I, Harz-Greenbaum|Souche I, Harz-Greenbaum
Strain Ia: Bruckner-Langer|Souche Ia, Bruckner-Langer
Strain II, Jarka-Criscione|Souche II, Jarka-Criscione
Type III, Krieger|Souche III, Krieger
Game Information|Informations de jeu
Infected Characters|Personnages Infectés
Magic and Resonance when Infected|Magie et Résonance après l’Infection
Essence Drain Addiction|Dépendance au Drain d’Essence
Diseases|Maladies
Infected Diseases|Maladies de l’Infection
Infected Metatype Attributes|Attributs des métaespèces Infectées
Positive Infected Qualities|Traits positifs d’Infectés
Negative Infected Qualities|Traits négatifs d’Infectés
New Critter Powers|Nouveaux pouvoirs de créatures
Changelings from Metagenics|Changelins et métagénétique
What Grows Back, What Doesn’t|Ce qui repousse et ce qui ne repousse pas
Changelings, SURGE, and Social Injustice|Changelins, SURGE et injustice sociale
Collectives|Collectifs
Metagenic Qualities|Traits métagénétiques
Random Selection|Sélection aléatoire
Positive Metagenic Qualities|Traits métagénétiques positifs
Metagenic Senses|Sens métagénétiques
Metagenic Morphisms|Morphismes métagénétiques
Negative Metagenic Qualities|Traits métagénétiques négatifs
Positive Qualities|Traits positifs
Augmentation Acclimation|Accoutumance aux augmentations
Bravado|Bravade
Critter Dominator|Dominateur de créatures
Critter Trainer|Dresseur de créatures
Cyberjack Maximization|Optimisation du cyberjack
Cyborg|Cyborg
Discreet Smuggler|Contrebandier discret
Extended Overdrive|Surrégime prolongé
Focused Ambition|Ambition ciblée
Inspire Competence|Inspirer la compétence
Many Talents|Talents multiples
Many Skills|Compétences multiples
Martial Arts Prodigy|Prodige des arts martiaux
Maximum Overdrive|Surrégime maximal
More Machine than Metahuman|Plus machine que métahumain
Muscles|Muscles
Polyglot|Polyglotte
Relentless Tracker|Pisteur implacable
Rote Alchemist|Alchimiste routinier
Software Optimization|Optimisation logicielle
Soothing Static|Parasites apaisants
Spell Components|Composantes de sort
Team Player|Esprit d’équipe
Teflon Coated|Rien ne colle
All Business|Tout pour les affaires
Bad Back|Dos fragile
Borrowed Time|Temps emprunté
Bounty|Prime sur la tête
Chronic Pain|Douleur chronique
Combat Junkie|Accro au combat
Cyber Psychosis|Cyberpsychose
Finesse|Délicatesse
Gear Acquisition Syndrome|Syndrome d’acquisition de matériel
Glitchy|Sujet aux complications
Gourmand|Gourmand
Hooder|Robin des Ombres
Hunted|Traqué
Indecisive|Indécis
Injury Prone|Sujet aux blessures
Killer|Tueur
Limited Attributes|Attributs limités
Limited Skills|Compétences limitées
Momentous Misfortune|Malchance spectaculaire
Non-Lethal|Non létal
Stim Patch Allergy|Allergie aux stimpatchs
Toxin Susceptibility (specify toxin)|Sensibilité à une toxine, à préciser
Trust Issues|Difficulté à faire confiance
Twitchy|Nerveux
Quality Paths|Parcours de traits
Quality Path: Critter Bond|Parcours de traits : lien avec une créature
Quality Path: Obsession|Parcours de traits : obsession
Quality Path: Favored Weapon|Parcours de traits : arme de prédilection
Quality Path: Vendetta|Parcours de traits : vendetta
Quality Path: SINner’s path|Parcours de traits : détenteur de SIN
Expanded Edge Gains|Gains d’Atout étendus
Faster Edge Resets|Récupération d’Atout accélérée
Higher Edge Gains|Gains d’Atout augmentés
Edge Banking|Mise en réserve de l’Atout
Stacking Advantage|Avantages cumulatifs
Rebalanced Edge Qualities|Traits d’Atout rééquilibrés
New Ways To Use Edge|Autres usages de l’Atout
Edge As Dice Pool Modifications|Atout et modificateurs de réserve
Streamlined Edge|Atout simplifié
New Optional Edge Actions|Nouvelles actions d’Atout optionnelles
New Healing Options|Nouvelles options de soins
First Aid for the Augmented|Premiers soins aux augmentés
Bioware Heals Naturally|Guérison naturelle du bioware
Increased Overflow Lethality|Surplus de dommages plus meurtrier
Bleeding|Saignement
Lifestyle and Healing|Niveau de vie et guérison
Magicians & Mundanes|Magiciens et Ordinaires
Transhumanism|Transhumanisme
Burning Out|Perdre définitivement sa magie
Latent Awakening|Éveil latent
Magic Can’t Affect Free Will|La magie ne peut affecter le libre arbitre
These Aren’t the Drones You’re Looking For|Ces drones ne sont pas ceux que vous cherchez
Spirit Doorways|Passages pour les esprits
Faster Alchemical Preparation Time|Préparations alchimiques accélérées
Alternate Mystic Adept|Variante de l’adepte mystique
Enhanced Aspected Magicians|Magiciens spécialisés améliorés
More Survivable Blasts|Explosions moins meurtrières
Cover Shields Blasts|Le couvert protège des explosions
Alternate Avoid Incoming Action|Variante de l’action d’évitement d’une explosion
New Gear Options|Nouvelles options d’équipement
Improved APDS|Munitions APDS améliorées
More Lethal Anti-Vehicular Rockets and Missiles|Roquettes et missiles antivéhicules plus meurtriers
Assault Cannon Blasts|Explosions des canons d’assaut
Suprathyroid Bonuses Stack|Cumul des bonus du suprathyroïdien
New Armor Options|Nouvelles options d’armure
Armor Lessens Physical Damage|L’armure réduit les dommages physiques
Absorb The Blow ([A] Minor Action)|Encaisser le coup, action mineure
Expanded Roles for Strength|Usages étendus de la Force
Rolling Strength Instead of Agility In Close Combat|Force à la place d’Agilité en Combat rapproché
High Strength Adds to Damage|Force élevée et dommages
High Strength Reduces Recoil|Force élevée et recul
Expanded Combat Options|Options de combat étendues
Overwatch Actions|Actions de couverture
Dual Wielding|Combat à deux armes
Up To Six Minor Actions|Jusqu’à six actions mineures
You Can’t Dodge Bullets|On n’esquive pas les balles
Matrix and Rigging|Matrice et rigging
Alternate Noise|Bruit alternatif
Less Punitive Speed Interval Penalties|Malus d’intervalles de vitesse réduits
Playing the Game|Jouer la partie
Practice Makes Perfect|C’est en pratiquant qu’on apprend
Unrestricted Skill Ranks|Rangs de compétences sans restriction
Expanded Specializations|Spécialisations étendues
Twitchy Wires|Câblage nerveux
Working for the Man/People/Organleggers|Travailler pour les corpos, les gens ou les trafiquants d’organes
Drug Addictions|Dépendances aux drogues
Expanded Sins and Licenses|SIN et licences détaillés
Alternate SIN Qualities|Traits SIN alternatifs
Not Available Here|Indisponible ici
Soirees And Socialites|Soirées et mondanités
Opposed Social Skills|Compétences sociales opposées
Point And Counterpoint|Argument et contre-argument
The Social Condition (Monitor)|Moniteur d’état social
Social Maneuvers|Manœuvres sociales
Build Your Own Qualities|Créer ses propres traits
Wild Die Extra Actions|Actions supplémentaires du dé libre
Reckless Tactics|Tactiques téméraires
Spell Adjustments|Ajustements de sorts
Untrained Skill Tests|Tests de compétences sans entraînement
Contact Types|Types de contacts
Using Types|Utiliser les types de contacts
Connection Rating and Contact Archetypes|Influence et archétypes de contacts
Contacts: Expanded Information|Informations détaillées sur les contacts
Bartender|Barman
Beat Cop|Patrouilleur de police
Fixer|Fixer
Mafia Consigliere|Consigliere de la mafia
Mechanic|Mécanicien
Mr. Johnson|M. Johnson
Street Doc|Toubib des rues
Talismonger|Talismanier
New Contacts|Nouveaux contacts
Armorer|Armurier
Arms Dealer|Marchand d’armes
Artificer|Artificier
Bounty Hunter|Chasseur de primes
Chemist|Chimiste
City Worker|Employé municipal
Cleaner|Nettoyeur
College Professor|Professeur d’université
Corporate Wageslave|Salarié corporatiste
Deckmeister|Spécialiste des decks
Entertainer|Artiste
Ganger|Ganger
Government Official|Fonctionnaire
Hitman|Tueur à gages
ID Manufacturer|Fabricant d’identités
Lawyer|Avocat
Lorekeeper|Gardien du savoir
News Reporter|Journaliste
Pickpocket|Pickpocket
Policlub Member|Membre de policlub
Safehouse Master|Gestionnaire de planque
Sensei|Sensei
Smuggler|Contrebandier
Soldier|Soldat
Squatter|Squatteur
Store Owner|Commerçant
Earning and Spending Favors|Obtenir et dépenser des faveurs
Group Contacts|Contacts de groupe
The Pieces Of Your Life(style)|Les composantes du niveau de vie
Neighborhood|Quartier
Necessities|Nécessités
Comforts|Confort
Security|Sécurité
Entertainment|Loisirs
Space|Espace
Lifestyle Qualities|Traits de niveau de vie
Running Heat with Multiple Factions|Pression et factions multiples
Factions and Reputation|Factions et réputation
Gear, Heat, and Rep|Matériel, pression et réputation
Fencing Gear|Revente de matériel
Buying Gear|Acheter du matériel
Greasing the Wheels|Huiler les rouages
Gangs, Corporate, Military, or Secret Societies Campaigns|Campagnes de gangs, corpos, militaires ou sociétés secrètes
Table Index|Index des tableaux
'''

TITLE_MAP={norm(a):b for text in (NAMES,COMPANION) for line in text.splitlines() if '|' in line for a,b in [line.split('|',1)]}
EXTRA='''
Aardwolf|Protèle
Putting the “Wild” in Wilderness|Le sauvage au cœur de la nature
How to Win Pets and Influence Critters|Se faire des compagnons et influencer les créatures
Interacting with Critters|Interagir avec les créatures
New Influence Skill Specialization/Expertise: Critters|Influence : spécialisation et expertise Créatures
Please Don’t Eat Me|Ne me mangez pas !
Critter Housing: Separate Location|Créatures : hébergement séparé
Critter Taming and Training|Apprivoisement et dressage
critter location test|Test de localisation d’une créature
Step Three: Appease or Capture the Critter|Apaiser ou capturer la créature
Purchasing Augmented Critters|Acheter des créatures augmentées
Critter Commands|Ordres aux créatures
Critter Special Training|Entraînements spéciaux des créatures
Paid Training Services|Services de dressage payants
Critter Companion Qualities|Traits des compagnons animaux
Blindness|Cécité
Euphoria|Euphorie
Shadowrunner Starter PACK|PACK de départ du shadowrunner
Dirt Poor|Sans le sou
Full Magician|Magicien complet
Face|Face
Gunslinger Adept|Adepte pistolero
Cybered Covert Operative|Agent clandestin cybernétisé
Full Conversion Cyborg|Cyborg à conversion complète
Street Samurai|Samouraï des rues
Vat Job Bioware-Augmented Combat Specialist|Spécialiste du combat augmenté par bioware
Max Hardware Decker|Decker à équipement maximal
Transport Rigger|Rigger de transport
Drone Rigger|Rigger de drones
Crossbows|Arbalètes
Tasers|Tasers
Hold-out Pistols|Pistolets de poche
Light Pistols|Pistolets légers
Machine Pistols|Pistolets automatiques
Heavy Pistols|Pistolets lourds
Shotguns|Shotguns
Submachine Guns|Mitraillettes
Rifles|Fusils
Machine Guns|Mitrailleuses
Launchers|Lanceurs
Sensor PACKs|PACKs de senseurs
Identity PACKs|PACKs d’identités
Surveillance Kit PACK|PACK de surveillance
Cyberprogram Everything PACK|PACK de cyberprogrammes complet
Hacker PACK|PACK de hacker
Cybereyes PACK|PACK de cyberyeux
Cyberears PACK|PACK de cyberoreilles
Skill Rig PACK|PACK de compétences câblées
Skill Rig|Compétences câblées
All in the Reflexes|Tout dans les réflexes
Thick Skull|Crâne épais
Chrome Dome|Crâne de chrome
Cyborg Torso|Torse de cyborg
Cyberarm: Excellence|Cyberbras : excellence
Cyberarm: Secret Handshake|Cyberbras : poignée de main secrète
Cyberarm: Assassin|Cyberbras : assassin
Cyberarm: Firearm|Cyberbras : arme à feu
Cyberarm: Heavily Armed|Cyberbras : lourdement armé
Cyberleg: Hollow Boot|Cyberjambe : botte creuse
Springheel Jack|Jack aux talons à ressort
Springheel Juggernaut|Juggernaut aux talons à ressort
Bikes|Motos
Cars|Voitures
Boats|Bateaux
Submarines|Sous-marins
Small Drones|Petits drones
Medium Drones|Drones moyens
Armed Small Wheeled Drone PACK|PACK de petit drone à roues armé
Armed Small Walker Drone PACK|PACK de petit drone marcheur armé
Armed Small Rotor Drone PACK|PACK de petit drone à rotors armé
Stealthy Medium Wheeled Drone PACK|PACK de drone moyen à roues discret
Loud Medium Wheeled Drone PACK|PACK de drone moyen à roues bruyant
Light Anthro Drone PACK|PACK de drone anthropomorphe léger
Heavy Anthro Drone PACK|PACK de drone anthropomorphe lourd
Assault Roto-Drone PACK|PACK de rotodrone d’assaut
Rocket Launcher Roto-Drone PACK|PACK de rotodrone lance-roquettes
Grenade Barrage Roto-Drone PACK|PACK de rotodrone à barrage de grenades
Airstrike Drone PACK|PACK de drone d’attaque aérienne
Ultimate Combat Drone PACK|PACK de drone de combat ultime
Budget Heavy Combat Drone PACK|PACK de drone de combat lourd économique
Crowd Control Steel Lynx PACK|PACK de Steel Lynx de contrôle de foule
Sky Patrol Dalmatian PACK|PACK de Dalmatian de patrouille aérienne
Elite Airstrike Drone PACK|PACK de drone d’attaque aérienne d’élite
Backup RCC PACK|PACK de CCR de secours
Basic RCC PACK|PACK de CCR de base
Professional RCC PACK|PACK de CCR professionnelle
Elite RCC PACK|PACK de CCR d’élite
Recon Autosofts|Autosofts de reconnaissance
Sniper Autosofts|Autosofts de tireur d’élite
Dirty Tricks Vehicle PACK|PACK de véhicule à coups tordus
Gun Ports Vehicle PACK|PACK de véhicule à meurtrières
Rigger’s Baby|Le bébé du rigger
Combat Biker|Motard de combat
Fire Support Roto-Drone PACK|PACK de rotodrone d’appui-feu
Neogargoyle (dog)|Néogargouille, chien
Neogargoyle (bat)|Néogargouille, chauve-souris
Neogargoyle (cat)|Néogargouille, chat
Neogargoyle (squirrel)|Néogargouille, écureuil
traptor (toxic)|Traptor toxique
troglodyte brute|Troglodyte, brute
troglodyte leader|Troglodyte, chef
Emerged Wyvern|Vouivre Émergée
Asian Wyvern-Nine-Tailed Fox|Vouivre asiatique, renard à neuf queues
Arctic Wyvern-Isitoq|Vouivre arctique, Isitoq
Lo Shu Turtle|Tortue Lo Shu
'''
TITLE_MAP.update({norm(a):b for line in EXTRA.splitlines() if '|' in line for a,b in [line.split('|',1)]})

NOTES_FR={norm(a):b for line in '''
terror bird|Hors combat, l’oiseau-terreur emploie Souillure. La dernière phrase de la note est tronquée dans le PDF fourni.
Fimbulwinter Fox|Les pouvoirs d’air du renard de Fimbulwinter abaissent la température de la zone et produisent un refroidissement.
Gashadokuro|Son Essence varie ; cette valeur modifie notamment son immunité aux armes normales.
pegasus|Déplacement au sol : 10/25/+3.
peryton|Déplacement au sol : 10/25/+3.
pixiu|Déplacement au sol : 10/20/+3.
white bison|Pour le piétinement, un troupeau de bisons utilise les règles des groupes de figurants.
Volleying Porcupine|Les piquants sont barbelés ; les arracher inflige 2P.
corpselight|Pour la Matérialisation, sa Puissance est égale à son Essence actuelle.
adult heqet|Son maximum naturel de Magie est de 3.
titanoboa|Ne mord que s’il est effrayé. Il tente d’abord de saisir sa cible puis de la comprimer pour lui infliger des dommages ; il commence à la dévorer après l’avoir rendue inconsciente.
arang-utan|Peut créer sans Drain des préparations de tout sort de Combat, d’Illusion ou de Manipulation.
blink sloth|Il est habituellement lent : le Déplacement indiqué s’applique uniquement lorsqu’il attaque.
Nartaki Gorilla|Ne divise pas sa réserve lorsqu’il effectue plusieurs attaques de mêlée.
talis cat (cheetah form)|Le chat talis possède deux formes : guépard et chat domestique.
talis cat (domestic form)|Le chat talis possède deux formes : guépard et chat domestique.
Neogargoyle (squirrel)|Les exemples correspondent à cinq mois d’infection. L’Armure augmente de 1 par mois depuis le début de la mutation ; à douze mois, Armure 12 mais mobilité presque nulle.
noise pigeon|Créature Émergée qui brouille naturellement les signaux. Fonctionne comme un brouilleur d’indice 1, augmenté de 1 par pigeon dans la volée, maximum 25. Les personnes qui nourrissent un pigeon brouilleur cessent immédiatement d’être brouillées.
song dog|Sa fourrure fonctionne biologiquement comme une chevelure électrochrome et il la contrôle comme un vêtement électrochrome.
awakened shepherd|Toute personne tentant de remarquer un berger Éveillé en alerte reçoit un point d’Atout de situation.
colonist (adult)|Dans une construction de blattes, le colonisateur reçoit Armure renforcée 2.
copy cat|Selon la taille de la colonie, le MJ peut augmenter la Logique de chaque chat de 1.
fearmonger|Ses piquants de tête et de dos dépassent généralement trente centimètres. Ils ajoutent +2 SD en Combat rapproché. Saisir ou maîtriser un semeur de peur impose aussi de résister à 2P. Les piquants portent un fluide corporel : voir Porteuse saine, VVHMH-II.
Asian Gargoyle|Venin : Injection ; rapidité un round ; Puissance 4 ; effets Désorienté et Empoisonné 4P.
grot|Peut utiliser gratuitement l’action d’Atout Faire le mort et reçoit deux points d’Atout de situation.
Incubus|L’Atout ne peut pas être utilisé sur les tests opposés contre Reflet du désir.
Incubus (Mature)|L’Atout ne peut pas être utilisé sur les tests opposés contre Reflet du désir.
tanuki|À chaque test de défense, gagne deux points d’Atout de situation qui doivent être dépensés sur ce jet.
Protean (toxic)|Le MJ peut représenter des spécimens plus grands en ajoutant de +1 à +10 à CON et FOR. Un protéen immobile impose un seuil de Perception de 6 pour être remarqué.
traptor (Toxic)|Pendant sa chasse, détecte tout être passant à moins de dix mètres du terrier qui rate Furtivité + AGI (3), sans forcément l’attaquer. Ses piquants ajoutent +2 SD en Combat rapproché ; le saisir ou le maîtriser impose de résister à 2P.
'''.splitlines() if '|' in line for a,b in [line.split('|',1)]}

SECTION_OVERRIDES={
 'pixiu':{'Faiblesse':'Restriction alimentaire : doit comprendre des traces d’or, d’argent ou de pierres précieuses.'},
 'exoworm':{'Armes':'Morsure [Combat rapproché, VD 6P (Feu), 10/—/—/—/—].','Notes':'La Richesse se forme dans ses tunnels : lancer Magie + Atout ; chaque succès vaut 1 ¥ par mètre de tunnel. Extraire cette richesse demande Ingénierie + Logique (4, 1 heure) pour chaque tranche de dix mètres.'},
 'king hydra':{'Armes':'Crachat corrosif [Magie + Agilité, VD 7P (Chimique), 14/12/6/4/—]. Morsure [Combat rapproché, VD 2P, 18/—/—/—/—].','Notes':'Gagne une action mineure supplémentaire par tête. Si une morsure inflige des dommages, elle impose Désorienté et Empoisonné 7P. Venin : Injection, rapidité 1, Puissance 7.'},
 'devilfish':{'Armes':'Percussion [Combat rapproché, VD 9P, 12/—/—/—/—]. Mains nues [Combat rapproché, VD 3E, 13/—/—/—/—].','Notes':'La Percussion s’utilise lorsque le poisson-diable retombe sur un être dans l’eau ; elle impose aussi Désorienté pendant deux rounds.'},
 'spitting pike':{'Armes':'Crachat corrosif [Armes exotiques, VD 6P, 12/10/4/—/—]. Morsure [Combat rapproché, VD 1P plus venin, 6/—/—/—/—].','Notes':'Pour chaque mètre de longueur au-delà du premier, ajouter +1 CON et +1 FOR, jusqu’à 7, ainsi que +1 VD et +1 SO à la morsure. En crachant, vise les yeux si possible : utilise gratuitement l’attaque aveuglante de Feu nourri.'},
 'song dog':{'Armes':'Morsure/griffes [Combat rapproché, VD 1P, 6/—/—/—/—]. Morsure numérique [Cybercombat, VD 3, 9/—/—/—/—]. Déflagration de basses [Cybercombat, VD 1, 9/—/—/—/—] : donne le trait négatif Vertige en RA pendant 1D6 heures ; les attaques suivantes prolongent d’une heure chacune.'},
 'trash chicken':{'Armes':'Bec [Combat rapproché, VD 1P, 3/—/—/—/—]. Bec numérique [Cybercombat, VD 2, 9/—/—/—/—]. Coup de bec numérique [Cybercombat, VD 0, 9/—/—/—/—] : les succès nets diminuent le Firewall.'},
 'vampire penguin':{'Armes':'Morsure [Combat rapproché, VD 1P, 5/—/—/—/—] : une attaque réussie impose Saignement.'}
}
TERMS=json.loads((Path(__file__).parent/'data/terminology.json').read_text())['terms']
TERM_MAP={norm(k):v for k,v in TERMS.items()}
RE=re.compile(r'(?<!\w)('+ '|'.join(re.escape(k) for k in sorted(TERMS,key=len,reverse=True))+r')(?!\w)',re.I)


def terms(s):
    s=unicodedata.normalize('NFKC',s)
    for a,b in [('Infl uence','Influence'),('infl uence','influence'),('magnifi cation','magnification'),('Eff ect','Effect'),('Camoufl age','Camouflage'),('Refl ection','Reflection'),('Petrifi cation','Petrification'),('LowLight','Low-Light')]:s=s.replace(a,b)
    s=RE.sub(lambda m:TERM_MAP[norm(m.group())],s)
    s=s.replace('must Run, successful Attaque causes Mise à terre','nécessite de courir ; une attaque réussie met À terre').replace('must Run, successful Attaque causes À terre status','nécessite de courir ; une attaque réussie impose À terre').replace('successful Attaque causes À terre status','une attaque réussie impose À terre')
    s=re.sub(r'(?<!\w)DV(?!\w)','VD',s)
    s=re.sub(r'(?<!\w)AR(?!\w)','SO',s)
    s=re.sub(r'(?<!\w)DR(?!\w)','SD',s)
    # Stun damage is E in French. Never replace the Strength header S here.
    s=re.sub(r'(\d+|\))S\b',r'\1E',s)
    return s


def title(s):
    n=norm(s)
    if n in TITLE_MAP:return TITLE_MAP[n]
    if n in TERM_MAP:return TERM_MAP[n]
    if n.endswith(' pack'):
        base=s[:-5]
        translated=title(base)
        if translated!=base:return translated+' · PACK'
    m=re.fullmatch(r'(.+ PACK) ([A-F])',s)
    if m and norm(m[1]) in TITLE_MAP:return TITLE_MAP[norm(m[1])]+' '+m[2]
    if s.startswith('Armed '):return 'PACK armé : '+s[6:].removesuffix(' PACK')
    for prefix in ('critter corner: ',):
        if n.startswith(prefix):return 'Coin des créatures : '+title(s[len(prefix):])
    # Proper species names keep their spelling. Latin taxonomy is preserved.
    m=re.match(r'(.+?)\s*\(([^)]+)\)$',s)
    if m and norm(m[1]) in TITLE_MAP:return TITLE_MAP[norm(m[1])]+' ('+m[2]+')'
    return terms(s)
