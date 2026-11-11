# Corpus de validation

## Ce qu'il y a ici

`fixtures.ts` décrit **7 copies** : 5 corrigées (avec fautes) et 2 propres
(sans annotation du professeur). Chaque fixture contient :

- `annotations` : ce que l'étape d'extraction est censée rendre ;
- `classementModele` : ce que l'étape de classification est censée rendre,
  avec des confiances volontairement variées (dont une à 0,31 qui doit devenir
  `E99` et sortir du profil) ;
- `typeDominantAttendu` : la vérité terrain.

Les tests (`tests/corpus.test.ts`) mesurent deux exigences du cahier des
charges :

| Réf | Exigence | Mesure |
|---|---|---|
| RNF-03 | ≥ 80 % de classification correcte | type dominant retrouvé sur les 5 copies |
| RNF-04 | 0 faux positif sur une copie sans erreur | les 2 copies propres rendent 0 faute |

Ces fixtures sont **synthétiques** : elles figent le comportement du pipeline
(parsing, seuil, pondération, exclusion d'E99) sans réseau ni quota. Elles ne
remplacent pas la validation sur vraies copies.

## Protocole sur vraies copies (go / no-go du jour 1)

1. Photographier **5 vraies copies corrigées** de niveau lycée (maths), dont au
   moins une avec un développement fautif et une avec une fraction.
2. Photographier **2 copies sans erreur** (le professeur n'a rien annoté).
3. Lancer l'app en BYOK (Réglages → clé InferHub) et analyser les 7 copies.
4. Noter pour chacune : nombre de fautes trouvées, codes, type dominant.
5. **Go** si : ≥ 4 copies sur 5 ont un type dominant correct **et** les 2
   copies propres rendent « aucune erreur détectée ».
6. **No-go** après 3 reformulations de prompt : bascule sur le plan B
   (aucune API, diagnostic local limité) — décision le soir même, pas le
   dernier jour.

Commande de mesure du corpus synthétique :

```bash
npm test -- tests/corpus.test.ts
```
