# Architecture

## Vue d'ensemble

```
[Navigateur]                        [Edge]                    [InferHub]
 Webapp statique  ── HTTPS ──▶  Proxy (Worker / fonction) ──▶  API [OI]-compatible
       │                          clé cachée, quota,            vision + raisonnement
       │                          journal minimal
       └── IndexedDB : diagnostics, profil, réglages (jamais l'image)
```

Trois modes d'accès au modèle, dans l'ordre de préférence :

1. **Proxy edge** — la clé `INFERHUB_API_KEY` reste côté serveur (`api/analyze.ts` pour Vercel,
   `worker/worker.js` pour Cloudflare). Sans proxy, n'importe qui consomme le quota.
2. **BYOK** — l'utilisateur colle sa clé ; elle part dans l'en-tête `x-rature-cle`, reste sur
   l'appareil et remplace la clé serveur. C'est le filet de sécurité du jour du jugement.
3. **Corpus de démo** — `corpus/fixtures.ts` rejoue des réponses enregistrées, sans clé ni réseau :
   les tests et la démonstration hors ligne passent par là.

## Les quatre choix structurants

| Choix | Conséquence |
|---|---|
| Zéro backend de données | Pas de base, pas d'auth, pas de RGPD serveur. L'historique vit dans IndexedDB |
| Un proxy edge minimal | La clé n'est jamais dans le bundle ; le quota est borné |
| Webapp statique | Déploiement en une commande, disponibilité 24h/24 pendant le jugement |
| BYOK en secours | Un juge peut tester même si le quota partagé est épuisé |

## Le pipeline, étape par étape

| # | Étape | Fichier | Entrée | Sortie | Budget |
|---|---|---|---|---|---|
| 1 | Ingest | `src/pipeline/ingest.ts` | `File` | data URL 1600 px, contraste étiré | < 300 ms |
| 2 | Anonymise | `src/pipeline/anonymize.ts` | data URL | data URL, bandeau du nom pixelisé | < 500 ms |
| 3 | Extrait | `src/pipeline/extract.ts` | data URL | `Extraction` (annotations, `copiePropre`) | < 6 s |
| 4 | Classifie | `src/pipeline/classify.ts` | `Extraction` | `Erreur[]` typées E01..E12/E99 | < 5 s |
| 5 | Agrège | `src/domain/profil.ts` | erreurs + historique | `Profil` (récurrence, évolution) | < 50 ms |
| 6 | Génère | `src/pipeline/exercise.ts` | type dominant | `ExerciceVerifie` ou message honnête | < 6 s |

Orchestration : `src/pipeline/orchestrate.ts` — une `Progression` publiée par étape (état, message,
durée), budget total 20 s, échec d'une étape traduit en message lisible.

### Le point d'injection

Tout le pipeline parle à un `ClientBrut` (`src/pipeline/client.ts`), jamais à `fetch`. En
production c'est `completer()` de `src/pipeline/llm.ts` ; en test c'est `clientSimule()`, qui rend
des réponses JSON enregistrées. Conséquence : **41 tests tournent sans réseau ni quota**, et le
corpus de validation est rejouable en CI.

## Le garde-fou de l'étape 6

Deux appels distincts, jamais un seul :

1. `prompts/generation.md` → l'exercice (énoncé, indices, solution, niveau) ;
2. `prompts/garde-fou.md` → le verdict sur trois critères : travaille le bon type, ne donne pas la
   solution d'origine, même niveau.

Un critère refusé → régénération. Deux tentatives maximum (`MAX_TENTATIVES_EXERCICE`), puis
`exercice: null` + un message explicite. On ne sert jamais un exercice hors sujet.

## Modèle de données

Défini dans `src/domain/types.ts`. Stocké en local uniquement (`src/storage/local.ts`, clés dans
`src/domain/config.ts`) :

- `Diagnostic` — id, horodatage, matière, fautes, type dominant ;
- `Erreur` — code, libellé, ligne (texte, jamais l'image), explication ≤ 25 mots, confiance,
  pondération ;
- `Profil` — occurrences pondérées par type, nombre d'analyses, évolution, et les fautes
  *signalées mais non pondérées* (E11, E99) ;
- `StatsClasse` — agrégat du mode professeur (`src/domain/classe.ts`).

Aucune image, aucun nom, aucune donnée personnelle ne traverse la couche de stockage.

## Règles de confidentialité

| Réf | Exigence | Où c'est tenu |
|---|---|---|
| RNF-P1 | l'image n'est jamais persistée | data URL en mémoire de session, jamais écrite dans IndexedDB |
| RNF-P2 | nom masqué avant affichage | étape 2, pixelisation du bandeau |
| RNF-P3 | proxy sans journal de contenu | `api/analyze.ts` : horodatage, statut, latence uniquement |
| RNF-P4 | historique exportable et supprimable | écran Réglages, `effacerHistorique()` |
| RNF-P5 | mention explicite dans l'UI | accueil, cadrage, réglages, pied de page |

## Interface

Huit écrans (`src/ui/screens/`), un routeur maison par état + paramètre `?ecran=` pour partager un
écran précis pendant la démo. Design : fond `#0d0f14`, jaune `#f5c518` pour le diagnostic, vert
`#3ecf8e` pour la progression, **aucun rouge** — la copie est déjà annotée en rouge par le
professeur.

## Ce que l'architecture permet sans la taxonomie

Ajouter une matière (physique) demanderait une nouvelle taxonomie et de nouveaux prompts, pas une
nouvelle architecture : les étapes 1, 2, 5 et 6 sont indépendantes du domaine. C'est volontairement
hors périmètre pendant le hackathon.
