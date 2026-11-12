# Corpus de validation

Deux couches de validation, complémentaires :

| Couche | Fichiers | Réseau | Rôle |
|---|---|---|---|
| **Hors ligne** | `fixtures.ts` | aucun | fige le comportement du pipeline : parsing, seuil 0,6, `E99` exclue, `E11` à poids 0, zéro faute sur copie propre. Tourne dans la CI à chaque PR |
| **Live** | `images/` + `manifeste.json` | InferHub | mesure la vraie qualité du modèle (RNF-03, RNF-04, robustesse). Ignoré sans clé |

## Couche hors ligne — `fixtures.ts`

7 copies décrites en données : 5 corrigées (avec fautes) et 2 propres. Chaque
fixture contient les annotations attendues, la réponse JSON simulée du modèle
(avec des confiances volontairement variées, dont une à 0,31 qui doit finir
`E99`) et la vérité terrain. Mesurées par `tests/corpus.test.ts` :

| Réf | Exigence | Mesure |
|---|---|---|
| RNF-03 | ≥ 80 % de classification correcte | type dominant retrouvé sur les 5 copies |
| RNF-04 | 0 faux positif sur copie sans erreur | 0 faute **et 0 appel** de classification |

## Couche live — `images/` et `manifeste.json`

11 PNG générés par `scripts/generer-copies.py` (écriture élève en police
manuscrite Caveat, annotations du professeur en rouge) :

- **8 copies nettes**, une par type visé : E01 signes, E02 développement
  incomplet, E03 identités remarquables + E04 fractions, E05 domaine, E06
  puissances + E07 racines, E08 transposition + E12 justification, E09 arrondi +
  E10 unités, et une **copie propre** ;
- **3 copies dégradées** (rotation 2-3°, lumière inégale, bruit, flou léger,
  contraste réduit) pour approcher une photo de téléphone : la copie 1, la
  copie 6 et la copie propre.

`corpus/demo/` contient les **3 photos** de la démonstration hors ligne : les copies d'un même
élève (`corpus/copies-demo.json`), rendues puis passées par une **chaîne caméra** (perspective,
lumière inégale, vignette, grain, flou, ombre portée sur une table) pour ressembler à de vraies
photos de téléphone — pas à des captures d'écran. Elles sont générées par
`python3 scripts/generer-copies.py --demo`, jamais éditées à la main.

Le fichier `corpus/copies-demo.json` est la source de vérité de cette histoire : trois devoirs du
même élève, où la faute de **signe** revient puis se corrige. Les réponses de la démo
(`corpus/reponses/`) sont **réenregistrées** sur ces photos avec le vrai modèle — donc si tu touches
à `copies-demo.json`, il faut recapturer (`tests/live/enregistrer-demo.test.ts`).

## Où trouver de vraies copies (source externe)

Recherche faite le 12/11 (DuckDuckGo/Google/Bing) : **les photos de vraies copies d'élèves
corrigées et annotées par le professeur ne sont pas librement téléchargeables**. Ce qui existe :

- des **services payants** de correction à la main (`copie-corrigee.fr`) ;
- des **blogs de profs** qui montrent parfois un travail d'élève anonymisé en exemple
  (`mathix.org`, `professeurtheros.fr`, `maths-et-tiques.fr`) ;
- des PDF académiques de **corrections officielles** (qui ne montrent pas les erreurs d'élèves).

**Le chemin validé reste donc : photographier 5 vraies copies corrigées + 2 copies propres**
(protocole ci-dessous). En attendant, `corpus/demo/` fournit 3 « photos » photoréalistes du même
élève, et `corpus/images/` le corpus synthétique contrôlé.

Le `manifeste.json` porte la vérité terrain (`fichier`, `dominant`,
`degradee`) : il est **généré en même temps que les images**, donc l'attente du
banc ne peut pas diverger du corpus.

```bash
python3 scripts/generer-copies.py                 # régénère images + manifeste
INFERHUB_API_KEY=… npx vitest run tests/live/     # mesure (≈ 13 min)
```

Résultats et analyse : [`../docs/VALIDATION-MODELE.md`](../docs/VALIDATION-MODELE.md).

> **Ce que le synthétique ne mesure pas.** Une copie générée n'a ni vraie
> écriture manuscrite, ni pli, ni reflet, ni cadrage approximatif. Elle valide
> les prompts, la taxonomie et la tenue aux dégradations numériques — pas la
> lecture du manuscrit réel.

## Protocole sur vraies copies (go / no-go du jour 1)

1. Photographier **5 vraies copies corrigées** de niveau lycée (maths), dont au
   moins une avec un développement fautif et une avec une somme de fractions.
2. Photographier **2 copies sans erreur** (le professeur n'a rien annoté).
3. Déposer les 7 photos dans `corpus/images/reelles/` et ajouter leurs entrées
   au manifeste (`"reelle": true`).
4. Lancer le banc : `INFERHUB_API_KEY=… npx vitest run tests/live/inferhub.test.ts`.
5. **Go** si : ≥ 4 copies sur 5 ont un type dominant correct **et** les 2 copies
   propres rendent « aucune erreur détectée ».
6. **No-go** après 3 reformulations de prompt : bascule sur le plan B (aucune
   API, diagnostic local limité). Décision le soir même, pas le dernier jour.

Le mode démonstration (`src/pipeline/demo.ts`) se recapture de la même façon :
`INFERHUB_API_KEY=… npx vitest run tests/live/enregistrer-demo.test.ts` écrit
les réponses réelles dans `corpus/reponses/`.
