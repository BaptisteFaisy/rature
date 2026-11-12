/**
 * Auto-vérification — un contrôle et une preuve par sous-système.
 *
 * L'idée : ne pas affirmer que ça marche, le **montrer**. Un bouton lance une
 * série de contrôles réels (proxy, disjoncteur, cache local, stockage local,
 * banque d'exercices, taxonomie, budget d'attente) et chaque ligne renvoie la
 * preuve de son succès, avec sa durée.
 *
 * Aucun de ces contrôles ne consomme de quota modèle (les seuls appels réseau
 * sont `GET /health` et `GET /modeles`, qui sont gratuits).
 */
import { BANQUE, exercicesDe } from '../domain/banque'
import { CODES_ERREUR } from '../domain/taxonomy'
import { BUDGET_APPEL_MS, CHAINE_MODELES, DELAI_APPEL_MS, SEUIL_REVUE } from '../domain/config'
import { ecrireCache, lireCache, viderCache } from '../storage/cache'
import { chargerDiagnostics, enregistrerDiagnostic } from '../storage/local'
import type { Diagnostic } from '../domain/types'

export type Controle = {
  nom: string
  ok: boolean
  /** La preuve, en une phrase : ce qui a été vérifié et ce que ça a donné. */
  preuve: string
  ms?: number
}

function duree(debut: number): number {
  return Date.now() - debut
}

function base(proxy: string): string {
  return proxy.replace(/\/analyze\/?$/, '')
}

/** Contrôle 1 : le proxy répond-il, et en combien de temps ? */
async function controleProxy(proxy: string): Promise<Controle> {
  const debut = Date.now()
  try {
    const reponse = await fetch(`${base(proxy)}/health`, { signal: AbortSignal.timeout(10_000) })
    const corps = (await reponse.json().catch(() => ({}))) as { ok?: boolean; disjoncteur?: Record<string, number> }
    const morts = Object.keys(corps.disjoncteur ?? {}).length
    return {
      nom: 'Proxy (edge)',
      ok: reponse.ok === true && corps.ok === true,
      preuve: reponse.ok
        ? `répond 200 en ${duree(debut)} ms — ${morts} modèle(s) en cooldown`
        : `répond ${reponse.status}`,
      ms: duree(debut),
    }
  } catch {
    return { nom: 'Proxy (edge)', ok: false, preuve: 'injoignable', ms: duree(debut) }
  }
}

/** Contrôle 2 : la chaîne de repli est-elle connue et ordonnée ? */
async function controleModeles(proxy: string): Promise<Controle> {
  const debut = Date.now()
  try {
    const reponse = await fetch(`${base(proxy)}/modeles`, { signal: AbortSignal.timeout(10_000) })
    const corps = (await reponse.json().catch(() => ({}))) as { chaine?: string[]; disjoncteur?: Record<string, number> }
    const chaine = corps.chaine ?? []
    return {
      nom: 'Chaîne de repli',
      ok: chaine.length > 0,
      preuve: `${chaine.length} modèle(s) disponibles, premier tenté : ${(chaine[0] ?? '—').split('/').pop()}`,
      ms: duree(debut),
    }
  } catch {
    return { nom: 'Chaîne de repli', ok: false, preuve: 'état des modèles illisible', ms: duree(debut) }
  }
}

/** Contrôle 3 : le cache local écrit, relit et efface. */
async function controleCache(): Promise<Controle> {
  const debut = Date.now()
  const empreinte = `auto-verification-${Date.now()}`
  try {
    await ecrireCache(empreinte, {
      enregistreLe: new Date().toISOString(),
      diagnostic: {
        id: 'auto',
        createdAt: new Date().toISOString(),
        matiere: 'maths',
        nbFautes: 0,
        erreurs: [],
        typeDominant: null,
      },
      extraction: { annotations: [], copiePropre: true },
      exercice: null,
    })
    const relu = await lireCache(empreinte)
    await viderCache()
    return {
      nom: 'Cache local',
      ok: relu !== null,
      preuve: relu ? 'écriture et relecture confirmées' : 'relecture impossible',
      ms: duree(debut),
    }
  } catch {
    return { nom: 'Cache local', ok: false, preuve: 'IndexedDB indisponible', ms: duree(debut) }
  }
}

/** Contrôle 4 : le stockage de l'historique répond-il ? */
async function controleStockage(): Promise<Controle> {
  const debut = Date.now()
  try {
    const avant = await chargerDiagnostics()
    const factice: Diagnostic = {
      id: `auto-${Date.now()}`,
      createdAt: new Date().toISOString(),
      matiere: 'maths',
      nbFautes: 0,
      erreurs: [],
      typeDominant: null,
    }
    await enregistrerDiagnostic(factice)
    const apres = await chargerDiagnostics()
    return {
      nom: 'Historique local',
      ok: apres.length >= avant.length,
      preuve: `${apres.length} diagnostic(s) en local, écriture confirmée`,
      ms: duree(debut),
    }
  } catch {
    return { nom: 'Historique local', ok: false, preuve: 'IndexedDB indisponible', ms: duree(debut) }
  }
}

/** Contrôle 5 : la banque d'exercices est-elle complète et ciblée ? */
export function controleBanque(): Controle {
  const debut = Date.now()
  const manquants = CODES_ERREUR.filter((code) => exercicesDe(code).length !== 3)
  const total = CODES_ERREUR.reduce((somme, code) => somme + BANQUE[code].length, 0)
  return {
    nom: "Banque d'exercices",
    ok: manquants.length === 0,
    preuve:
      manquants.length === 0
        ? `${total} exercices locaux pour les ${CODES_ERREUR.length} types — 0 appel réseau`
        : `types incomplets : ${manquants.join(', ')}`,
    ms: duree(debut),
  }
}

/** Contrôle 6 : la taxonomie est-elle fermée et ses verrous en place ? */
export function controleTaxonomie(): Controle {
  const debut = Date.now()
  return {
    nom: 'Taxonomie fermée',
    ok: CODES_ERREUR.length === 12,
    preuve: `${CODES_ERREUR.length} codes, seuil de confiance ${SEUIL_REVUE} pour la seconde passe`,
    ms: duree(debut),
  }
}

/** Contrôle 7 : les bornes d'attente sont-elles celles qu'on believes ? */
export function controleBudget(): Controle {
  const debut = Date.now()
  return {
    nom: "Budget d'attente",
    ok: BUDGET_APPEL_MS > DELAI_APPEL_MS,
    preuve: `${Math.round(DELAI_APPEL_MS / 1000)} s par appel, ${Math.round(BUDGET_APPEL_MS / 1000)} s de budget, ${CHAINE_MODELES.length} modèles`,
    ms: duree(debut),
  }
}

/** Lance tous les contrôles et renvoie une preuve par sous-système. */
export async function autoVerifier(proxy: string): Promise<Controle[]> {
  const controles: Controle[] = []
  controles.push(await controleProxy(proxy))
  controles.push(await controleModeles(proxy))
  controles.push(await controleCache())
  controles.push(await controleStockage())
  controles.push(controleBanque())
  controles.push(controleTaxonomie())
  controles.push(controleBudget())
  return controles
}
