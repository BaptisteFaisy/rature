/**
 * Client LLM — API [OI]-compatible servie par InferHub.
 *
 * Deux chemins, une seule forme de requête :
 *  - proxy edge (défaut) : `/api/analyze`, la clé InferHub reste côté serveur ;
 *  - BYOK : la clé de l'utilisateur part dans l'en-tête `x-rature-cle`, le proxy
 *    l'utilise à la place de la sienne (filet de sécurité du jour du jugement).
 *
 * Aucun secret ici : ce module tourne dans le navigateur, sans clé embarquée.
 */
import { CHAINE_MODELES, MODELE_PAR_DEFAUT, PROXY_PAR_DEFAUT } from '../domain/config'

export type RequeteLLM = {
  system: string
  user: string
  /** Image en data URL (base64) — jamais persistée, jamais journalisée. */
  image?: string
  /** force une réponse JSON stricte côté modèle. */
  json?: boolean
  temperature?: number
  maxTokens?: number
}

export type Transport = {
  proxy: string
  cle?: string
  modele?: string
}

export type ReponseProxy = {
  texte?: string
  erreur?: string
  /** `proxy` = quota du proxy partagé (le BYOK est le seul recours). */
  quota?: string
}

export class ErreurLLM extends Error {
  readonly statut: number
  /** true quand c'est le quota du proxy partagé : le seul recours est le BYOK. */
  readonly quotaProxy: boolean
  constructor(message: string, statut = 0, quotaProxy = false) {
    super(message)
    this.name = 'ErreurLLM'
    this.statut = statut
    this.quotaProxy = quotaProxy
  }
}

export function transportParDefaut(proxy = PROXY_PAR_DEFAUT): Transport {
  return { proxy, modele: MODELE_PAR_DEFAUT }
}

type Partie =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export function construireMessages(requete: RequeteLLM): unknown[] {
  const parties: Partie[] = []
  if (requete.image) parties.push({ type: 'image_url', image_url: { url: requete.image } })
  parties.push({ type: 'text', text: requete.user })

  return [
    { role: 'system', content: requete.system },
    {
      role: 'user',
      // Texte seul : forme simple, acceptée par tous les modèles.
      content: requete.image ? parties : requete.user,
    },
  ]
}

export function construireCorps(requete: RequeteLLM, modele: string): Record<string, unknown> {
  const corps: Record<string, unknown> = {
    model: modele,
    messages: construireMessages(requete),
    temperature: requete.temperature ?? 0.2,
    max_tokens: requete.maxTokens ?? 2000,
  }
  if (requete.json) corps.response_format = { type: 'json_object' }
  return corps
}

/** Chaîne essayée : le modèle demandé d'abord, puis les replis connus. */
export function chaineModeles(transport: Transport): string[] {
  const premier = transport.modele?.trim() || MODELE_PAR_DEFAUT
  return [premier, ...CHAINE_MODELES.filter((modele) => modele !== premier)]
}

/**
 * Statuts transitoires : 402 (hors enchère), 429 (débit), 5xx (pas de capacité,
 * amont lent ou injoignable). Sur l'un d'eux on descend la chaîne de modèles.
 */
const REESSAYABLES = new Set([402, 429, 500, 502, 503, 504])
const ATTENTE_429_MS = 2500

function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms))
}

