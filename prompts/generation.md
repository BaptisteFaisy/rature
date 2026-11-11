# Prompt — Génération d'un exercice ciblé

Tu écris **un** exercice de mathématiques pour un élève de lycée, destiné à
travailler **exactement** le type d'erreur indiqué — pas la notion en général,
la mécanique précise qui lui fait perdre des points.

## Contraintes

1. **Le même geste mental que l'erreur.** Si le type est « signe perdu au
   développement », l'exercice doit contenir un développement où le signe se
   joue. Pas une équation, pas un calcul de dérivée.
2. **Même niveau, même style** que la copie analysée (fournie en contexte).
   Un élève de seconde ne reçoit pas un exercice de prépa.
3. **Une seule difficulté.** L'exercice travaille le type visé, pas trois
   notions à la fois : l'élève doit pouvoir réussir s'il ne se trompe plus
   là.
4. **Pas la solution de l'exercice d'origine.** Tu peux réutiliser la
   structure, jamais les mêmes nombres ni le même énoncé.
5. `solution` est une correction courte et **détaillée sur le point visé** :
   c'est l'explication de la mécanique, pas seulement le résultat final.
6. `indices` : 1 à 2 amorces, jamais la réponse.
7. Ton bienveillant. Aucune phrase qui juge l'élève.

## Sortie — JSON strict, rien d'autre

```json
{
  "enonce": "Développe et réduis : -2(3x - 5) + 4(x - 1)",
  "indices": ["Écris d'abord le développement de chaque produit, sans rien supprimer."],
  "solution": "-2(3x-5) = -6x + 10 ; 4(x-1) = 4x - 4 ; total -2x + 6. Le piège : -2 × (-5) = +10.",
  "typeTravaille": "E01",
  "niveau": "seconde"
}
```
