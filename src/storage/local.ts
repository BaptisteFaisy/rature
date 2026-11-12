/**
 * Persistance locale (IndexedDB via idb-keyval) — RF-08, RNF-P1, RNF-P4.
 *
 * Ce qui vit ici : des diagnostics structurés, un profil, des réglages.
 * Ce qui n'y vit jamais : l'image de la copie, le nom de l'élève, la clé API
 * (la clé reste en mémoire de session, cf. `reglagesEnMemoire`).
 */
import { clear, get, set } from 'idb-keyval'
import { CLES } from '../domain/config'
import { agreger, profilVide } from '../domain/profil'
import type { Diagnostic, Profil, Reglages } from '../domain/types'

export const REGLAGES_VIDES: Reglages = { clePersonnelle: '', modele: '', proxy: '' }

/** Un diagnostic lisible a un identifiant et une liste de fautes. */
function diagnosticValide(valeur: unknown): valeur is Diagnostic {
  if (typeof valeur !== 'object' || valeur === null) return false
  const candidat = valeur as Partial<Diagnostic>
  return typeof candidat.id === 'string' && Array.isArray(candidat.erreurs)
}

/**
 * IndexedDB peut rendre n'importe quoi (écriture interrompue, données d'une
 * version antérieure, quota) : on filtre au chargement plutôt que de laisser
 * un écran planter.
 */
export async function chargerDiagnostics(): Promise<Diagnostic[]> {
  const brut = await get<unknown>(CLES.diagnostics)
  if (!Array.isArray(brut)) return []
  return brut.filter(diagnosticValide)
}

export async function chargerProfil(): Promise<Profil> {
  const brut = await get<Partial<Profil> | undefined>(CLES.profil)
  const vide = profilVide()
  if (!brut || typeof brut !== 'object') return vide
  return {
    parType: { ...vide.parType, ...(brut.parType ?? {}) },
    totalAnalyses: typeof brut.totalAnalyses === 'number' ? brut.totalAnalyses : 0,
    evolution: Array.isArray(brut.evolution) ? brut.evolution : [],
    signalees: brut.signalees ?? {},
  }
}

export async function enregistrerDiagnostic(diagnostic: Diagnostic): Promise<Profil> {
  const diagnostics = [...(await chargerDiagnostics()), diagnostic]
  const profil = agreger(await chargerProfil(), diagnostic)
  await set(CLES.diagnostics, diagnostics)
  await set(CLES.profil, profil)
  return profil
}

export async function chargerReglages(): Promise<Reglages> {
  const stockes = await get<Reglages>(CLES.reglages)
  return { ...REGLAGES_VIDES, ...(stockes ?? {}) }
}

export async function sauverReglages(reglages: Reglages): Promise<void> {
  await set(CLES.reglages, reglages)
}

/** RNF-P4 : exportable et supprimable en un clic. */
export async function effacerHistorique(): Promise<void> {
  await clear()
}
