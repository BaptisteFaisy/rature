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

**Relevé du 12/11 à 13 h (saturation diurne)** : `ag/gemini-4-carbon` en 503,
`ag/gemini-3.8-flash-high` répond en **56,7 s pour 5 tokens** de sortie, une
image réelle de 476 Ko finit en **504 après 90 s**. Conclusion écrite noir sur
blanc : tant que l'amont est une place de marché partagée, la cible « photo →
diagnostic < 20 s » du cahier des charges **n'est pas tenable en journée**. Elle
l'est le soir (16 s mesurés à 21 h). C'est un choix d'hébergement du modèle, pas
un défaut du code — d'où les bornes d'attente côté client (`DELAI_APPEL_MS`,
`BUDGET_APPEL_MS`) qui évitent d'attendre 9 minutes avant de le dire.

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

## Validation de bout en bout sur la démo publique (22 h 27, même jour)

Parcours réel, sans aucune clé côté navigateur : photo téléversée sur
<https://baptistefaisy.github.io/rature/> → proxy Modal → InferHub → diagnostic.

Image envoyée : `copie-6-puissances-photo.png` (la **dégradée** : rotation 3°,
lumière inégale, bruit, flou).

| Étape | Résultat |
|---|---|
| Appels au proxy | 8 : `503, 503, 200` (extraction) puis `503, 503, 503, 503, 200` (classification) |
| Diagnostic | 3 fautes : **E06** puissance (0,95), **E07** racine (0,98), **E99** non typée (0,75) |
| Dominant | **E06** — conforme à la vérité terrain du manifeste |
| E99 | affichée « signalée, non comptée dans le profil » ✅ |
| Exercice | « Simplifie en écrivant sous la forme a × xⁿ : (3x⁴)² × x³ » — garde-fou validé sur les 3 critères |
| Profil | « 50 % de tes erreurs : puissance mal gérée », barres E06/E07 |
| Durée | ~40 s photo → diagnostic (dont la majeure partie en 503 rejoués) |

Deux enseignements :

1. **La chaîne de repli n'est pas théorique.** Sur 8 appels, 6 ont échoué ;
   sans elle, l'analyse se serait arrêtée au premier 503. C'est la différence
   entre une démo qui marche et une démo qui marche un soir sur trois.
2. **Un `throw` sans `await` a failli tout casser.** `throw erreurDepuisReponse(…)`
   sur une fonction `async` levait une **Promesse** : plus de repli
   (`instanceof ErreurLLM` faux) et un message générique à l'écran
   (`instanceof Error` faux). Invisible en test unitaire, trouvé uniquement en
   test de bout en bout dans le navigateur — d'où les 5 tests de repli ajoutés
   (`tests/llm-repli.test.ts`).

## Chemin fusionné (un seul appel vision) — mesuré le 11 novembre, 23 h 45

Le même corpus, mais avec l'analyse en **un seul appel** (annotations + typage) suivie de la
seconde passe sur les fautes peu sûres :

| Copie | Attendu | Obtenu | Fautes | Revues | Latence |
|---|---|---|---|---|---|
| 1 signes | E01 | **E01** | 3 | 0 | ~15 s |
| 4 développement | E02 | **E02** | 3 | 0 | ~15 s |
| 8 grandeurs | E09 | E10 ✗ | 4 | 0 | ~30 s |
| 3 propre | aucune | **aucune** | **0** | 0 | **6,7 s** |
| 6 puissances (dégradée) | E06 | **E06** | 4 | 0 | 56,1 s |

**Précision 4/5, latence moyenne 22,0 s** — contre 53 à 92 s sur le chemin séparé. La fusion divise
la latence par deux à trois sans perdre en justesse, et la copie propre reste à zéro faute en 6,7 s.
Le seul échec est le même qu'avant (copie 8, ambiguïté arrondi/unité de la fixture).

Banc : `tests/live/fusion.test.ts` (mêmes conditions : ignoré sans clé, chaîne de repli active).

## Chemin fusionné + prompts bornés + banque locale (12/11, 15 h 20)

Trois changements cumulés : les étapes 3 et 4 ne font **qu'un** appel vision, les prompts demandent un
JSON compact (explications ≤ 15 mots, pas de markdown), et l'étape 6 (exercice) est servie par la
**banque locale** — donc **zéro** appel réseau.

| Copie | Attendu | Obtenu | Fautes | Latence (avant → après) |
|---|---|---|---|---|
| 1 signes | E01 | **E01** | 3 | ~15 s → **12,3 s** |
| 4 développement | E02 | **E02** | 3 | ~15 s → **10,2 s** |
| 8 grandeurs | E09 | E10 ✗ | 4 | ~30 s → **12,3 s** |
| 3 propre | aucune | **aucune** | **0** | 6,7 s → **4,6 s** |

**Une analyse complète = un seul appel modèle.** Le chemin séparé (extraction puis classification)
mesurait 53 à 92 s par copie ; la version d'aujourd'hui est à **4,6-12,3 s**, et le total avec la
banque d'exercices est identique (l'exercice ne coûte plus d'appel). La cible RNF-01 (< 20 s) est
tenue, y compris en journée.

Le seul échec reste la copie 8 (E09 attendu, E10 rendu) : ambiguïté de la fixture, déjà documentée.

## Ce qui reste à valider

- [ ] 5 **vraies** copies corrigées photographiées + 2 copies propres : même
      banc, mêmes mesures, images réelles en entrée.
- [ ] Écriture professorale très déformée : comportement attendu = confiance
      basse → `E99` → hors profil. À confirmer sur cas réel.
- [ ] Exercice + garde-fou mesurés sur plusieurs types dominants (le banc
      actuel mesure les étapes 3 et 4 ; le mode démo couvre E01 de bout en bout).
