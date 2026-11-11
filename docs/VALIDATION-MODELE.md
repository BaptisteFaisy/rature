# Validation du modèle — mesures réelles

Banc : `tests/live/inferhub.test.ts`, lancé avec une clé InferHub sur tout le
corpus. Sans clé, il est **ignoré** : la CI reste verte et ne consomme aucun
quota.

```bash
INFERHUB_API_KEY=… npx vitest run tests/live/inferhub.test.ts   # ~13 min (11 copies)
INFERHUB_API_KEY=… npx vitest run tests/live/enregistrer-demo.test.ts  # capture le mode démo
```

Corpus : `corpus/images/` (11 PNG) + `manifeste.json` (vérité terrain), générés
par `scripts/generer-copies.py` — écriture élève en police manuscrite,
annotations du professeur en rouge, et **3 copies dégradées** (rotation 2-3°,
lumière inégale, bruit, flou léger, contraste réduit) pour approcher une photo
de téléphone.

> **Limite assumée.** Ce sont des copies synthétiques : elles valident le
> contrat des prompts, la taxonomie et la robustesse aux conditions de prise de
> vue. Elles ne remplacent pas la lecture d'un vrai manuscrit — protocole dans
> [`../corpus/README.md`](../corpus/README.md).

## Mesures du 11 novembre 2026 (21 h, 11 copies)

| Mesure | Résultat | Cible |
|---|---|---|
| **RNF-03** — dominants corrects, copies nettes | **86 % (6/7)** | ≥ 80 % ✅ |
| **Robustesse** — copies dégradées | **100 % (2/2)** | ≥ 50 % ✅ |
| **RNF-04** — fautes sur copie propre (nette + dégradée) | **0 et 0** | 0 ✅ |
| Latence par copie (extraction + classification) | 53 à 92 s | < 20 s ❌ (amont) |

Détail par copie :

| Copie | Type visé | Obtenu | Fautes | Latence |
|---|---|---|---|---|
| 1 signes (nette) | E01 | **E01** | 3 | ~60 s |
| 2 identités/fractions | E03 | **E03** | 4 | ~60 s |
| 4 développement incomplet | E02 | **E02** | 3 | ~60 s |
| 5 domaine/cas particulier | E05 | **E05** | 3 | 63 s |
| 6 puissances et racines | E06 | **E06** | 4 | ~60 s |
| 7 transpositions | E08 | **E08** | 3 | 57 s |
| 8 grandeurs et arrondis | E09 | **E10** ✗ | 4 | 75 s |
| 3 propre (nette) | aucune | **aucune** | **0** | 70 s |
| 3 propre (dégradée) | aucune | **aucune** | **0** | 53 s |
| 1 signes (dégradée) | E01 | **E01** | 3 | 68 s |
| 6 puissances (dégradée) | E06 | **E06** | 4 | 92 s |

### Le seul échec est instructif

La copie 8 mélange volontairement un arrondi prématuré (`100/3 = 33`), une
absence d'unité et une conversion fausse (`2 h 30 = 2,3 h`). Le modèle rend
`E10` là où la fixture attend `E09`. Les deux sont défendables : c'est une
copie où plusieurs types cohabitent, et la règle « une faute = un seul type »
impose un arbitrage. **Ce n'est pas un bug du modèle, c'est une ambiguïté de la
vérité terrain** — et ça plaide pour des fixtures à faute unique quand on mesure
la précision.

### Ce que la dégradation ne change pas

Rotation, lumière inégale, bruit et flou léger ne font perdre ni la lecture des
annotations, ni le typage, ni le « zéro faute » sur la copie propre. La
pixelisation du bandeau (étape 2) n'a pas non plus empêché la lecture du reste
de la page.

## Latence : le point dur, et il vient de l'amont

InferHub est une place de marché. Mesures du 11 novembre au soir :

| Modèle | Vision (copie du corpus) | Disponibilité |
|---|---|---|
| `ag/gemini-4-carbon` | 16 s | intermittente (503 fréquents) |
| `ag/claude-sonnet-4-6` | 16 s | intermittente (503) |
| `ag/gemini-3.8-flash-high` | 45-52 s | **la plus fiable** |
| `ag/gemini-4-argon`, `ag/claude-sonnet-5-5`, `ag/claude-opus-4-6-thinking` | — | 503 au moment du test |
| familles hors `ag/` (`ali/`, `oai/`, `cb/`…) | — | 402 « no provider under bid » ou 403 désactivé |

À un instant donné, **5 des 6 modèles vision étaient en 503** : la chaîne de
repli n'est pas un confort, c'est ce qui fait que l'analyse aboutit.

Trois réponses dans le code :

1. **Chaîne de repli sur les 6 modèles `ag/`** (`src/domain/config.ts`,
   `src/pipeline/llm.ts`) : 402/5xx → modèle suivant ; 429 fournisseur → pause
   2,5 s puis modèle suivant ; 429 du proxy → message quota + recours BYOK.
2. **Le diagnostic s'affiche avant l'exercice** (`onResultatPartiel`) : RNF-01
   porte sur photo → diagnostic ; l'étape 6 continue en arrière-plan.
3. **Mode démonstration** (`src/pipeline/demo.ts`) : réponses réelles
   enregistrées, parcours complet sans réseau — la vidéo et la démo publique ne
   dépendent pas de l'amont.

Pour tenir les 20 s du cahier des charges, il faut un fournisseur dédié (une
clé, un modèle, pas d'enchère) : c'est un changement de configuration
(`RATURE_AMONT` + `RATURE_MODELE`), pas d'architecture.

## Ce qui reste à valider

- [ ] 5 **vraies** copies corrigées photographiées + 2 copies propres : même
      banc, mêmes mesures, images réelles en entrée.
- [ ] Écriture professorale très déformée : comportement attendu = confiance
      basse → `E99` → hors profil. À confirmer sur cas réel.
- [ ] Exercice + garde-fou mesurés sur plusieurs types dominants (le banc
      actuel mesure les étapes 3 et 4 ; le mode démo couvre E01 de bout en bout).
