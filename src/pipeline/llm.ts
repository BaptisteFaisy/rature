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

/** Chaîne essayée : le modèle demandé d'abord, puis les replis connus. */
export function chaineModeles(transport: Transport): string[] {
  const premier = transport.modele?.trim() || MODELE_PAR_DEFAUT
  return [premier, ...CHAINE_MODELES.filter((modele) => modele !== premier)]
}

/** 402 (hors enchère) et 503 (pas de capacité) sont transitoires : on tente le suivant. */
const REESSAYABLES = new Set([402, 500, 502, 503, 504])
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

  if (!reponse.ok) throw erreurDepuisReponse(reponse)

  const data = (await reponse.json()) as ReponseProxy
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
        data.erreur || "Quota du proxy atteint. Colle ta propre clé dans Réglages, ou réessaie plus tard.",
        429,
      )
    }
    // Limite de débit du fournisseur : transitoire, on réessaie après une pause.
    return new ErreurLLM(data.erreur || 'Limite de débit du fournisseur de modèles.', 429)
  }
  const message = data.erreur || `Analyse refusée (HTTP ${reponse.status}).`
  return new ErreurLLM(message, reponse.status)
}

/**
 * InferHub est une place de marché : un modèle peut être sans capacité ou hors
 * enchère à l'instant de l'appel. On descend la chaîne avant de rendre la main.
 * Un 429 « fournisseur » se tente une seconde fois après une courte pause, puis
 * passe au modèle suivant ; un 429 « quota du proxy » remonte directement.
 */
export async function completer(transport: Transport, requete: RequeteLLM): Promise<string> {
  let derniere: ErreurLLM | null = null
  for (const modele of chaineModeles(transport)) {
    for (const essai of [1, 2]) {
      try {
        return await appeler(transport, requete, modele)
      } catch (erreur) {
        if (!(erreur instanceof ErreurLLM)) throw erreur
        if (erreur.statut !== 429 && !REESSAYABLES.has(erreur.statut)) throw erreur
        if (erreur.message.includes('Colle ta propre clé')) throw erreur
        if (erreur.statut === 429 && essai === 2) {
          derniere = erreur
          break
        }
        if (erreur.statut === 429) await attendre(ATTENTE_429_MS)
        derniere = erreur
      }
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
