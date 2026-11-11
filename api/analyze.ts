/**
 * Proxy edge — la clé InferHub ne descend jamais dans le bundle.
 *
 * Contrat : POST {model, messages, …} → relayé tel quel à l'amont
 * [OI]-compatible ; réponse {texte}. Erreurs → {erreur} + statut HTTP.
 *
 * Confidentialité (RNF-P3) : on ne journalise QUE l'horodatage, le statut et
 * la latence. Jamais l'image, jamais le texte extrait, jamais la clé, jamais
 * l'IP en clair (elle sert uniquement de clé de quota, en mémoire).
 */
import { creerQuota } from './_quota'

declare const process: { env: Record<string, string | undefined> }

type Entetes = Record<string, string | string[] | undefined>

type Requete = {
  method?: string
  headers: Entetes
  on?: (evenement: string, ecouteur: (donnees?: unknown) => void) => void
}

type Reponse = {
  statusCode: number
  setHeader: (nom: string, valeur: string) => void
  end: (corps?: string) => void
}

/** bodyParser désactivé : on lit le flux brut, on ne garde rien en mémoire côté Vercel. */
export const config = { api: { bodyParser: false } }

const TAILLE_MAX_OCTETS = 15 * 1024 * 1024
const decodeur = new TextDecoder()
const DELAI_MS = 60_000
const quota = creerQuota()

function amont(): string {
  return process.env.RATURE_AMONT ?? 'https://api.inferhub.dev/v1'
}

function entete(req: Requete, nom: string): string {
  const valeur = req.headers[nom] ?? req.headers[nom.toLowerCase()]
  return Array.isArray(valeur) ? (valeur[0] ?? '') : (valeur ?? '')
}

/** Clé de quota : empreinte de l'IP, jamais l'IP elle-même dans les journaux. */
function identifiantVisiteur(req: Requete): string {
  const brute = entete(req, 'x-forwarded-for').split(',')[0]?.trim() || 'inconnu'
  let empreinte = 0
  for (let i = 0; i < brute.length; i += 1) empreinte = (empreinte * 31 + brute.charCodeAt(i)) >>> 0
  return `v${empreinte.toString(36)}`
}

async function lireCorps(req: Requete): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: string[] = []
    let taille = 0
    req.on?.('data', (donnees) => {
      const texte = typeof donnees === 'string' ? donnees : decodeur.decode(donnees as Uint8Array, { stream: true })
      taille += texte.length
      if (taille > TAILLE_MAX_OCTETS) {
        rejeter(new ErreurHttp('Photo trop lourde (15 Mo max après encodage).', 413))
        return
      }
      morceaux.push(texte)
    })
    req.on?.('end', () => resoudre(morceaux.join('')))
    req.on?.('error', () => rejeter(new ErreurHttp('Lecture du corps interrompue.', 400)))
  })
}

class ErreurHttp extends Error {
  readonly statut: number
  constructor(message: string, statut: number) {
    super(message)
    this.statut = statut
  }
}

function repondre(res: Reponse, statut: number, corps: unknown, debut: number): void {
  res.statusCode = statut
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(corps))
  // Seul journal autorisé : horodatage, statut, latence.
  console.info(`${new Date().toISOString()} ${statut} ${Date.now() - debut}ms`)
}

function extraireTexte(data: unknown): string {
  const choix = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
  return choix?.message?.content ?? ''
}

export default async function handler(req: Requete, res: Reponse): Promise<void> {
  const debut = Date.now()
  res.setHeader('access-control-allow-origin', entete(req, 'origin') || '*')
  res.setHeader('access-control-allow-headers', 'content-type, x-rature-cle')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return repondre(res, 204, {}, debut)
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'Méthode non autorisée.' }, debut)

  const cle = entete(req, 'x-rature-cle').trim() || process.env.INFERHUB_API_KEY || ''
  if (!cle) return repondre(res, 503, { erreur: 'Proxy non configuré : colle ta clé dans Réglages (BYOK).' }, debut)

  const visiteur = identifiantVisiteur(req)
  if (!quota.autoriser(visiteur, Date.now())) {
    return repondre(res, 429, { erreur: "Quota d'analyse atteint. Réessaie plus tard ou utilise ta propre clé." }, debut)
  }

  let corps: string
  try {
    corps = await lireCorps(req)
  } catch (erreur) {
    return repondre(res, erreur instanceof ErreurHttp ? erreur.statut : 400, { erreur: 'Corps illisible.' }, debut)
  }

  try {
    const reponse = await fetch(`${amont()}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cle}` },
      body: corps,
      signal: AbortSignal.timeout(DELAI_MS),
    })
    const data = await reponse.json()
    if (!reponse.ok) {
      const message = (data as { error?: { message?: string } })?.error?.message ?? 'Amont indisponible.'
      return repondre(res, reponse.status, { erreur: message }, debut)
    }
    const texte = extraireTexte(data)
    if (!texte) return repondre(res, 502, { erreur: 'Réponse vide du modèle.' }, debut)
    return repondre(res, 200, { texte }, debut)
  } catch (erreur) {
    const delai = erreur instanceof Error && erreur.name === 'TimeoutError'
    return repondre(res, delai ? 504 : 502, { erreur: delai ? 'Analyse trop longue : réessaie.' : 'Amont injoignable.' }, debut)
  }
}
