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
import {
  BUDGET_APPEL_MS,
  CHAINE_MODELES,
  DELAI_APPEL_MS,
  MODELE_PAR_DEFAUT,
  PROXY_PAR_DEFAUT,
} from '../domain/config'

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
  /** true = le proxy répond en SSE et publie sa progression (idée 7). */
  stream?: boolean
  /** Prévenu à chaque étape du proxy : « modèle 2/6 essayé, 503 ». */
  surProgres?: (message: string) => void
  /** Prévenu quand un modèle a réellement répondu (transparence à l'écran). */
  surModele?: (modele: string, tentatives: number) => void
  /** Chaîne réordonnée par la sonde de disponibilité (idée 5). */
  chaine?: string[]
}

export type ReponseProxy = {
  texte?: string
  erreur?: string
  /** `proxy` = quota du proxy partagé (le BYOK est le seul recours). */
  quota?: string
  /** Modèle qui a réellement répondu (le proxy descend sa propre chaîne). */
  modele?: string
  tentatives?: number
  /** Le proxy a déjà épuisé sa chaîne : inutile de rejouer la nôtre. */
  chaineEpuisee?: boolean
}

export class ErreurLLM extends Error {
  readonly statut: number
  /** true quand c'est le quota du proxy partagé : le seul recours est le BYOK. */
  readonly quotaProxy: boolean
  /** true quand le proxy a déjà descendu toute sa chaîne : on ne rejoue pas la nôtre. */
  readonly chaineEpuisee: boolean
  constructor(message: string, statut = 0, options: { quotaProxy?: boolean; chaineEpuisee?: boolean } = {}) {
    super(message)
    this.name = 'ErreurLLM'
    this.statut = statut
    this.quotaProxy = options.quotaProxy ?? false
    this.chaineEpuisee = options.chaineEpuisee ?? false
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

/**
 * Chaîne essayée : le modèle demandé d'abord, puis les replis. Si une sonde de
 * disponibilité a réordonné la chaîne (`transport.chaine`), c'est elle qui prime.
 */
export function chaineModeles(transport: Transport): string[] {
  const premier = transport.modele?.trim() || MODELE_PAR_DEFAUT
  const suite = transport.chaine?.length ? transport.chaine : CHAINE_MODELES
  return [premier, ...suite.filter((modele) => modele !== premier)]
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

/** Un événement SSE : `event: nom` + `data: {…}`. */
type EvenementFlux = { nom: string; donnees: Record<string, unknown> }

function parserEvenement(brut: string): EvenementFlux | null {
  let nom = 'message'
  let donnees = ''
  for (const ligne of brut.split('\n')) {
    if (ligne.startsWith('event:')) nom = ligne.slice(6).trim()
    else if (ligne.startsWith('data:')) donnees += ligne.slice(5).trim()
  }
  if (!donnees) return null
  try {
    return { nom, donnees: JSON.parse(donnees) as Record<string, unknown> }
  } catch {
    return null
  }
}

/** Message lisible pour l'écran d'analyse : on dit ce que le proxy essaie. */
export function messageProgres(donnees: Record<string, unknown>): string {
  const modele = typeof donnees.modele === 'string' ? donnees.modele.split('/').pop() : 'modèle'
  const essai = typeof donnees.essai === 'number' ? donnees.essai : 0
  const statut = donnees.statut ?? '?'
  return `${modele} indisponible (${statut}) — essai ${essai}, modèle suivant…`
}

/**
 * Appel en flux (SSE) : le proxy publie chaque tentative pendant que l'amont
 * réfléchit. Sans ça, l'élève regarde un spinner pendant 30 à 60 s ; avec, il
 * voit la chaîne de repli travailler — l'attente devient une démonstration.
 */
async function appelerEnFlux(transport: Transport, requete: RequeteLLM, modele: string): Promise<string> {
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  if (transport.cle) entetes['x-rature-cle'] = transport.cle

  let reponse: Response
  try {
    reponse = await fetch(transport.proxy, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ ...construireCorps(requete, modele), stream: true }),
      signal: AbortSignal.timeout(DELAI_APPEL_MS),
    })
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === 'TimeoutError') {
      throw new ErreurLLM('Le modèle met trop de temps à répondre.', 504)
    }
    throw new ErreurLLM('Réseau indisponible. Vérifie ta connexion puis réessaie.', 0)
  }
  if (!reponse.ok) throw await erreurDepuisReponse(reponse)

  const type = reponse.headers.get('content-type') ?? ''
  // Un proxy qui ne parle pas SSE : on retombe sur le chemin JSON classique.
  if (!type.includes('text/event-stream') || !reponse.body) return lireCorpsJson(reponse, transport)
  return lireFlux(reponse, transport)
}

