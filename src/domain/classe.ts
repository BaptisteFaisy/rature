import type { CodeErreur } from './taxonomy'
import type { Diagnostic, StatsClasse } from './types'
import { CODES_ERREUR, CODE_NON_TYPEE } from './taxonomy'
import { totalPondere } from './profil'
import type { Profil } from './types'

/**
 * Mode prof (RF-20) : mêmes tuyaux, nouvelle vue. On agrège N copies en une
 * statistique de classe — c'est le multiplicateur d'impact du produit :
 * le professeur sait quoi reprendre lundi.
 */
export function statsClasse(diagnostics: Diagnostic[]): StatsClasse {
  const parType = {} as Record<CodeErreur, number>
  for (const code of CODES_ERREUR) parType[code] = 0
  parType[CODE_NON_TYPEE] = 0

  for (const diagnostic of diagnostics) {
    for (const erreur of diagnostic.erreurs) {
      if (!erreur.ponderee) continue
      parType[erreur.code] = (parType[erreur.code] ?? 0) + 1
    }
  }

  const profil: Profil = { parType, totalAnalyses: diagnostics.length, evolution: [], signalees: {} }
  const total = totalPondere(profil)
  let frequent: CodeErreur | null = null
  let max = 0
  for (const code of CODES_ERREUR) {
    if ((parType[code] ?? 0) > max) {
      max = parType[code] ?? 0
      frequent = code
    }
  }

  return {
    nbCopies: diagnostics.length,
    parType,
    typeLePlusFrequent: frequent,
    pourcentageTypeFrequent: total === 0 || !frequent ? 0 : Math.round(((parType[frequent] ?? 0) / total) * 100),
    copiesParType: diagnostics.map((d) => ({ id: d.id, typeDominant: d.typeDominant })),
  }
}
