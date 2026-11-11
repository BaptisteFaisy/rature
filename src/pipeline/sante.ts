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

const DELAI_SONDE_MS = 5000

/** L'URL à sonder : on remplace `/analyze` (le POST) par `/health` (la sonde). */
export function urlSante(proxy: string): string {
  const base = proxy.replace(/\/analyze\/?$/, '').replace(/\/+$/, '')
  return `${base}/health`
}

function estLocal(proxy: string): boolean {
  return proxy === PROXY_PAR_DEFAUT || proxy.startsWith('/api')
}

export async function sonderProxy(proxy = PROXY_PAR_DEFAUT): Promise<SanteProxy> {
  // Un proxy same-origin n'a pas de `/health` déployé : on ne ment pas.
  if (estLocal(proxy)) return 'inconnue'
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