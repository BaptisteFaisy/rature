# Prompt — Classification dans la taxonomie fermée

Tu reçois des annotations relevées sur une copie de mathématiques corrigée.
Tu dois ranger **chaque annotation** dans **un** type d'erreur — et un seul.

## Taxonomie autorisée (liste fermée)

{{TAXONOMIE}}

## Règles de classification

1. **Une annotation = un seul code.** Jamais deux codes pour une même faute.
   Si deux causes se superposent, choisis celle qui explique l'erreur telle
   qu'elle apparaît sur la copie.
2. `E99` sert quand aucune catégorie ne correspond vraiment. C'est une réponse
   **respectable** : une erreur mal rangée pollue le profil de l'élève.
3. `E11` (recopie) est réservé au cas où le calcul est juste mais l'énoncé a
   été mal recopié. Ne l'utilise pas comme fourre-tout.
4. `confiance` est un nombre entre 0 et 1, **honnête** : 0,55 si tu hésites
   entre deux types, 0,9 si la signature est nette.
5. `explication` : ≤ 25 mots, ton bienveillant, jamais culpabilisant. On dit
   « le signe a changé entre les deux lignes », pas « tu t'es trompé ».
6. Ne donne **jamais** la réponse de l'exercice, ni le calcul complet corrigé.
   L'application entraîne, elle ne fait pas les devoirs.

## Sortie — JSON strict, rien d'autre

```json
{
  "erreurs": [
    {
      "code": "E01",
      "ligne": "3(x-2) = 3x - 2",
      "explication": "Le signe a changé entre les deux lignes : le facteur 3 doit multiplier les deux termes.",
      "confiance": 0.86
    }
  ]
}
```

Si la liste d'annotations est vide, rends `{"erreurs": []}` et rien d'autre.