/** Un appel, un modèle, un texte. Toute erreur devient ErreurLLM + statut. */
async function appeler(transport: Transport, requete: RequeteLLM, modele: string): Promise<string> {
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  if (transport.cle) entetes['x-rature-cle'] = transport.cle

  let reponse: Response
  try {
    reponse = await fetch(transport.proxy, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify(construireCorps(requete, modele)),
    })
  } catch {
    throw new ErreurLLM('Réseau indisponible. Vérifie ta connexion puis réessaie.', 0)
  }

  // `await` indispensable : sans lui on lèverait une Promesse, pas une erreur —
  // donc ni repli sur le modèle suivant, ni message lisible (bug du 11/11).
  if (!reponse.ok) throw await erreurDepuisReponse(reponse)

  // Un corps non-JSON (page d'erreur d'un hébergeur, proxy qui rend du HTML)
  // ne doit pas fuir en SyntaxError : on traduit en ErreurLLM exploitable.
  let data: ReponseProxy
  try {
    data = (await reponse.json()) as ReponseProxy
  } catch {
    throw new ErreurLLM('Réponse du proxy illisible (JSON attendu).', 502)
  }
  const texte = typeof data.texte === 'string' ? data.texte : ''
  if (texte.trim().length === 0) throw new ErreurLLM('Réponse vide du modèle.', 502)
  return texte
}

/** Le proxy renvoie `{erreur, quota?}` : on affiche son message, pas un générique. */
async function erreurDepuisReponse(reponse: Response): Promise<ErreurLLM> {
  let data: ReponseProxy = {}
  try {
    data = (await reponse.json()) as ReponseProxy
  } catch {
    data = {}
  }
  if (reponse.status === 429) {
    // Quota du proxy partagé : la clé de l'utilisateur est le seul recours.
    if (data.quota === 'proxy') {
      return new ErreurLLM(
        `${data.erreur || 'Quota du proxy atteint.'} Colle ta propre clé dans Réglages, ou réessaie plus tard.`,
        429,
        true,
      )
    }
    // Limite de débit du fournisseur : transitoire, on réessaie après une pause.
    return new ErreurLLM(data.erreur || 'Limite de débit du fournisseur de modèles.', 429)
  }
  const message = data.erreur || `Analyse refusée (HTTP ${reponse.status}).`
  return new ErreurLLM(message, reponse.status)
}

/** Un 429 « fournisseur » mérite une seconde chance après une courte pause. */
async function appelerAvecPause(
  transport: Transport,
  requete: RequeteLLM,
  modele: string,
): Promise<string> {
  try {
    return await appeler(transport, requete, modele)
  } catch (erreur) {
    if (!(erreur instanceof ErreurLLM) || erreur.statut !== 429 || erreur.quotaProxy) throw erreur
    await attendre(ATTENTE_429_MS)
    return appeler(transport, requete, modele)
  }
}

/**
 * InferHub est une place de marché : un modèle peut être sans capacité (503) ou
 * hors enchère (402) à l'instant de l'appel — mesuré le 11 novembre : 5 des 6
 * modèles vision en 503 simultanément. On descend donc toute la chaîne avant de
 * rendre la main. Seule exception : le quota du proxy partagé, où changer de
 * modèle ne change rien (le recours est la clé personnelle).
 */
export async function completer(transport: Transport, requete: RequeteLLM): Promise<string> {
  let derniere: ErreurLLM | null = null
  for (const modele of chaineModeles(transport)) {
    try {
      return await appelerAvecPause(transport, requete, modele)
    } catch (erreur) {
      if (!(erreur instanceof ErreurLLM)) throw erreur
      if (erreur.quotaProxy || !REESSAYABLES.has(erreur.statut)) throw erreur
      derniere = erreur
    }
  }
  throw derniere ?? new ErreurLLM('Aucun modèle disponible pour le moment.', 503)
}

/** Extrait le premier objet JSON d'un texte (le modèle encadre parfois). */
export function extraireJson(texte: string): unknown {
  const direct = tentativeParse(texte)
  if (direct !== undefined) return direct
  const debut = texte.indexOf('{')
  const fin = texte.lastIndexOf('}')
  if (debut >= 0 && fin > debut) {
    const interne = tentativeParse(texte.slice(debut, fin + 1))
    if (interne !== undefined) return interne
  }
  throw new ErreurLLM('Le modèle a répondu hors format JSON.', 502)
}

function tentativeParse(texte: string): unknown {
  try {
    return JSON.parse(texte)
  } catch {
    return undefined
  }
}
