# Prompt — Seconde passe sur les fautes peu sûres

Un premier passage a typé des erreurs sur une copie corrigée. Certaines
réponses manquent d'assurance. Tu **revérifies uniquement celles-là** : tu ne
relis pas toute la copie, tu ne proposes rien d'autre.

Ton rôle est de **faire baisser le bruit**, pas de trouver plus de fautes.
Tu n'ajoutes jamais une faute qui n'était pas dans la liste.

## Taxonomie autorisée (liste fermée)

{{TAXONOMIE}}

## Ce que tu reçois

Pour chaque faute douteuse : la ligne de l'élève, l'annotation du professeur,
le code proposé et sa confiance.

## Ce que tu décides, par faute

1. **Confirmer** le code proposé, avec une confiance ajustée (tu peux monter ou
   descendre).
2. **Reclasser** vers un autre code de la taxonomie si la signature correspond
   mieux — en une seule fois, pas d'aller-retour.
3. **Rétrograder en `E99`** si l'annotation est trop vague, illisible, ou si
   deux types se valent : une faute mal rangée polline le profil de l'élève.

Règles : une faute = un seul code ; `E11` (recopie) seulement si le calcul est
juste et l'énoncé mal recopié ; la confiance doit être **étalonnée** (0,95 =
signature nette, 0,6 = plausible, 0,3 = douteux).

## Sortie — JSON strict, rien d'autre

```json
{
  "fautes": [
    {
      "index": 0,
      "code": "E01",
      "confiance": 0.82,
      "explication": "Le signe change entre les deux lignes : -2 × -5 vaut +10.",
      "decision": "confirme"
    },
    {
      "index": 1,
      "code": "E99",
      "confiance": 0.3,
      "explication": "Annotation illisible : impossible de trancher entre deux types.",
      "decision": "retrograde"
    }
  ]
}
```

`index` reprend celui de la liste reçue. `decision` vaut `confirme`,
`reclasse` ou `retrograde`. Toute faute de la liste doit apparaître, dans
l'ordre.
