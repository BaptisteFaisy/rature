import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { agreger, profilVide } from '../src/domain/profil'
import {
  codesATracer,
  failleDisparue,
  messageProgression,
  occurrencesParCopie,
  pointsCourbe,
  tendance,
} from '../src/domain/progression'
import type { Diagnostic } from '../src/domain/types'

let compteur = 0
function diagnosticAvec(erreurs: { code: string; ponderee?: boolean }[]): Diagnostic {
  compteur += 1
  return construireDiagnostic(
    erreurs.map((e) => ({ code: e.code, ligne: 'x', explication: 'y', confiance: 0.9 })),
    { id: `d${compteur}`, createdAt: `2026-11-${String(compteur).padStart(2, '0')}T10:00:00.000Z` },
  )
}

const MOTS_CULPABILISANTS = ["tu t'es trompé", 'nul', 'grave', 'honte', 'incapable']

describe('trajectoire du profil (lot 5)', () => {
  it('série vide ou d’une copie → tendance inconnue', () => {
    expect(tendance([])).toBe('inconnue')
    expect(tendance([3])).toBe('inconnue')
  })

  it('baisse, hausse et stable sont reconnues', () => {
    expect(tendance([3, 2, 1, 0])).toBe('baisse')
    expect(tendance([0, 1, 2])).toBe('hausse')
    expect(tendance([2, 2, 2])).toBe('stable')
  })

  it('E11 et E99 ne comptent pas dans la série pondérée', () => {
    const diagnostic = diagnosticAvec([
      { code: 'E01' },
      { code: 'E11' },
      { code: 'E99' },
    ])
    expect(occurrencesParCopie([diagnostic], 'E01')).toEqual([1])
    expect(occurrencesParCopie([diagnostic], 'E11')).toEqual([0])
    expect(occurrencesParCopie([diagnostic], 'E99')).toEqual([0])
  })

  it('failleDisparue exige au moins 4 copies et une disparition réelle', () => {
    const ancien = [diagnosticAvec([{ code: 'E04' }]), diagnosticAvec([{ code: 'E04' }])]
    const recentes = [diagnosticAvec([{ code: 'E01' }]), diagnosticAvec([]), diagnosticAvec([{ code: 'E01' }])]
    expect(failleDisparue([...ancien, ...recentes], 'E04')).toBe(true)
    expect(failleDisparue(ancien, 'E04')).toBe(false) // seulement 2 copies
    expect(failleDisparue([...ancien, ...recentes], 'E01')).toBe(false) // E01 encore présent
  })

  it('messageProgression reste bienveillant et cite le type dominant', () => {
    const diagnostics = [
      diagnosticAvec([{ code: 'E01' }, { code: 'E01' }]),
      diagnosticAvec([{ code: 'E01' }]),
      diagnosticAvec([]),
    ]
    let profil = profilVide()
    for (const d of diagnostics) profil = agreger(profil, d)
    const message = messageProgression(profil, diagnostics)
    expect(message.toLowerCase()).toContain('signe perdu')
    for (const mot of MOTS_CULPABILISANTS) expect(message.toLowerCase()).not.toContain(mot)
  })

  it('profil vide → message d’invitation, codesATracer vide', () => {
    expect(messageProgression(profilVide(), [])).toContain('trajectoire')
    expect(codesATracer(profilVide())).toEqual([])
  })

  it('codesATracer renvoie les 3 plus fréquents, pointsCourbe indexe', () => {
    const diagnostics = [
      diagnosticAvec([{ code: 'E01' }, { code: 'E01' }, { code: 'E04' }, { code: 'E06' }]),
    ]
    let profil = profilVide()
    for (const d of diagnostics) profil = agreger(profil, d)
    expect(codesATracer(profil)[0]).toBe('E01')
    expect(pointsCourbe([0, 2, 1])).toEqual([
      { index: 0, valeur: 0 },
      { index: 1, valeur: 2 },
      { index: 2, valeur: 1 },
    ])
  })
})