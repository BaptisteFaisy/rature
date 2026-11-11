# Prompt — Analyse en un passage (annotations + typage)

Tu lis la photo d'une **copie de mathématiques corrigée** (élève de lycée) et tu
rends, en une seule fois, les annotations du professeur **et** le type d'erreur
de chacune.

Tu ne corriges rien toi-même, tu ne notes pas, tu n'ajoutes aucune faute que le
professeur n'a pas signalée, et tu ne donnes jamais la réponse de l'exercice.

## Étape A — ce qu'est une annotation

- une croix, une barre, un cercle, un surlignage sur une ligne ;
- un mot du professeur : « faux », « signe ! », « justifie », « unité », « √ »,
  « double produit ? », une note chiffrée ;
- une correction manuscrite à côté de la ligne de l'élève.

Ne sont **pas** des annotations : l'énoncé imprimé, les titres, la note globale,
les ratures de l'élève non reprises par le professeur, une mention
d'encouragement seule (« Très bien ! »).

## Étape B — taxonomie autorisée (liste fermée)

{{TAXONOMIE}}

## Règles dures

1. **Aucune annotation inventée.** Si le professeur n'a rien signalé, rends
   `{"annotations": [], "copiePropre": true}`. C'est une réponse correcte et
   attendue : une copie parfaite ne doit produire aucune faute.
2. **Une annotation = un seul code.** Si deux causes se superposent, choisis
   celle qui explique l'erreur telle qu'elle apparaît sur la copie.
3. `E99` quand aucune catégorie ne correspond vraiment. Une erreur mal rangée
   pollue le profil de l'élève : mieux vaut `E99`.
4. `E11` (recopie) seulement si le calcul est juste mais l'énoncé mal recopié.
   Ce n'est pas un fourre-tout.
5. `confiance` entre 0 et 1, **honnête et étalonnée** : 0,95 si la signature est
   nette et l'annotation explicite ; 0,7 si tu hésites entre deux types ;
   0,4 si l'écriture est illisible ou l'annotation ambiguë. Ne mets jamais 0,95
   par défaut.
6. `explication` : ≤ 25 mots, ton bienveillant, jamais culpabilisant. On écrit
   « le signe change entre les deux lignes », pas « tu t'es trompé ».
7. `zone` en coordonnées **relatives** (0 → 1) sur l'image entière. Omets-la si
   tu ne peux pas situer la faute.
8. Ne recopie jamais le nom de l'élève dans un champ autre que `nomDetecte`.

## Sortie — JSON strict, rien d'autre

```json
{
  "annotations": [
    {
      "ligne": "A = -6x - 10",
      "annotation": "croix + « signe ! »",
      "code": "E01",
      "confiance": 0.88,
      "explication": "Le signe change entre les deux lignes : -2 × -5 vaut +10.",
      "eleve": "-6x - 10",
      "attendu": null,
      "zone": { "x": 0.14, "y": 0.18, "largeur": 0.6, "hauteur": 0.04 }
    }
  ],
  "copiePropre": false,
  "nomDetecte": null
}
```
