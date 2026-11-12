# Déclaration des outils IA

Les règles du concours exigent : « Participants must disclose significant AI-generated contributions
and remain responsible for understanding and demonstrating their projects. » Voici la déclaration
complète, sans zone grise.

## 1. IA appelée **par le produit** (c'est le produit lui-même)

| Usage | Fournisseur | Où |
|---|---|---|
| Lecture des annotations manuscrites du professeur (vision) | InferHub, API [OI]-compatible, modèle multimodal `ag/gemini-3.8-flash-high` | `src/pipeline/extract.ts` |
| Classification dans la taxonomie fermée (12 types) | idem | `src/pipeline/classify.ts` |
| Génération de l'exercice ciblé | idem | `src/pipeline/exercise.ts` |
| Garde-fou de pertinence (second passage) | idem | `src/pipeline/exercise.ts` |

Aucun OCR classique : la reconnaissance du manuscrit passe intégralement par le modèle multimodal.
Les prompts sont **versionnés** dans `prompts/` (extraction, classification, génération, garde-fou) :
ils font partie du produit au même titre que le code.

La clé d'API ne descend jamais dans le bundle : elle est portée par le proxy edge
(`api/analyze.ts`, variante `worker/worker.js`), ou par l'utilisateur en mode BYOK.

## 2. IA utilisée **pour le développement**

| Outil | Usage |
|---|---|
| Agents de codage ZeroClaw (b, et sous-agents) | Écriture du code TypeScript/React, des tests, de la configuration CI, de la documentation |
| Modèles via InferHub | Résolution automatique des conflits de rebase dans la file de merge (`.github/fireworks/conflict_agent.py`) |
| Agent de périmètre CI | Rédaction du bloc `## Scope` des PR à partir du diff |

Le dépôt a été initialisé **pendant la période du hackathon** (premier commit du 11 novembre 2026)
et aucun fichier ne provient d'un projet antérieur.

## 3. Part générée / part écrite

Le squelette, les contrats de données, la taxonomie, les règles de pondération du profil, le
garde-fou et les prompts ont été **décidés et spécifiés par l'auteur** ; leur mise en code a été
largement assistée par les agents cités ci-dessus. Estimation honnête : la majorité du volume de
code est assistée, la totalité des décisions de conception et des règles métier est humaine.

Ce qui n'est **pas** généré :

- la taxonomie des 12 types et ses signatures (`src/domain/taxonomy.ts`) ;
- les règles de pondération (seuil 0,6, `E99` exclue, `E11` à poids nul) ;
- le corpus de validation et la vérité terrain associée (`corpus/fixtures.ts`) ;
- la palette et le refus du rouge dans l'UI.

## 4. Capacité à démontrer

L'auteur peut expliquer chaque ligne du dépôt, chaque étape du pipeline, chaque règle du profil et
chaque prompt. Une démonstration complémentaire peut être faite en direct : le produit tourne en
local (`npm ci && npm run dev`), les 170 tests s'exécutent sans réseau ni quota (`npm test`), et le
corpus de démo permet de rejouer une analyse complète sans clé d'API.

## 5. Ce que le produit ne fait pas

Il ne note pas la copie, ne donne jamais la réponse de l'exercice d'origine, ne conserve aucune
image, et n'entraîne aucun modèle. C'est un outil de diagnostic et d'entraînement, pas un outil de
correction automatique.
