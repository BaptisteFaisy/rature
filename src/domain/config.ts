/** Réglages produit — un seul endroit pour les seuils du cahier des charges. */

/** §17 : en dessous de cette confiance, la faute est E99 et sort du profil. */
export const SEUIL_CONFIANCE = 0.6

/** §18.3 : deux tentatives maximum, puis message honnête. */
export const MAX_TENTATIVES_EXERCICE = 2

/**
 * Seconde passe (lot 3) : une faute typée avec une confiance inférieure à ce
 * seuil est revérifiée par un second appel, texte seul. Cible : les faux
 * positifs, le risque que la spec qualifie de fatal (RNF-04).
 */
export const SEUIL_REVUE = 0.75

/** Au-delà de ce nombre, on ne reverra que les moins sûres (latence bornée). */
export const MAX_FAUTES_A_REVOIR = 5

/**
 * Garde-fous d'entrée (crash test du 12/11) : un modèle peut rendre 10 000
 * annotations, des lignes de 100 Ko ou des confiances absurdes. Sans plafond,
 * l'UI gèle et le profil devient illisible. On borne, on ne refuse pas.
 */
export const MAX_ANNOTATIONS = 50
export const MAX_LONGUEUR_LIGNE = 300
export const MAX_LONGUEUR_TEXTE = 400

/**
 * Bornes d'un appel modèle (crash test du 12/11). Sans elles, un amont saturé
 * fait attendre 6 modèles × 90 s, soit 9 minutes, avant de rendre la main.
 *
 * Calibrage mesuré, pas deviné :
 *  - le proxy abandonne un appel amont à 90 s (`DELAI_MS` de `proxy/modal_app.py`) ;
 *  - le client attend un peu plus (100 s) pour que ce soit le **proxy** qui
 *    réponde 504 avec un message exploitable, plutôt qu'un avortement local ;
 *  - un appel texte de 5 tokens a mis 56,7 s le 12/11 à 13 h : un timeout à 60 s
 *    aurait coupé des appels légitimes.
 * Le budget global borne l'attente totale à ~2 tentatives dans le pire cas.
 */
/** Le cache local évite de repayer un appel pour une photo déjà analysée. */
export const CACHE_ACTIVE_PAR_DEFAUT = true

export const DELAI_APPEL_MS = 100_000
export const BUDGET_APPEL_MS = 200_000

/** §18.2 : budget total photo → résultat. */
export const BUDGET_PIPELINE_MS = 20_000

/** RF-01 : taille maximale acceptée avant normalisation. */
export const TAILLE_MAX_IMAGE_OCTETS = 10 * 1024 * 1024

/** Étape 1 : on normalise à 1600 px de large — assez pour le manuscrit, léger à envoyer. */
export const LARGEUR_CIBLE_IMAGE = 1600

/** Clés de stockage local (IndexedDB via idb-keyval). */
export const CLES = {
  diagnostics: 'rature/diagnostics',
  profil: 'rature/profil',
  reglages: 'rature/reglages',
  /** Préfixe du cache local des analyses (empreinte SHA-256 de l'image). */
  cache: 'rature/cache',
} as const

/**
 * Proxy edge. L'URL publique est injectée au build (`VITE_PROXY_URL`, posée
 * par le workflow pages.yml depuis la variable de dépôt `RATURE_PROXY_URL`) ;
 * en local, le repli same-origin `/api/analyze` reste valable. Aucune clé
 * n'entre dans le bundle : seule l'adresse du proxy.
 */
const proxyInjecte = (import.meta.env?.VITE_PROXY_URL as string | undefined)?.trim()
export const PROXY_PAR_DEFAUT = proxyInjecte || '/api/analyze'

/**
 * Modèle par défaut (InferHub, API [OI]-compatible). Choisi sur mesure
 * latence : `ag/gemini-4-carbon` répond en ~16 s là où `ag/gemini-3.8-flash-high`
 * en prend ~50 s (mesuré le 11 novembre sur les copies du corpus).
 */
export const MODELE_PAR_DEFAUT = 'ag/gemini-4-carbon'

/**
 * Chaîne de repli : InferHub est une place de marché, un modèle peut être sans
 * capacité (503) ou hors enchère (402) d'une minute à l'autre — mesuré le
 * 11 novembre : 5 des 6 modèles vision en 503 simultanément, le sixième
 * répondait. On descend donc toute la famille `ag/` (la seule qui réponde sans
 * paramètre d'enchère) avant de rendre la main.
 *
 * Ordre : du plus rapide au plus lent (16 s → 50 s sur une copie du corpus).
 */
export const CHAINE_MODELES = [
  'ag/gemini-4-carbon',
  'ag/claude-sonnet-4-6',
  'ag/gemini-4-argon',
  'ag/claude-sonnet-5-5',
  'ag/gemini-3.8-flash-high',
  // zai/glm-4.6v : vision pas chère (0,0003 USDC/Mtok), famille « Z.AI GLM Coding
  // Plan » autorisée par le compte InferHub (les familles ali/ oai/ cb/ cc/ sont
  // filtrées par « Models & pricing » — voir docs/INFERHUB.md).
  'zai/glm-4.6v',
  'ag/claude-opus-4-6-thinking',
]

/** Amont [OI]-compatible utilisé par le proxy edge. */
export const AMONT_PAR_DEFAUT = 'https://api.inferhub.dev/v1'
