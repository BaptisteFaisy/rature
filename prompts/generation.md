<!-- v2 — sortie bornée, 12/11 -->

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
5. `enonce` : **60 mots maximum** — l'énoncé seul, pas de couple, pas de
   remarque.
6. `solution` : **60 mots maximum**, correction courte et **détaillée sur le
   point visé** : c'est l'explication de la mécanique, pas seulement le
   résultat final.
7. `indices` : **une seule amorce** (**20 mots maximum**), jamais la réponse.
8. `niveau` : **un seul mot** (ex. `seconde`, `premiere`, `terminale`).
9. **Pas de champ `typeTravaille`** : l'application sait déjà quel type elle
   travaille, inutile de le répéter.
10. Ton bienveillant. Aucune phrase qui juge l'élève.

## Sortie — une ligne de JSON, rien d'autre

- **Uniquement l'objet JSON** : aucun mot avant, aucun mot après, aucun
  commentaire.
- **Une seule ligne**, sans indentation, sans saut de ligne.
- **Pas de bloc de code markdown** autour : le parseur lit le JSON nu, les
  balises ne servent qu'à coûter des tokens.

Exemple (une seule ligne) :
`{"enonce":"Développe et réduis : -2(3x - 5) + 4(x - 1)","indices":["Écris d'abord le développement de chaque produit, sans rien supprimer."],"solution":"-2(3x-5) = -6x + 10 ; 4(x-1) = 4x - 4 ; total -2x + 6. Le piège : -2 × (-5) = +10.","niveau":"seconde"}`
