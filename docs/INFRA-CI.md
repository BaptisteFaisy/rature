# Infra CI de Raturé — runners, file Mergify, agents en cas de conflit

> Fiche d'exploitation. Ce dépôt n'a **aucune** machine dédiée : ses runners
> sont quatre runners self-hosted qui ne servaient plus ailleurs, déplacés ici
> le 2026-11-11 (voir §1). La CI rend son verdict en moins de 5 minutes.

## 1. Les runners viennent d'ailleurs (déplacement, pas création)

Le r630 était à **91 % de disque** : créer des runners neufs (≈ 5 Go chacun)
était exclu. On a donc **déplacé** des runners existants avec
`deplace-runner.sh` (kit `repo-bootstrap`), qui réutilise le dossier
(réenregistrement seul, `_work/` vidé, symlinks réparés).

| Runner | Origine | État d'origine | Cible |
|---|---|---|---|
| `r630-rature-01` | `actions-runner-stable-01` | dépôt `stable` **supprimé** → enregistrement orphelin | `r630-rature-01` |
| `r630-rature-02` | `actions-runner-stable-02` | idem | `r630-rature-02` |
| `r630-rature-03` | `actions-runner-near_tidewater-01` | dépôt sans PR ouverte, dernier run à 14:57 | `r630-rature-03` |
| `r630-rature-04` | `actions-runner-deja-vu-ci-01` | dépôt sans PR ouverte, dernier run à 15:25 | `r630-rature-04` |

Labels : `self-hosted`, `Linux`, `X64`, `rature-worker`, `ci-node`.
Services : unités systemd **utilisateur** `actions-runner-rature-0N.service`
(`Restart=always`), donc pas de `sudo` nécessaire.

Vérifier l'état :

```bash
gh api repos/BaptisteFaisy/rature/actions/runners \
  --jq '[.runners[] | select(.status=="online")] | length'   # attendu : 4
systemctl --user status actions-runner-rature-01.service
```

## 2. Ce que la CI exige (trois checks, pas un de plus)

| Check | Rôle | Budget |
|---|---|---|
| `ci` | typecheck strict, tests, build, taille des fichiers/fonctions, tests des gardes | ≤ 5 min |
| `ci-budget` | garde-fou de configuration : aucun job ne déclare plus de 5 min | quelques secondes |
| `couche0` | périmètre déclaré (`## Scope` en puces) + motifs interdits (pas de secret, pas de push forcé) | ~17 s |

Le ruleset de `main` impose une PR, un historique linéaire et ces trois
checks ; `enforce_admins` équivalent via le ruleset, donc **aucun push direct**,
même pour un agent.

## 3. File Mergify

`.mergify.yml` : `queue_rules.default` (les 3 checks verts, pas de conflit, pas
de brouillon, base `main`), `merge_method: rebase`, lots de 1 à 3,
`max_parallel_checks: 2` pour quatre workers. Le produit *Merge Queue* est
activé par API (`PUT /v1/products/BaptisteFaisy/rature` → 204) et
`merge_protections` avec `auto_merge_conditions: true`, donc une PR verte
s'embarque **sans commentaire**.

Frein manuel : étiquette `hold` (à poser sur la PR). Priorités : `urgent` /
`priority-low`.

## 4. Agents en cas de conflit — sur InferHub

Le balayeur `pr-auto-merge` traite les PR `DIRTY` (conflit) et `BEHIND`
(retard) : rebase, et si le rebase bute sur un conflit, il appelle
`.github/fireworks/conflict_agent.py` (résolution conflit par conflit, porte de
compilation avant push, `quota.py` pour borner les saisines).

Ces agents sont **branchés sur InferHub** (API [OI]-compatible), pas sur un
fournisseur tiers :

| Réglage | Valeur |
|---|---|
| secret `FIREWORKS_API_KEY` | clé InferHub |
| variable `FIREWORKS_BASE_URL` | `https://api.inferhub.dev/v1/chat/completions` |
| variable `FIREWORKS_MODEL` | `ag/gemini-3.8-flash-high` |
| variable `FIREWORKS_AGENT_RESOLVE` | `1` (coupe-circuit : `0`) |

Le nom `fireworks` est historique (le code et ses tests datent de ce
fournisseur) ; seul l'amont change, le contrat HTTP est celui d'InferHub.

Le même modèle sert au produit lui-même (`src/domain/config.ts`), mais par le
proxy edge, avec une clé qui ne descend **jamais** dans le bundle.

## 5. Déploiement

`pages.yml` construit la webapp et la publie sur GitHub Pages (déploiement vérifié le 11 novembre, 6db57e8)
(`https://baptistefaisy.github.io/rature/`) à chaque push sur `main` — public,
HTTPS, gratuit, sans jeton. La clé InferHub n'y est pas : le site parle au
proxy edge (`/api/analyze`, voir `api/analyze.ts` et la variante
`worker/worker.js`) ou, à défaut, en **BYOK** (l'utilisateur colle sa clé) ou
en **mode démo** (réponses enregistrées sur le corpus).
