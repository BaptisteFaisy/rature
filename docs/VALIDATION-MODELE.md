# Validation du modèle — mesures réelles

Banc : `tests/live/inferhub.test.ts`, lancé avec une clé InferHub. Sans clé, il
est **ignoré** (la CI reste verte et ne consomme aucun quota).

```bash
INFERHUB_API_KEY=… npx vitest run tests/live/inferhub.test.ts
```

Images : `corpus/images/copie-{1,2,3}-*.png`, générées par
`scripts/generer-copies.py` (écriture élève en police manuscrite Caveat,
annotations du professeur en rouge). **Ce sont des copies synthétiques** : elles
valident le contrat des prompts et le comportement du pipeline contre le vrai
modèle, pas la lecture d'un manuscrit réel (protocole réel : `corpus/README.md`).

## Mesures du 11 novembre 2026

Modèle demandé : `ag/gemini-4-carbon`, replis `ag/claude-sonnet-4-6` puis
`ag/gemini-3.8-flash-high`.

| Copie | Vérité terrain | Annotations lues | Codes rendus (confiance) | Dominant | Verdict |
|---|---|---|---|---|---|
| 1 — signes | E01 dominant, 1 recopie | 3 | `E01:0.85`, `E01:0.88`, `E11:0.92` | **E01** | ✅ |
| 2 — fractions / identités | E03 et E04 | 4 | `E03:0.95`, `E03:0.95`, `E04:0.95`, `E04:0.90` | **E03** | ✅ |
| 3 — propre | aucune faute | 0 | — | **aucun** | ✅ 0 faux positif (RNF-04) |

Trois enseignements :

1. **La taxonomie tient.** Le modèle ne sort jamais des 12 codes, et il distingue
   correctement `E11` (recopie, pondérée à 0) d'une vraie lacune.
2. **Les confiances sont discriminantes** (0,85 – 0,95 sur des fautes nettes),
   donc le seuil de 0,6 a un sens. Sur la copie 3, l'extraction rend
   `copiePropre: true` et **aucune faute n'est inventée** : c'est l'exigence la
   plus importante du projet.
3. **La latence est le point dur**, et elle vient de l'amont, pas du code.

## Latence mesurée (et ce qu'on en fait)

| Appel | Mesure | Cible |
|---|---|---|
| Extraction (vision) | **16 s** au mieux, **45–52 s** quand la chaîne retombe sur un modèle lent | < 6 s |
| Classification (texte) | **8 s** | < 5 s |
| Total photo → diagnostic | **24 s** au mieux, jusqu'à **~60 s** | < 20 s |

InferHub est une place de marché : selon l'instant, un modèle est sans capacité
(503), hors enchère (402), ou servi par un fournisseur lent. Mesuré le même
soir : `ag/gemini-3.8-flash-high` = 48–52 s, `ag/gemini-4-carbon` = 16 s,
`ag/claude-sonnet-4-6` = 16 s puis 503 cinq minutes plus tard.

Trois réponses dans le code, pas dans la documentation :

1. **Chaîne de repli** (`src/pipeline/llm.ts`) : 402/500/502/503/504 → modèle
   suivant, sans rien montrer à l'utilisateur. Un 429 (quota) ne se soigne pas en
   changeant de modèle : il remonte tel quel, avec le message BYOK.
2. **Le diagnostic s'affiche avant l'exercice** (`onResultatPartiel` dans
   `src/pipeline/orchestrate.ts`) : RNF-01 porte sur photo → diagnostic. L'étape 6
   continue en arrière-plan et l'écran se complète à son arrivée.
3. **Mode démonstration** (`src/pipeline/demo.ts`) : les réponses réelles capturées sur la
   copie n°1 (`corpus/reponses/copie-1-signes.json`) sont rejouées à l'identique — le
   parcours complet est démontrable hors ligne, sans clé et sans amont disponible. L'UI
   affiche « réponses enregistrées » quand ce mode tourne.

Réduire encore la latence demanderait un fournisseur dédié (une seule clé, un
seul modèle, pas d'enchère) : c'est la première chose à faire après le
hackathon, et c'est un changement de configuration, pas d'architecture.

## Ce qui reste à valider

- [ ] 5 **vraies** copies corrigées photographiées + 2 copies propres (go/no-go
      du jour 1) — même banc, images réelles en entrée.
- [ ] Écriture professorale très déformée : comportement attendu = confiance
      basse, donc `E99`, donc hors profil. À confirmer sur cas réel.
- [ ] Exercice + garde-fou sur un type dominant réel (le banc actuel mesure les
      étapes 3 et 4).