async function lireFlux(reponse: Response, transport: Transport): Promise<string> {
  const lecteur = reponse.body!.getReader()
  const decodeur = new TextDecoder()
  let tampon = ''
  let texte = ''
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    tampon += decodeur.decode(value, { stream: true })
    let separateur = tampon.indexOf('\n\n')
    while (separateur >= 0) {
      const evenement = parserEvenement(tampon.slice(0, separateur))
      tampon = tampon.slice(separateur + 2)
      separateur = tampon.indexOf('\n\n')
      if (!evenement) continue
      if (evenement.nom === 'progres') {
        transport.surProgres?.(messageProgres(evenement.donnees))
      } else if (evenement.nom === 'resultat') {
        texte = String(evenement.donnees.texte ?? '')
        if (typeof evenement.donnees.modele === 'string') {
          transport.surModele?.(evenement.donnees.modele, Number(evenement.donnees.tentatives ?? 1))
        }
      } else if (evenement.nom === 'erreur') {
        throw new ErreurLLM(
          String(evenement.donnees.erreur ?? 'Amont indisponible.'),
          Number(evenement.donnees.statut ?? 503),
          { chaineEpuisee: true },
        )
      }
    }
  }
  if (!texte.trim()) throw new ErreurLLM('Réponse vide du modèle.', 502)
  return texte
}

async function lireCorpsJson(reponse: Response, transport: Transport): Promise<string> {
  let data: ReponseProxy
  try {
    data = (await reponse.json()) as ReponseProxy
  } catch {
    throw new ErreurLLM('Réponse du proxy illisible (JSON attendu).', 502)
  }
  const texte = typeof data.texte === 'string' ? data.texte : ''
  if (texte.trim().length === 0) throw new ErreurLLM('Réponse vide du modèle.', 502)
  if (typeof data.modele === 'string' && data.modele) {
    transport.surModele?.(data.modele, data.tentatives ?? 1)
  }
  return texte
}

/** Un appel, un modèle, un texte. Toute erreur devient ErreurLLM + statut. */
async function appeler(transport: Transport, requete: RequeteLLM, modele: string): Promise<string> {
  if (transport.stream) return appelerEnFlux(transport, requete, modele)
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  if (transport.cle) entetes['x-rature-cle'] = transport.cle

  let reponse: Response
  try {
    reponse = await fetch(transport.proxy, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify(construireCorps(requete, modele)),
      signal: AbortSignal.timeout(DELAI_APPEL_MS),
    })
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === 'TimeoutError') {
      throw new ErreurLLM('Le modèle met trop de temps à répondre.', 504)
    }
    throw new ErreurLLM('Réseau indisponible. Vérifie ta connexion puis réessaie.', 0)
  }

  // `await` indispensable : sans lui on lèverait une Promesse, pas une erreur —
  // donc ni repli sur le modèle suivant, ni message lisible (bug du 11/11).
  if (!reponse.ok) throw await erreurDepuisReponse(reponse)

  // Un corps non-JSON (page d'erreur d'un hébergeur, proxy qui rend du HTML)
  // ne doit pas fuir en SyntaxError : on traduit en ErreurLLM exploitable.
  return lireCorpsJson(reponse, transport)
}

/** Le proxy renvoie `{erreur, quota?}` : on affiche son message, pas un générique. */
async function erreurDepuisReponse(reponse: Response): Promise<ErreurLLM> {
  let data: ReponseProxy = {}
  try {
    data = (await reponse.json()) as ReponseProxy
  } catch {
    data = {}
  }
  const chaineEpuisee = data.chaineEpuisee === true
  if (reponse.status === 429) {
    // Quota du proxy partagé : la clé de l'utilisateur est le seul recours.
    if (data.quota === 'proxy') {
      return new ErreurLLM(
        `${data.erreur || 'Quota du proxy atteint.'} Colle ta propre clé dans Réglages, ou réessaie plus tard.`,
        429,
        { quotaProxy: true },
      )
    }
    // Limite de débit du fournisseur : transitoire, on réessaie après une pause.
    return new ErreurLLM(data.erreur || 'Limite de débit du fournisseur de modèles.', 429)
  }
  const message = data.erreur || `Analyse refusée (HTTP ${reponse.status}).`
  return new ErreurLLM(message, reponse.status, { chaineEpuisee })
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
  let arreteeParBudget = false
  const echeance = Date.now() + BUDGET_APPEL_MS
  for (const modele of chaineModeles(transport)) {
    if (Date.now() > echeance) {
      arreteeParBudget = true
      break
    }
    try {
      return await appelerAvecPause(transport, requete, modele)
    } catch (erreur) {
      if (!(erreur instanceof ErreurLLM)) throw erreur
      // Le proxy a déjà descendu toute sa chaîne : rejouer la nôtre ne ferait
      // que multiplier les allers-retours pour le même résultat.
      if (erreur.quotaProxy || erreur.chaineEpuisee || !REESSAYABLES.has(erreur.statut)) throw erreur
      derniere = erreur
    }
  }
  if (arreteeParBudget) {
    throw new ErreurLLM(
      "L'amont met trop de temps à répondre. Réessaie dans quelques minutes, ou lance la démonstration.",
      504,
    )
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
