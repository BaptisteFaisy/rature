# InferHub — diagnostic du compte et leviers

Source : recherche en direct du 12/11 sur <https://inferhub.dev> (homepage, `/docs/api`, `/pricing`)
et l'API de gestion `https://inferhub.dev/api` (avec la clé).

## Ce qu'est InferHub

Une **place de marché** d'inférence : des éditeurs proposent leurs modèles (Claude, Codex,
GLM, DeepSeek, Qwen…) à un prix « ask » en USDC par million de tokens ; le consommateur appelle
**une seule API** [OI]-/Anthropic-compatible (`https://api.inferhub.dev/v1`) et est routé vers le
fournisseur le moins cher qui a de la capacité. Une clé = deux protocoles (`/v1/chat/completions`,
`/v1/messages`), plus une **API de gestion** (`GET /api/me`, `/api/keys`, `/api/budgets`,
`/api/catalog`, `/api/market`).

## État de notre compte (mesuré le 12/11)

| Élément | Valeur |
|---|---|
| Solde consommateur | **22,83 USDC** |
| Clés | `app` (sk-airo-4pKV…), `mac-opencode`, `essec`, `duello`, … — aucune n'a de restriction `allowedUpstreams`/`allowedModels` |
| Modèles qui passent | famille **`ag/`** (Antigravity, première partie) + famille **`zai/`** (Z.AI GLM Coding Plan) |
| Modèles qui échouent | `ali/`, `oai/`, `cb/`, `cc/`, `cbc`… → `402 no_provider_under_bid` ou `403 model disabled in your preferences` |

## Pourquoi les autres familles renvoient 402/403

Le catalogue public liste 287 modèles, mais l'ensemble effectif de la clé vaut :

    réglages « Models & pricing » du compte  ∩  budgets  ∩  allowlist de la clé

Or le compte applique un **seuil de remise** (`minDiscountPct ≈ 98,90` dans `/api/budgets`) et
un **prix maximal** par jeton : les modèles dont l'ask dépasse ce plafond sont renvoyés en
`402 no_provider_under_bid`. Les `ag/*` (remisés à ~99 %) et les `zai/*` passent ; les autres non.

> L'en-tête `x-max-input-price` / `x-max-output-price` **ne remplace pas** ce plafond de compte :
> testé à 0,5 / 3 USDC → toujours 402. C'est le plafond du compte qui est contraignant.

## Les deux leviers pour débloquer ~200 modèles de plus

1. **Dashboard** → *Models & pricing* (ou *Budgets*) : relever le prix maximal accepté, ou activer
   les familles voulues (Ali Qwen, OpenAI, CodeBuddy…).
2. **API** : `PUT /api/budgets/{id}` avec `maxInputPerMtok` / `maxOutputPerMtok` / `enabled`.
   (Voir « Common endpoints › Routing › `PUT /api/budgets/{id}` » dans `/docs/api`.)

## Modèles vision intéressants, classés par prix d'entrée (au marché)

| Modèle | Famille | minAsk in (USDC/Mtok) | Autorisé aujourd'hui |
|---|---|---|---|
| `zai/glm-4.6v` | Z.AI GLM | **0,0003** | ✅ (déjà ajouté à notre chaîne) |
| `ag/gemini-3.8-flash-high` | Antigravity | 0,00075 | ✅ |
| `ali/qwen3.8-27b` | Qwencloud | 0,0035 | ❌ 402 |
| `cb/minimax-m3.1-flash` | CodeBuddy | 0,00555 | ❌ 503 (capacité) |
| `ali/deepseek-v4.1-flash` | Qwencloud | 0,0147 | ❌ 402 |

`zai/glm-4.6v` (vision, ~0,0003/Mtok) est **déjà utilisable** avec la clé actuelle : il a été
ajouté à la chaîne de repli du produit (`src/domain/config.ts`) et du proxy. Mesuré le 12/11 :
familie autorisée mais **capacité souvent saturée** (429 « 168 providers at concurrency limit ») —
ce que la chaîne + le disjoncteur absorbent.

## Ce que le produit en fait déjà (aucune de ces idées n'exige de quitter InferHub)

- **Chaîne de repli (serveur + client)** : un 402/503/429 passe au modèle suivant.
- **Disjoncteur** : un modèle en panne est mis en cooldown 60 s côté proxy.
- **Combo natif** : InferHub propose des modèles virtuels `combo/<slug>` qui font exactement ce
  failover, budget-aware. Piste à explorer (`POST /api/combos`) — remplacerait notre chaîne
  maison par un nom de modèle unique, si un combo vision existe.
- **`free/<slug>/<model>`** : modèles gratuits (best-effort) — `GET /api/catalog` pour les lister.

## Recommandation pour le jour J

Le soir, `ag/*` suffit (16 s mesurés). En journée, la saturation est globale : **les 2 leviers
ci-dessus (dashboard) sont le seul moyen de multiplier la capacité** sans quitter InferHub.