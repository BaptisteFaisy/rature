/** Réglages produit — un seul endroit pour les seuils du cahier des charges. */

/** §17 : en dessous de cette confiance, la faute est E99 et sort du profil. */
export const SEUIL_CONFIANCE = 0.6

/** §18.3 : deux tentatives maximum, puis message honnête. */
export const MAX_TENTATIVES_EXERCICE = 2

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
} as const

/** Proxy edge par défaut : même origine, aucun secret dans le bundle. */
export const PROXY_PAR_DEFAUT = '/api/analyze'

/**
 * Modèle par défaut (InferHub, API [OI]-compatible). Flash multimodal : la
 * lecture du manuscrit et le raisonnement en un seul appel (§18.4).
 */
export const MODELE_PAR_DEFAUT = 'ag/gemini-3.8-flash-high'

/** Amont [OI]-compatible utilisé par le proxy edge. */
export const AMONT_PAR_DEFAUT = 'https://api.inferhub.dev/v1'
