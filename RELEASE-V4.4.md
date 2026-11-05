# Les Archives de l'Imaginaire — retour direct V4.4 (Edge)

## Pourquoi un complément Edge ?

Le bouton de droite dans Owlbear est un outil d'extension exécuté dans une iframe. L'API Owlbear fournit un événement `onClick` mais pas de commande pour activer un onglet du navigateur externe. Nos versions V4.1–V4.3 ont montré que `window.open` depuis le fond Owlbear était bloqué et que le panneau imposait deux clics.

**La V4.4 conserve l'extension Owlbear mais lui associe un petit module Edge local.** Le clic sur le grimoire envoie un message sans données sensibles à la page Owlbear. Le module Edge le reçoit, retrouve l'onglet Les Archives existant et le réactive avec l'API officielle `chrome.tabs.update` puis `chrome.windows.update`.

## Installation une seule fois (ordinateur Windows + Edge)

1. Télécharger `Archives_Bascule_Edge_V1.zip` depuis la réponse ChatGPT et l'extraire dans un dossier fixe, **sans effacer ensuite ce dossier**.
2. Dans Edge, aller à `edge://extensions`, activer **Mode développeur**, puis **Charger l'extension décompressée**. Sélectionner le dossier `Archives_Bascule_Edge_V1` qui contient `manifest.json`. La confirmation doit indiquer `Archives - Bascule Edge`.
3. Dans Owlbear, remplacer l'extension V4.3.2 par le manifeste `https://toniogervais.github.io/archives-owlbear/manifest-archives-44.json`.
4. Actualiser une fois l'onglet Owlbear. Garder l'onglet Les Archives V4.1 ouvert (`archives-app-v53-v41.html`).
5. Dans Owlbear, cliquer **une seule fois** sur le grimoire situé à droite. Si le module Edge répond, Les Archives sont activées sans rechargement. Sinon, le petit panneau « Retour aux Archives » s'ouvre en secours après ~1,7 seconde.

## Respect de la confidentialité et sécurité

- Le module Edge ne lit pas les données d'une campagne, ni les secrets, ni les images.
- Le message ne contient qu'un type et un identifiant de requête aléatoire, jamais d'adresse de salle, de jeton ni de mot de passe.
- Le script Edge n'écoute que dans les pages Owlbear et n'accepte que les messages de l'origine `https://toniogervais.github.io` en provenance d'une iframe.
- Le fond Edge vérifie que la demande provient d'un onglet réellement sur Owlbear avant de naviguer.
- L'autorisation d'accès aux informations des onglets est limitée à l'origine GitHub Pages des Archives. Pas d'autorisation générale `tabs` nécessaire.
- En cas d'onglet Archives fermé, le module ouvre la page de reprise `?resume=1` ; dans ce cas seulement, un nouveau chargement est inévitable.
- Ni les campagnes, ni Supabase, ni le Salon Live ne sont modifiés. Les invitations MJ de la V4.3 sont conservées.
- Les modules en mode développeur peuvent produire un avertissement Edge de sécurité ; la fonctionnalité peut être désactivée ou supprimée à tout moment.
- Les joueurs sur Android ne sont pas concernés par cette installation. Ils continuent à recevoir des invitations via Les Archives et Owlbear.
- La bascule en un clic est une **implémentation à tester dans Edge**, non un fonctionnement encore confirmé avec une salle Owlbear réelle.

## Note d'essai

La V4.4 ne modifie pas les Archives V4.1, son écran titre, son canevas ni les fonctionnalités du Salon Live. Le changement concerne exclusivement l'extension Owlbear, et le module complémentaire installé volontairement sur Edge.
