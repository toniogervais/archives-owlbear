# Sécurité V4.7 — Correction de fuite de secrets dans le Salon Live

## Constat confirmé dans le code des versions antérieures

La synchronisation utilisait le même objet pour les sauvegardes complètes du MJ et pour les transmissions au navigateur des joueurs. Les éléments secrets étaient envoyés puis seulement masqués à l'écran. Cette approche ne protège pas les informations privées.

## Modifications

- La sauvegarde du MJ reste intégrale dans son navigateur et garde sa clé de stockage historique.
- Un objet distinct, restrictif, est créé **avant toute émission** WebRTC (PeerJS) et BroadcastChannel : seules les cellules ayant `revealed === true`, les liens révélés entre cellules visibles, et les indices explicitement révélés passent.
- Les titres privés d'actes, les médias/journaux du MJ, les cellules et indices cachés sont exclus des messages aux joueurs.
- Les autres onglets MJ ignorent les messages réservés aux joueurs pour ne pas écraser leur scénario complet.
- La vision joueur ne recharge plus depuis `localStorage` la sauvegarde du MJ présente sur le même profil navigateur.
- Les codes Salon Live de quatre chiffres sont remplacés par une chaîne aléatoire de 12 caractères, moins facile à deviner.
- Les exports HTML autonomes des joueurs sont **temporairement désactivés** : ils embarquaient l'état complet. L'export progression joueur utilise désormais la projection de sécurité.

## Attention / limitations

- Cela ne révoque pas des informations déjà transmises par une ancienne version. Il faut fermer les anciens salons et utiliser la V4.7 avec un **nouveau code**.
- Les sauvegardes locales du MJ restent accessibles depuis tout onglet partageant le même domaine et profil de navigateur. Ne jamais confier son navigateur/profil MJ à un joueur : utiliser des profils séparés.
- La protection RLS de Supabase n'est pas certifiée ici. Le projet réel doit être contrôlé via `sql/security-audit-readonly-v47.sql` ; ne jamais transmettre clés, cookies, JWT ou mot de passe dans un rapport.
- Le bucket de révélation d'images est public par conception. Les secrets non révélés doivent être conservés ailleurs que dans ce bucket.
- Le code GitHub Pages est public. Ne pas y placer de fichiers de campagne, de clés `service_role` ni de sauvegardes privées.
- Les tests automatiques prouvent la suppression des secrets d'exemples du payload, pas l'absence de tous les risques du web, du navigateur, de PeerJS et de Supabase.
- Les Archives V4.6, ses modules et l'extension Owlbear restent inchangés ; V4.7 crée uniquement une nouvelle application et des fichiers d'audit.

## Version à utiliser

`archives-app-v56-v47.html`. Conserver dans Owlbear la dernière extension `manifest-v46.json` (version 4.6.1).

Pour les campagnes sensibles, éviter les anciennes versions du Salon Live, même si elles sont encore accessibles via leurs anciennes URL.
