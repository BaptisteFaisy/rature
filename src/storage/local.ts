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

export async function chargerDiagnostics(): Promise<Diagnostic[]> {
  return (await get<Diagnostic[]>(CLES.diagnostics)) ?? []
}

export async function chargerProfil(): Promise<Profil> {
  return (await get<Profil>(CLES.profil)) ?? profilVide()
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
