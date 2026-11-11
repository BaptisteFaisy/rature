import { describe, expect, it } from 'vitest'
import { construireDiagnostic, normaliserErreur } from '../src/domain/diagnostic'
import {
  agreger,
  classement,
  partDuType,
  phraseSynthese,
  profilVide,
  typeDominant,
} from '../src/domain/profil'

const id = { id: 'd1', createdAt: '2026-11-11T10:00:00.000Z' }

describe('seuil de confiance et normalisation', () => {
  it('0,60 exactement reste typée, 0,59 devient E99', () => {
    expect(normaliserErreur({ code: 'E01', confiance: 0.6 }).code).toBe('E01')
    expect(normaliserErreur({ code: 'E01', confiance: 0.59 }).code).toBe('E99')
  })

  it('un code hors taxonomie devient E99', () => {
    expect(normaliserErreur({ code: 'E42', confiance: 0.99 }).code).toBe('E99')
    expect(normaliserErreur({ code: 'n_importe_quoi', confiance: 0.99 }).code).toBe('E99')
  })

  it('une confiance hors bornes est bornée, E11 n’est pas pondérée', () => {
    expect(normaliserErreur({ code: 'E01', confiance: 4 }).confiance).toBe(1)
    expect(normaliserErreur({ code: 'E11', confiance: 0.9 }).ponderee).toBe(false)
    expect(normaliserErreur({ code: 'E01', confiance: 0.9 }).ponderee).toBe(true)
  })

  it('un diagnostic sans faute n’a pas de type dominant', () => {
    const diagnostic = construireDiagnostic([], id)
    expect(diagnostic.nbFautes).toBe(0)
    expect(diagnostic.typeDominant).toBeNull()
  })
})

describe('profil d’erreur', () => {
  const diagnostic = construireDiagnostic(
    [
      { code: 'E01', ligne: 'a', explication: 'x', confiance: 0.9 },
      { code: 'E01', ligne: 'b', explication: 'x', confiance: 0.8 },
      { code: 'E11', ligne: 'c', explication: 'x', confiance: 0.8 },
      { code: 'E99', ligne: 'd', explication: 'x', confiance: 0.2 },
    ],
    id,
  )

  it('E99 sort du profil, E11 est signalée mais compte pour zéro', () => {
    const profil = agreger(profilVide(), diagnostic)
    expect(profil.parType.E01).toBe(2)
    expect(profil.parType.E11).toBe(0)
    expect(profil.parType.E99).toBe(0)
    expect(profil.signalees.E11).toBe(1)
    expect(profil.signalees.E99).toBe(1)
  })

  it('dominant, part et phrase de synthèse', () => {
    const profil = agreger(agreger(profilVide(), diagnostic), { ...diagnostic, id: 'd2' })
    expect(typeDominant(profil)).toBe('E01')
    expect(Math.round(partDuType(profil, 'E01') * 100)).toBe(100)
    expect(phraseSynthese(profil)).toContain('signe perdu')
    expect(profil.totalAnalyses).toBe(2)
    expect(classement(profil).map((e) => e.code)).toEqual(['E01'])
  })

  it('profil vide : pas de dominant, phrase d’invitation', () => {
    const vide = profilVide()
    expect(typeDominant(vide)).toBeNull()
    expect(phraseSynthese(vide)).toContain('Pas encore')
  })

  it('agréger ne mute jamais l’entrée', () => {
    const avant = profilVide()
    const copie = JSON.parse(JSON.stringify(avant)) as typeof avant
    agreger(avant, diagnostic)
    expect(avant).toEqual(copie)
  })
})
