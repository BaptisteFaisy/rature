/**
 * Agrégation du profil d'erreur (étape 5 du pipeline) — logique pure, testée.
 *
 * Règles (RATURE.md §17) :
 *  - une faute = exactement un type ;
 *  - E99 « non typée » est exclue du profil ;
 *  - E11 « recopie » est signalée mais pondérée à 0 ;
 *  - le profil ne connaît que des compteurs : aucune image, aucun nom.
 */
import { CODES_ERREUR, CODE_NON_TYPEE, entreDansLeProfil, estPonderee, libelleDe } from './taxonomy'
import type { CodeErreur } from './taxonomy'
import type { Diagnostic, Profil } from './types'

export function profilVide(): Profil {
  const parType = {} as Record<CodeErreur, number>
  for (const code of CODES_ERREUR) parType[code] = 0
  parType[CODE_NON_TYPEE] = 0
  return { parType, totalAnalyses: 0, evolution: [], signalees: {} }
}

/** Applique un diagnostic au profil sans jamais muter l'entrée. */
export function agreger(profil: Profil, diagnostic: Diagnostic): Profil {
  const parType = { ...profil.parType }
  const signalees = { ...profil.signalees }

  for (const erreur of diagnostic.erreurs) {
    // Toute faute est signalée (honnêteté), mais seules les pondérées comptent
    // dans le profil : E99 « non typée » et E11 « recopie » restent à 0.
    signalees[erreur.code] = (signalees[erreur.code] ?? 0) + 1
    if (entreDansLeProfil(erreur.code) && estPonderee(erreur.code)) {
      parType[erreur.code] = (parType[erreur.code] ?? 0) + 1
    }
  }

  return {
    parType,
    signalees,
    totalAnalyses: profil.totalAnalyses + 1,
    evolution: [
      ...profil.evolution,
      { date: diagnostic.createdAt, typeDominant: diagnostic.typeDominant },
    ],
  }
}

export function totalPondere(profil: Profil): number {
  return CODES_ERREUR.reduce((somme, code) => somme + (profil.parType[code] ?? 0), 0)
}

/** Type dominant = plus fort compteur pondéré ; null si le profil est vide. */
export function typeDominant(profil: Profil): CodeErreur | null {
  let meilleur: CodeErreur | null = null
  let max = 0
  for (const code of CODES_ERREUR) {
    const n = profil.parType[code] ?? 0
    if (n > max) {
      max = n
      meilleur = code
    }
  }
  return meilleur
}

/** Part du type dans le total pondéré, 0..1. */
export function partDuType(profil: Profil, code: CodeErreur): number {
  const total = totalPondere(profil)
  if (total === 0) return 0
  return (profil.parType[code] ?? 0) / total
}

export function pourcentage(part: number): number {
  return Math.round(part * 100)
}

/**
 * Phrase de synthèse affichée dans la vue Profil :
 * « 62 % de tes erreurs : signe perdu au développement ».
 */
export function phraseSynthese(profil: Profil): string {
  const dominant = typeDominant(profil)
  if (!dominant) return "Pas encore d'erreur récurrente : ajoute une copie corrigée."
  const part = pourcentage(partDuType(profil, dominant))
  return `${part} % de tes erreurs : ${libelleDe(dominant).toLowerCase()}`
}

/** Série triée par fréquence décroissante, pour les barres de la vue Profil. */
export function classement(profil: Profil): { code: CodeErreur; n: number; part: number }[] {
  const total = totalPondere(profil)
  return CODES_ERREUR.map((code) => ({
    code,
    n: profil.parType[code] ?? 0,
    part: total === 0 ? 0 : (profil.parType[code] ?? 0) / total,
  }))
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n)
}

/** Évolution lisible : nombre de copies où ce type était dominant. */
export function occurrencesDominantes(profil: Profil, code: CodeErreur): number {
  return profil.evolution.filter((e) => e.typeDominant === code).length
}
