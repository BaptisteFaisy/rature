## Scope

<!-- Le gate `couche0` exige des puces qui énumèrent EXACTEMENT les fichiers
touchés par la PR (chemins relatifs, sans backticks obligatoires mais lisibles).
Une puce en trop ou en moins = périmètre refusé. -->

- `chemin/du/fichier1.ts`
- `chemin/du/fichier2.ts`

## Pourquoi

<!-- Une phrase : le problème ou la valeur ajoutée. -->

## Comment vérifier

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`

<!-- Rappel : CI budget 5 min, trois checks requis (ci, ci-budget, couche0),
merge par la file Mergify uniquement. Jamais de push direct sur main. -->
