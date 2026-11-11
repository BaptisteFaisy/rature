import { describe, expect, it } from 'vitest'
import { CODE_NON_TYPEE, CODES_ERREUR } from '../src/domain/taxonomy'
import type { CodeErreur } from '../src/domain/taxonomy'
import type { StatsClasse } from '../src/domain/types'
import { quoiReprendreLundi } from '../src/domain/lundi'

function parTypeDe(entrees: Partial<Record<CodeErreur, number>>): Record<CodeErreur, number> {
  const base = {} as Record<CodeErreur, number>
  for (const code of [...CODES_ERREUR, CODE_NON_TYPEE]) base[code] = 0
  for (const [code, n] of Object.entries(entrees)) base[code as CodeErreur] = n ?? 0
  return base
}

function stats(entrees: Partial<Record<CodeErreur, number>>, nbCopies = 10): StatsClasse {
  return {
    nbCopies,
    parType: parTypeDe(entrees),
    typeLePlusFrequent: null,
    pourcentageTypeFrequent: 0,
    copiesParType: [],
  }
}

describe('quoiReprendreLundi', () => {
  it('deux types nets → deux entrées triées par fréquence', () => {
    const plan = quoiReprendreLundi(stats({ E01: 6, E02: 4 }))
    expect(plan.types).toEqual(['E01', 'E02'])
    expect(plan.exercices.map((e) => e.code)).toEqual(['E01', 'E02'])
    expect(plan.types.length).toBe(2)
  })

  it('second type sous le seuil → une seule entrée', () => {
    const plan = quoiReprendreLundi(stats({ E01: 9, E02: 1 }))
    expect(plan.types).toEqual(['E01'])
    expect(plan.exercices.length).toBe(1)
  })

  it('classe sans erreur pondérée → phrase de repli et tableaux vides', () => {
    const plan = quoiReprendreLundi(stats({}))
    expect(plan.phrase).toBe('Rien à reprendre en classe entière.')
    expect(plan.types).toEqual([])
    expect(plan.exercices).toEqual([])
    expect(plan.partCumulee).toBe(0)
  })

  it('E11 et E99 ne sont jamais retenus dans le plan', () => {
    const plan = quoiReprendreLundi(stats({ E11: 5, E99: 3, E01: 2 }))
    expect(plan.types).not.toContain('E11')
    expect(plan.types).not.toContain('E99')
    expect(plan.types).toEqual(['E01'])
  })

  it('part cumulée exacte des types retenus', () => {
    const plan = quoiReprendreLundi(stats({ E01: 5, E02: 3, E03: 2 }))
    expect(plan.partCumulee).toBeCloseTo(0.8, 10)
  })

  it('chaque consigne est non vide et compte au plus 25 mots', () => {
    const plan = quoiReprendreLundi(stats({ E01: 6, E02: 4 }))
    for (const exercice of plan.exercices) {
      const consigne = exercice.consigne.trim()
      expect(consigne.length).toBeGreaterThan(0)
      expect(consigne.split(/\s+/).length).toBeLessThanOrEqual(25)
    }
  })

  it('aucun mot culpabilisant dans les phrases', () => {
    const culpabilisants = ['faute', 'fautes', 'nul', 'mauvaise', 'mauvais', 'incapable', 'échec', 'punition', 'sanction', 'raté', 'honte']
    const plan = quoiReprendreLundi(stats({ E01: 6, E02: 4 }))
    const phrase = plan.phrase.toLowerCase()
    for (const mot of culpabilisants) {
      expect(phrase).not.toContain(mot)
    }
  })
})