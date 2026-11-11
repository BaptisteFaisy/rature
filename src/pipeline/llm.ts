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
import { MODELE_PAR_DEFAUT, PROXY_PAR_DEFAUT } from '../domain/config'

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

export type ReponseProxy = { texte: string }

export class ErreurLLM extends Error {
  readonly statut: number
  constructor(message: string, statut = 0) {
    super(message)
    this.name = 'ErreurLLM'
    this.statut = statut
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

/** Un appel, un texte. Toute erreur devient ErreurLLM avec son statut HTTP. */
export async function completer(transport: Transport, requete: RequeteLLM): Promise<string> {
  const modele = transport.modele ?? MODELE_PAR_DEFAUT
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

  if (reponse.status === 429) {
    throw new ErreurLLM(
      "Quota d'analyse atteint. Colle ta propre clé dans Réglages, ou réessaie plus tard.",
      429,
    )
  }
  if (!reponse.ok) {
    throw new ErreurLLM(`Analyse refusée (HTTP ${reponse.status}). Réessaie dans un instant.`, reponse.status)
  }

  const data = (await reponse.json()) as ReponseProxy
  const texte = typeof data.texte === 'string' ? data.texte : ''
  if (texte.trim().length === 0) throw new ErreurLLM('Réponse vide du modèle.', 502)
  return texte
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
