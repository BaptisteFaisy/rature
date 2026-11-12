# Raturé 🖊️

> Tu photographies ta copie corrigée. Elle trouve l'erreur que tu répètes — et te fabrique
> l'exercice exactement dessus.

[![Démo publique](https://img.shields.io/badge/démo-publique-f5c518?style=flat-square)](https://tradoooo.github.io/rature/)
[![CI](https://img.shields.io/github/actions/workflow/status/Tradoooo/rature/ci.yml?branch=main&label=ci&style=flat-square)](https://github.com/Tradoooo/rature/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-171%20verts-3ecf8e?style=flat-square)](tests)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-9aa3b2?style=flat-square)](LICENSE)

Projet soumis à **IceHacks 2026** (CodeStarters, Devpost).

## Essayer tout de suite

**<https://tradoooo.github.io/rature/>** — public, HTTPS, sans compte, sans installation.

| Tu veux… | Fais |
|---|---|
| Voir le produit en 10 secondes, sans rien envoyer | Accueil → **« Lancer la démonstration »** (copie d'exemple, réponses du modèle enregistrées) |
| Analyser **ta** copie corrigée | Accueil → « Photographier ma copie » : l'analyse passe par le proxy, aucune clé à fournir |
| Analyser sans dépendre du proxy partagé | Réglages → colle ta clé InferHub (BYOK) ; elle reste sur ton appareil |
| Vérifier qu'aucune image n'est conservée | Ouvre l'onglet Réseau : l'image part en base64 dans la requête, rien n'est écrit, l'historique est en IndexedDB |

Le proxy public tourne sur Modal (CPU uniquement, scale-to-zero) : `proxy/modal_app.py`.

---

## Le problème

Un élève rend une copie, le professeur la corrige, l'élève la regarde dix secondes et la range.
L'information la plus personnelle de sa scolarité — la liste exacte de ses erreurs récurrentes —
est jetée en 24 heures.

Les outils existants répondent à la question posée (Photomath, ChatGPT) ou supposent que l'élève
sait déjà quoi réviser (Anki, Khan Academy). Aucun ne part du seul artefact qui contient déjà
l'information : **la copie annotée**.

## La thèse

On ne photographie pas l'énoncé, on photographie **la correction**. Raturé n'est pas un générateur
d'exercices : c'est un **profil d'erreur personnel** qui s'affine à chaque copie.

- 1ʳᵉ copie → un diagnostic
- 3ᵉ copie → un pattern
- 5ᵉ copie → un plan

## Le pipeline, en 6 étapes

```
 photo ──▶ 1 Ingest ──▶ 2 Anonymise ──▶ 3 Extrait ──▶ 4 Classifie ──▶ 5 Agrège ──▶ 6 Génère
           normalise     masque le nom    lit les       type chaque     profil        exercice
           + contraste                    annotations   faute (E01..    local         ciblé +
                                          du prof       E12 ou E99)     (IndexedDB)   garde-fou
```

| Étape | Entrée | Sortie | Budget |
|---|---|---|---|
| 1 Ingest | fichier image | image normalisée (1600 px, contraste étiré) | < 300 ms |
| 2 Anonymise | image | bandeau du nom pixelisé (RNF-P2) | < 500 ms |
| 3+4 Extrait et type | image | annotations + `[{code, ligne, explication, confiance}]` en **un seul appel** | < 20 s |
| 4 bis Seconde passe | fautes de confiance < 0,75 | codes confirmés, reclassés ou rétrogradés en E99 | < 5 s |
| 5 Agrège | classifications + historique | profil d'erreur (récurrence par type) | < 50 ms |
| 6 Génère | type dominant | exercice + solution masquée + **garde-fou** | < 6 s |

**Budget total : < 20 s** (22 s mesurés en moyenne, 6,7 s sur une copie propre). L'écran d'analyse
affiche chaque étape et sa durée : l'attente devient une démonstration.

Depuis la livraison du MVP : les étapes 3 et 4 sont **fusionnées en un seul appel vision** (la
latence amont, 16 à 50 s par aller-retour, était le point dur), une **seconde passe** revérifie les
fautes peu sûres, une **sonde de santé** du proxy propose la démo ou le BYOK si l'amont tombe, la
copie est **zoomable et cliquable**, chaque type d'erreur a son **explication pédagogique**, le
profil montre la **trajectoire** de la faille, et le mode prof répond à « **quoi reprendre lundi** ».

## La taxonomie fermée — le cœur du produit

12 types d'erreurs de maths, et rien d'autre. Le modèle ne peut pas inventer une catégorie :

`E01` signe perdu · `E02` développement incomplet · `E03` identité remarquable · `E04` dénominateur
commun · `E05` cas particulier oublié · `E06` puissance · `E07` racine · `E08` transposition ·
`E09` arrondi · `E10` unité · `E11` recopie · `E12` conclusion non justifiée.

Trois règles tiennent le diagnostic :

1. une faute = **un seul** type (sinon le profil devient illisible) ;
2. confiance < **0,6** → `E99` « non typée », **exclue** du profil ;
3. `E11` (recopie) est **signalée mais pondérée à 0** : une inattention n'est pas une lacune.

Détail : [`src/domain/taxonomy.ts`](src/domain/taxonomy.ts), règles dans
[`src/domain/profil.ts`](src/domain/profil.ts).

## Le garde-fou de l'étape 6

Un exercice hors sujet est pire que pas d'exercice. Après génération, un second passage vérifie
trois points : l'exercice travaille **réellement** le type identifié, il **ne donne pas** la
solution de l'exercice d'origine, il est **au même niveau**. Un refus → régénération, deux
tentatives maximum, puis un message honnête : « exercice non disponible pour ce type ».

## Ce qui est dans le périmètre — et ce qui ne l'est pas

**Inclus** : upload photo, extraction des annotations, classification typée, diagnostic affiché sur
la copie, masquage du nom, profil longitudinal, exercice ciblé, mode professeur (lot + statistique
de classe + CSV), exports CSV/Markdown, BYOK.

**Exclu, assumé publiquement** : autres matières que les maths (l'architecture le permet, la
taxonomie non), écriture cursive très dégradée, comptes et base de données serveur, correction ou
notation automatique de la copie. Restreindre le périmètre est une décision de design, pas un aveu.

## Décisions difficiles

| Décision | Pourquoi |
|---|---|
| Taxonomie **fermée** plutôt que prompt libre | Un diagnostic mesurable et défendable ; un libellé inventé par le modèle est invérifiable |
| **Aucun OCR classique** | Tesseract échoue sur le manuscrit : toute la lecture passe par le modèle multimodal, en un seul appel |
| **Zéro backend de données** | Pas de base, pas d'auth, pas de RGPD serveur : l'historique vit dans IndexedDB |
| **Proxy edge minimal** | La clé InferHub ne descend jamais dans le bundle ; sans lui, n'importe qui consomme le quota |
| **Le nom est masqué avant affichage** | Pixelisation du bandeau d'en-tête, jamais de flou (un flou se devine) |
| **Aucun rouge dans l'UI** | La copie est déjà annotée en rouge : ne pas rajouter de la honte à un document déjà marqué. Diagnostic en jaune, progression en vert |

## Les échecs

- **OCR classique sur le manuscrit** : abandonné dès le premier essai — le taux de lecture des
  annotations manuscrites du professeur est inutilisable. Toute la lecture passe par le modèle
  multimodal.
- **Faux positifs sur copie propre** : la première version du prompt d'extraction « trouvait » des
  fautes là où le professeur n'avait rien écrit. Correction : `copiePropre` devient une réponse
  explicite attendue, et l'étape de classification **n'est pas appelée** dans ce cas (test
  `RNF-04` : zéro appel, zéro faute).
- **Confiance surévaluée** : un modèle qui annote « 0,95 » partout rend le seuil inutile. Le
  prompt impose maintenant une consigne de calibration, et le corpus contient une annotation à
  0,31 qui doit finir `E99`.
- **Exercices hors sujet** : sans second passage, la génération dérive vers la notion générale
  (des fractions) au lieu du geste fautif (le dénominateur commun). D'où le garde-fou.

## Lancer le projet

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # 171 tests, aucun réseau
npm run typecheck
npm run build      # dist/ — 112 Ko gzip
```

Node ≥ 20. Aucune dépendance payante.

## Configuration du modèle

Le produit parle une API [OI]-compatible servie par **InferHub**. Trois modes, dans l'ordre :

1. **Proxy edge** (recommandé) : la clé `INFERHUB_API_KEY` est côté serveur.
   - Vercel : `vercel.json` + `api/analyze.ts` ;
   - Cloudflare Worker : `worker/worker.js` (`wrangler deploy`, `wrangler secret put INFERHUB_API_KEY`).
2. **BYOK** : l'utilisateur colle sa clé dans Réglages ; elle part dans l'en-tête `x-rature-cle` et
   reste sur l'appareil. Filet de sécurité si le quota du proxy est épuisé pendant le jugement.
3. **Mode démonstration** : l'accueil rejoue le parcours complet sur **trois copies du même élève**
   (`corpus/copies-demo.json`), rendues comme de **vraies photos** (page penchée sur une table,
   lumière inégale, grain de capteur, corrections du professeur en rouge) puis analysées par le
   vrai modèle. Les réponses **et les durées mesurées** sont réenregistrées (`corpus/reponses/`) :
   la démo reproduit le rythme réel d'une analyse (≈ 12 s), sans appel réseau ni clé, et l'UI le
   dit. Trois copies, c'est ce qui rend visibles hors ligne le **profil**, sa **trajectoire** et le
   mode professeur (« lot de démonstration »). Ajouter un enregistrement étend la démo sans toucher
   au code (découverte au build).

Variables : voir [`.env.example`](.env.example).

## Exigences non fonctionnelles

| Réf | Exigence | Cible | État |
|---|---|---|---|
| RNF-01 | photo → diagnostic | < 20 s | mesuré par étape, affiché dans l'UI |
| RNF-02 | latence UI hors API | < 100 ms | rendu React, aucune requête au clic |
| RNF-03 | précision de classification | ≥ 80 % sur 12 types | 100 % sur le corpus synthétique (5/5), à confirmer sur copies réelles |
| RNF-04 | faux positifs sur copie propre | 0 toléré | test dédié : 0 appel, 0 faute |
| RNF-05 | mobile (photo directe) | obligatoire | `capture="environment"`, cibles ≥ 48 px |
| RNF-06 | accessibilité AA, clavier, ≥ 16 px | obligatoire | focus visible, `aria-live`, textes ≥ 16 px |
| RNF-07 | bundle initial | < 300 Ko gzip | 112 Ko gzip |
| RNF-08 | disponibilité pendant le jugement | 24h/24 | GitHub Pages (statique, sans backend) |
| RNF-09 | quota épuisé → message clair + BYOK | obligatoire | 429 traduit en français, champ BYOK |
| RNF-10 | aucune dépendance payante | obligatoire | 0 $ |

## Vie privée

Aucune image n'est persistée, ni côté client ni côté proxy (RNF-P1). Le nom est masqué avant tout
affichage (RNF-P2). Le proxy ne journalise que l'horodatage, le statut HTTP et la latence (RNF-P3).
L'historique local est exportable et supprimable en un clic (RNF-P4), et l'UI le dit (RNF-P5).

## CI et infrastructure

CI en moins de 5 minutes sur quatre runners self-hosted **déplacés** depuis des dépôts qui ne s'en
servaient plus ; trois checks requis (`ci`, `ci-budget`, `couche0`) ; merge par la file Mergify ;
les conflits sont résolus par un agent branché sur InferHub. Détails :
[`docs/INFRA-CI.md`](docs/INFRA-CI.md).

## Déclaration des outils IA

Obligatoire et assumée : [`docs/DECLARATION-IA.md`](docs/DECLARATION-IA.md).

## Licence

MIT — voir [`LICENSE`](LICENSE).
