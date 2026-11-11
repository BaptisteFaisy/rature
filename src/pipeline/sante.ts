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
  return proxy.length > 0 && !proxy.startsWith('/') && proxy !== PROXY_PAR_DEFAUT
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

export async function sonderProxy(proxy = PROXY_PAR_DEFAUT): Promise<SanteProxy> {
  if (!estSondable(proxy)) return 'inconnue'
  for (let essai = 1; essai <= TENTATIVES; essai += 1) {
    const etat = await sonderUneFois(proxy)
    if (etat === 'ok' || essai === TENTATIVES) return etat
    await attendre(PAUSE_ENTRE_ESSAIS_MS)
  }
  return 'ko'
}