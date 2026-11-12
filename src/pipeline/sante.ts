/**
 * Sonde du proxy edge — lot 2. Donne à l'utilisateur un signal honnête avant
 * qu'il ne lance une analyse : si l'amont est hors ligne, on l'annonce et on
 * propose la démonstration plutôt que de le laisser attendre 90 s un échec.
 *
 * La sonde est un simple `GET /health` (le proxy Modal en expose un, CPU
 * uniquement). Aucune clé n'est envoyée, aucun quota consommé.
 */
import { PROXY_PAR_DEFAUT } from '../domain/config'

export type SanteProxy = 'ok' | 'ko' | 'inconnue'

/**
 * 12 s et une seconde tentative : le proxy Modal fait du scale-to-zero, et un
 * démarrage à froid prend ~5 s. Avec un délai de 5 s, la sonde annonçait à tort
 * « modèle indisponible » sur un conteneur froid (constaté en navigateur).
 */
const DELAI_SONDE_MS = 12_000
const TENTATIVES = 2
const PAUSE_ENTRE_ESSAIS_MS = 1500

/** L'URL à sonder : on remplace `/analyze` (le POST) par `/health` (la sonde). */
export function urlSante(proxy: string): string {
  const base = proxy.replace(/\/analyze\/?$/, '').replace(/\/+$/, '')
  return `${base}/health`
}

/**
 * Un proxy same-origin (ou une adresse vide) n'a pas de `/health` déployé :
 * sonder donnerait un 404 de l'hébergeur statique, donc un « indisponible »
 * mensonger. Bug réel du 11/11 : les réglages chargés après le premier rendu
 * laissaient une chaîne vide, et la sonde partait sur `https://<pages>/health`.
 */
function estSondable(proxy: string): boolean {
  // Seule une adresse absolue possède un `/health` atteignable en CORS. Une
  // adresse vide ou relative (repli same-origin d'un déploiement Vercel/Worker)
  // ne se sonde pas : on rend « inconnue » plutôt qu'un « indisponible » faux.
  // Attention : PROXY_PAR_DEFAUT est ABSOLU en production (VITE_PROXY_URL est
  // injecté au build) — il doit donc rester sondable.
  return /^https?:\/\//.test(proxy)
}

function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms))
}

async function sonderUneFois(proxy: string): Promise<SanteProxy> {
  try {
    const reponse = await fetch(urlSante(proxy), {
      method: 'GET',
      signal: AbortSignal.timeout(DELAI_SONDE_MS),
    })
    return reponse.ok ? 'ok' : 'ko'
  } catch {
    return 'ko'
  }
}

export type EtatModeles = { chaine: string[]; disjoncteur: Record<string, number> }

/**
 * Sonde la disponibilité des modèles (idée 5) : le proxy tient un disjoncteur
 * par modèle (cooldown après un 402/503). On réordonne la chaîne pour commencer
 * par un modèle vivant — chaque modèle mort évité, c'est 1 à 2 s de gagnées.
 * Aucun appel modèle : on lit l'état du proxy, donc c'est gratuit.
 */
export async function sonderModeles(proxy = PROXY_PAR_DEFAUT): Promise<string[] | null> {
  if (!estSondable(proxy)) return null
  try {
    const reponse = await fetch(urlSante(proxy).replace(/\/health$/, '/modeles'), {
      signal: AbortSignal.timeout(DELAI_SONDE_MS),
    })
    if (!reponse.ok) return null
    const etat = (await reponse.json()) as EtatModeles
    return reordonner(etat)
  } catch {
    return null
  }
}

/** Modèles vivants d'abord (dans l'ordre de la chaîne), modèles en cooldown ensuite. */
export function reordonner(etat: EtatModeles): string[] | null {
  if (!Array.isArray(etat?.chaine) || etat.chaine.length === 0) return null
  const morts = etat.disjoncteur && typeof etat.disjoncteur === 'object' ? etat.disjoncteur : {}
  const vivants = etat.chaine.filter((modele) => !(modele in morts))
  const refroidis = etat.chaine.filter((modele) => modele in morts)
  return [...vivants, ...refroidis]
}

export async function sonderProxy(proxy = PROXY_PAR_DEFAUT): Promise<SanteProxy> {
  if (!estSondable(proxy)) return 'inconnue'
  for (let essai = 1; essai <= TENTATIVES; essai += 1) {
    const etat = await sonderUneFois(proxy)
    if (etat === 'ok' || essai === TENTATIVES) return etat
    await attendre(PAUSE_ENTRE_ESSAIS_MS)
  }
  return 'ko'
}