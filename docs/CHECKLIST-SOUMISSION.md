# Checklist de soumission

**Deadline : dimanche 15 novembre 2026, 18h PT = lundi 16 novembre, 3h00 heure de Paris.**
Objectif interne : soumettre avant **01h00** dans la nuit de dimanche à lundi — 6 h de marge.
Les soumissions en retard ne sont pas acceptées.

## Critères d'acceptation du produit (§25 du cahier des charges)

- [x] Le repo est public : <https://github.com/BaptisteFaisy/rature>
- [x] L'URL publique fonctionne en HTTPS : <https://baptistefaisy.github.io/rature/>
- [x] Le README explique le pipeline, les décisions et les échecs
- [x] Une copie **sans erreur** retourne « aucune erreur détectée » (test RNF-04 : 0 appel, 0 faute)
- [x] Le profil d'erreur s'affiche après 2 analyses successives (IndexedDB local)
- [x] Un exercice ciblé passe le garde-fou de pertinence (2 tentatives max, sinon message honnête)
- [x] Le nom de l'élève est masqué à l'affichage (pixelisation du bandeau, étape 2)
- [x] Aucune image n'est conservée après analyse (data URL en mémoire de session uniquement)
- [x] Les outils IA sont déclarés ([`DECLARATION-IA.md`](DECLARATION-IA.md))
- [x] Le parcours complet est démontrable **hors ligne** (mode démo : réponses du modèle
      enregistrées, bouton sur l'accueil) — vérifié sur la démo publique
- [x] Le parcours complet fonctionne **sur la démo publique, sans clé côté navigateur** :
      photo → proxy Modal → InferHub → 3 fautes typées (E06, E07, E99) → exercice validé par le
      garde-fou → profil mis à jour. Mesuré le 11 novembre à 22 h 27 sur une copie **dégradée**
      (rotation, lumière inégale, bruit) : dominant conforme, ~40 s, 6 appels sur 8 en 503 absorbés
      par la chaîne de repli. Détails : [`VALIDATION-MODELE.md`](VALIDATION-MODELE.md)
- [ ] Une **vraie** copie corrigée photographiée produit un diagnostic typé correct en < 20 s
      → reste à mesurer sur 5 copies réelles + 2 copies propres (protocole :
      [`../corpus/README.md`](../corpus/README.md)). Le seuil des 20 s dépend de l'amont :
      16 s quand un fournisseur rapide est disponible, 40-90 s quand la chaîne doit rejouer
- [ ] La vidéo ≤ 3 min est en ligne, publique, et se lance en navigation privée
- [ ] La soumission est déposée sur Devpost avant le 15 nov 18h PT

## Éléments Devpost, tous obligatoires (§26)

- [ ] **Vidéo démo** : lien public YouTube/Vimeo, ≤ 3 min, montrant le produit **en fonctionnement**
- [ ] **Write-up** : [`WRITEUP.md`](WRITEUP.md) (problème, thèse, construction, décisions, échecs,
      apprentissages, suite, outils IA)
- [ ] **Code et lien live** : repo public **et** URL de démo — faire les deux, c'est un critère du
      track Deployed
- [ ] **Built with** : TypeScript, React, Vite, Tailwind CSS, IndexedDB (idb-keyval), Zod, Vitest,
      InferHub (API [OI]-compatible multimodale), proxy edge (fonction Vercel / Cloudflare Worker),
      GitHub Pages, GitHub Actions + runners self-hosted, Mergify
- [ ] **Tracks** : Best AI Hack, Best Deployed / Shipped App, Best Design & UX, Overall
- [ ] **Équipe** : 1 à 4 membres, tous inscrits à IceHacks, une seule équipe par personne

## Conformité — non négociable (§12)

- [x] **Une seule soumission** (pas de second projet)
- [x] **Code 100 % neuf** : dépôt initialisé pendant la période du hackathon, premier commit daté du
      11 novembre 2026, aucun fichier issu d'un projet antérieur
- [x] **Outils IA déclarés**
- [ ] **Éligibilité vérifiée** (statut lycéen/étudiant, 13+) — à confirmer auprès de
      l'organisateur **avant** d'investir davantage ; en cas de doute, poser la question sur la page
      Devpost ou le Discord IceHacks

## Reste à faire, dans l'ordre

1. Validation sur 5 vraies copies + 2 copies propres (go / no-go du jour 1)
2. Déploiement du proxy edge avec la clé serveur (Vercel ou Cloudflare Worker) — sinon la démo
   publique tourne en BYOK / corpus
3. Tournage de la vidéo (jour 3, jamais le dernier jour)
4. Relecture du write-up et du README par quelqu'un qui ne connaît pas le projet
5. Soumission Devpost, puis vérification du lien vidéo en navigation privée
