# Contribuer

## Lancer le projet

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # 170 tests, aucun réseau, aucun quota consommé
npm run typecheck
npm run build      # dist/
node scripts/check-tokens.mjs   # garde de taille des fichiers et fonctions
```

Node ≥ 20. Aucune dépendance payante.

## Règles de contribution

1. **Jamais de push direct sur `main`** : le ruleset l'impose (PR obligatoire, historique
   linéaire, trois checks requis).
2. **Une branche = une PR**, ouverte dans la minute qui suit le push. Une branche mergée ou fermée
   est supprimée, côté GitHub et en local.
3. **Le corps de la PR contient un bloc `## Scope`** avec une puce par fichier ou dossier touché
   (le modèle de PR le fournit). Le garde `couche0` refuse un périmètre non déclaré.
4. **CI en moins de 5 minutes** : on ne rallonge jamais un `timeout-minutes`. Un job trop long sort
   des PR.
5. **Taille** : fichiers < 500 lignes, fonctions < 50 lignes. Au-delà, on découpe.
6. **Le merge est automatique** : la file Mergify embarque une PR dès que `ci`, `ci-budget` et
   `couche0` sont verts. Frein manuel : étiquette `hold`. Les conflits de rebase sont résolus par
   un agent branché sur InferHub (`.github/fireworks/conflict_agent.py`).

## Où modifier quoi

| Zone | Contenu |
|---|---|
| `src/domain/` | Taxonomie, règles du profil, types. **Le cœur métier** : toute règle change ici, jamais dans l'UI |
| `src/pipeline/` | Les 6 étapes et le client modèle. Aucun appel réseau hors `llm.ts` |
| `src/ui/` | Écrans et composants. Aucune règle métier |
| `src/storage/`, `src/export/` | Persistance locale et exports |
| `prompts/` | Prompts versionnés : extraction, classification, génération, garde-fou |
| `api/`, `worker/` | Proxy edge. Aucun secret dans le code |
| `corpus/`, `tests/` | Fixtures et tests. Ajouter un cas d'erreur = ajouter une fixture |

## Ajouter un type d'erreur

La taxonomie est **fermée** : ajouter un code est une décision produit, pas un ajustement de prompt.

1. Ajouter l'entrée dans `src/domain/taxonomy.ts` (code, libellé, signature) ;
2. Le prompt de classification se régénère tout seul depuis `TAXONOMIE` (`blocTaxonomie()`) ;
3. Ajouter une fixture dans `corpus/fixtures.ts` avec sa vérité terrain ;
4. Vérifier que `npm test` reste vert (RNF-03 ≥ 80 %, RNF-04 = 0 faux positif).

## Ce qu'on refuse

- Correction ou notation automatique de la copie : on diagnostique, on ne note pas.
- Donner la réponse de l'exercice d'origine.
- Persister une image, un nom, ou quoi que ce soit côté serveur.
- Du rouge dans l'interface : le diagnostic est jaune, la progression est verte.
