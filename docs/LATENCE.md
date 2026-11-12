# Latence de l’amont (relevé automatique)

Mesuré par `scripts/sonder-latence.mjs`, lancé chaque heure par `.github/workflows/latence.yml`.
Un **seconde** par appel, en série : on ne lance pas de rafale, qui fausserait la mesure et
saturerait l’amont.

Ce relevé sert à trois choses : choisir l’heure du tournage de la vidéo sur des données, prouver
la disponibilité pendant le jugement (RNF-08), et documenter honnêtement la contrainte
(l’amont est une place de marché : la latence varie d’un facteur 3 selon l’heure).

> Le fichier est versionné sur la branche `donnees/latence` : `main` est protégé par un
> ruleset (PR obligatoire), un push automatique y serait refusé.

## Synthèse sur 24 h

- Mesures : **8**
- Taux de disponibilité : **38 %**
- Latence médiane des appels réussis : **41.9 s**
- Modèle le plus fiable : **ag/gemini-3.8-flash-high (100 % de réussite sur 24 h)**

## Historique

| Horodatage (UTC) | Modèle | HTTP | Latence | Disponible |
| --- | --- | --- | --- | --- |
| 2026-11-12T14:24:48.001Z | `ag/gemini-3.8-flash-high` | 200 | 6.9 s s | oui |
| 2026-11-12T14:24:48.001Z | `ag/gemini-4-carbon` | 503 | 0.5 s s | non |
| 2026-11-12T14:44:38.454Z | `ag/gemini-4-carbon` | 503 | 1.0 s | non |
| 2026-11-12T14:44:38.454Z | `ag/claude-sonnet-4-6` | 200 | 2.6 s | oui |
| 2026-11-12T14:44:38.454Z | `ag/gemini-4-argon` | 503 | 0.3 s | non |
| 2026-11-12T14:44:38.454Z | `ag/claude-sonnet-5-5` | 503 | 0.4 s | non |
| 2026-11-12T14:44:38.454Z | `ag/gemini-3.8-flash-high` | 200 | 81.3 s | oui |
| 2026-11-12T14:44:38.454Z | `ag/claude-opus-4-6-thinking` | 503 | 0.7 s | non |

## Relevés manuels antérieurs au banc automatique

| Date | Modèle | Résultat |
| --- | --- | --- |
| 11/11 21 h | `ag/gemini-4-carbon` | 200 en 16 s |
| 11/11 21 h | `ag/claude-sonnet-4-6` | 200 en 16 s, puis 503 cinq minutes plus tard |
| 11/11 21 h | `ag/gemini-3.8-flash-high` | 200 en 45-52 s |
| 11/11 21 h | `ag/gemini-4-argon`, `ag/claude-sonnet-5-5`, `ag/claude-opus-4-6-thinking` | 503 |
| 11/11 21 h | `oai/gpt-5.4-mini`, `ali/deepseek-v4.1-flash` | 402 hors enchère |
| 11/11 21 h | `cbcn/glm-5.3-flash` | 403 désactivé dans les préférences du compte |
| 12/11 13 h | `ag/gemini-3.8-flash-high` | 200 en 56,7 s (5 tokens) |
| 12/11 13 h | `ag/gemini-4-carbon` | 503 |

