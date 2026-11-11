# Formulaire Devpost — champs pré-remplis

## Nom du projet

Raturé

## Tagline (≤ 60 caractères)

`Elle t'entraîne sur ce que toi tu rates.` (39 caractères)

Alternative : `Photographie ta copie corrigée. Trouve ta faille.` (48)

## Description courte

Raturé photographie ta copie de maths corrigée, lit les annotations du professeur, type chaque
faute dans une taxonomie fermée de 12 erreurs, et fabrique l'exercice qui travaille exactement
celle que tu répètes. Au bout de trois copies, tu ne vois plus une liste de fautes : tu vois ton
profil d'erreur. Aucune copie n'est conservée, l'historique reste sur l'appareil.

## Inspiration

Un élève regarde sa copie corrigée dix secondes et la range. La seule information vraiment
personnelle de sa scolarité — la liste de ses erreurs récurrentes — est jetée en 24 heures. Tous les
outils existants partent de l'énoncé vierge pour donner la réponse. Aucun ne part de la correction,
qui contient déjà le diagnostic.

## What it does

Six étapes : normalisation de la photo, masquage du nom, extraction des annotations du professeur
par vision multimodale, classification dans une taxonomie fermée (E01 signe perdu → E12 conclusion
non justifiée, plus E99 non typée), agrégation locale du profil d'erreur, génération d'un exercice
ciblé vérifié par un garde-fou de pertinence. Mode professeur : le paquet de copies donne la
statistique d'erreurs de la classe et un export CSV.

## How we built it

Vite + React + TypeScript + Tailwind, stockage IndexedDB, aucun backend de données. Un proxy edge
minimal (fonction Vercel, variante Cloudflare Worker) cache la clé InferHub et borne le quota ; un
mode BYOK prend le relais si le quota est épuisé. Les prompts sont versionnés dans `prompts/`. CI
en moins de 5 minutes sur runners self-hosted, merge par file Mergify, conflits résolus par un agent
branché sur InferHub.

## Challenges we ran into

L'OCR classique est inutilisable sur le manuscrit. La première version inventait des fautes sur une
copie propre : `copiePropre` est devenu une réponse attendue, et l'étape de classification n'est
plus appelée dans ce cas. Un modèle qui rend 0,95 de confiance partout rend le seuil inutile :
d'où une consigne de calibration et un corpus qui contient une annotation à 0,31 devant finir E99.
Enfin, la génération dérivait vers la notion générale au lieu du geste fautif : d'où le second
passage de vérification.

## Accomplishments that we're proud of

Zéro faux positif sur copie propre, vérifié par un test qui interdit tout appel réseau dans ce cas.
Un diagnostic mesurable plutôt qu'une liste de phrases. Un bundle de 94 Ko gzip. Une UI qui
n'ajoute jamais de rouge à une copie déjà annotée en rouge.

## What we learned

Un diagnostic n'a de valeur que s'il est stable : la même copie analysée deux fois doit donner le
même type. La taxonomie fermée et le seuil de confiance ne sont pas des contraintes techniques, ce
sont les conditions de confiance de l'élève dans son propre profil. Et l'honnêteté est une
fonctionnalité : dire « exercice non disponible pour ce type » rapporte plus de crédibilité qu'une
animation.

## What's next for Raturé

Autres matières (l'architecture le permet déjà, il manque les taxonomies), validation pédagogique
sur une classe réelle, intégration LMS pour l'export professeur, et suivi de la décroissance d'un
type d'erreur au fil des copies.

## Built with

- typescript
- react
- vite
- tailwindcss
- indexeddb (idb-keyval)
- zod
- vitest
- inferhub (API [OI]-compatible multimodale)
- vercel serverless functions / cloudflare workers
- github pages
- github actions (runners self-hosted)
- mergify

## Tracks à cocher

- [x] Best AI Hack
- [x] Best Deployed / Shipped App
- [x] Best Design & UX
- [x] Overall
- [ ] Hardware (aucune pièce physique : ne pas cocher)

## Liens

- Démo : https://baptistefaisy.github.io/rature/
- Code : https://github.com/BaptisteFaisy/rature
- Vidéo : _(à coller, lien public vérifié en navigation privée)_

## Équipe

1 membre : Baptiste Faisy — conception, taxonomie, prompts, code, CI, déploiement.
