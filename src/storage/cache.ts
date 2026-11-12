/**
 * Cache local des analyses — idée 4 du brassage « rester sur InferHub ».
 *
 * Pourquoi côté client et pas côté proxy : un cache serveur conserverait le
 * texte extrait d'une copie d'élève, ce que RNF-P3 interdit (« le proxy ne
 * loggue ni les images ni les textes extraits »). Le cache local reste dans
 * IndexedDB, sur l'appareil, avec l'historique — et il est supprimable en un
 * clic. Contrepartie assumée : deux visiteurs qui analysent la même photo ne
 * se partagent pas la réponse.
 *
 * Ce qui est mis en cache : le diagnostic structuré, les annotations et
 * l'exercice. **Jamais l'image** (RNF-P1) : la clé est son empreinte SHA-256.
 */
import { del, get, keys, set } from 'idb-keyval'
import { CLES } from '../domain/config'
import type { BilanRevue, Diagnostic, Extraction, ExerciceVerifie } from '../domain/types'

export type AnalyseEnCache = {
  enregistreLe: string
  diagnostic: Diagnostic
  extraction: Extraction
  exercice: ExerciceVerifie | null
  revue?: BilanRevue
  messageExercice?: string
  /** Modèle qui avait répondu : affiché pour la transparence. */
  modele?: string
}

/** Durée de validité : une copie corrigée ne change pas, mais les prompts si. */
export const TTL_CACHE_MS = 24 * 60 * 60 * 1000
/** Au-delà, on purge les plus anciennes : le cache ne doit pas grossir indéfiniment. */
export const MAX_ENTREES_CACHE = 40

const PREFIXE = `${CLES.cache}/`

export async function empreinteImage(dataUrl: string): Promise<string> {
  const octets = new TextEncoder().encode(dataUrl)
  const condense = await crypto.subtle.digest('SHA-256', octets)
  return Array.from(new Uint8Array(condense))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('')
}

export async function lireCache(empreinte: string): Promise<AnalyseEnCache | null> {
  const entree = await get<AnalyseEnCache>(`${PREFIXE}${empreinte}`)
  if (!entree) return null
  const age = Date.now() - Date.parse(entree.enregistreLe)
  if (!Number.isFinite(age) || age > TTL_CACHE_MS) {
    await del(`${PREFIXE}${empreinte}`)
    return null
  }
  return entree
}

export async function ecrireCache(empreinte: string, analyse: AnalyseEnCache): Promise<void> {
  await set(`${PREFIXE}${empreinte}`, analyse)
  await purgerCache()
}

/** Supprime les entrées périmées, puis les plus anciennes au-delà du plafond. */
export async function purgerCache(): Promise<number> {
  const cles = (await keys()).filter((cle) => typeof cle === 'string' && cle.startsWith(PREFIXE)) as string[]
  const maintenant = Date.now()
  const vivantes: { cle: string; enregistreLe: number }[] = []
  for (const cle of cles) {
    const entree = await get<AnalyseEnCache>(cle)
    const temps = entree ? Date.parse(entree.enregistreLe) : Number.NaN
    if (!entree || !Number.isFinite(temps) || maintenant - temps > TTL_CACHE_MS) {
      await del(cle)
    } else {
      vivantes.push({ cle, enregistreLe: temps })
    }
  }
  if (vivantes.length <= MAX_ENTREES_CACHE) return vivantes.length
  vivantes.sort((a, b) => a.enregistreLe - b.enregistreLe)
  const enTrop = vivantes.slice(0, vivantes.length - MAX_ENTREES_CACHE)
  for (const entree of enTrop) await del(entree.cle)
  return vivantes.length - enTrop.length
}

export async function viderCache(): Promise<void> {
  const cles = (await keys()).filter((cle) => typeof cle === 'string' && cle.startsWith(PREFIXE)) as string[]
  for (const cle of cles) await del(cle)
}
