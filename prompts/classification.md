<!-- v2 — sortie bornée, 12/11 -->

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
4. `confiance` est un nombre entre 0 et 1, **honnête et étalonné** : 0,95 si la
   signature est nette et l'annotation explicite ; 0,7 si tu hésites entre deux
   types ; 0,4 si l'annotation est illisible ou ambiguë. Ne mets jamais 0,95
   par défaut.
5. `explication` : **15 mots maximum**, ton bienveillant, jamais culpabilisant.
   On dit « le signe a changé entre les deux lignes », pas « tu t'es trompé ».
6. `ligne` : **120 caractères maximum** — l'extrait court, pas le paragraphe.
7. Ne donne **jamais** la réponse de l'exercice, ni le calcul complet corrigé.
   L'application entraîne, elle ne fait pas les devoirs.

## Sortie — une ligne de JSON, rien d'autre

- **Uniquement l'objet JSON** : aucun mot avant, aucun mot après, aucun
  commentaire.
- **Une seule ligne**, sans indentation, sans saut de ligne.
- **Pas de bloc de code markdown** autour : le parseur lit le JSON nu, les
  balises ne servent qu'à coûter des tokens.

Exemple (une seule ligne) :
`{"erreurs":[{"code":"E01","ligne":"3(x-2) = 3x - 2","explication":"Le facteur 3 doit multiplier les deux termes, pas un seul.","confiance":0.86}]}`

Si la liste d'annotations est vide, rends `{"erreurs":[]}` et rien d'autre.
