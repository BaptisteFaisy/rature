import { describe, expect, it } from 'vitest'
import {
  COPIES_CORRIGEES,
  COPIES_PROPRES,
  reponseClassification,
  reponseExtraction,
} from '../corpus/fixtures'
import type { FixtureCopie } from '../corpus/fixtures'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { classerAnnotations } from '../src/pipeline/classify'
import { clientSimule } from '../src/pipeline/client'
import { extraireAnnotations } from '../src/pipeline/extract'
import { transportParDefaut } from '../src/pipeline/llm'

const transport = transportParDefaut('/api/test')
const IMAGE = 'data:image/jpeg;base64,AAA'
const MAINTENANT = '2026-11-11T10:00:00.000Z'

/** L'extraction simulée : mêmes annotations que la fixture. */
function extractionDe(fixture: FixtureCopie) {
  return { annotations: fixture.annotations, copiePropre: fixture.estPropre }
}

describe('RNF-03 — classification sur le corpus', () => {
  it('au moins 80 % des copies retrouvent leur type dominant', async () => {
    let bons = 0
    for (const fixture of COPIES_CORRIGEES) {
      const erreurs = await classerAnnotations(
        extractionDe(fixture),
        transport,
        clientSimule([reponseClassification(fixture)]),
      )
      const diagnostic = construireDiagnostic(erreurs, { id: fixture.id, createdAt: MAINTENANT })
      if (diagnostic.typeDominant === fixture.typeDominantAttendu) bons += 1
    }
    expect(bons / COPIES_CORRIGEES.length).toBeGreaterThanOrEqual(0.8)
  })

  it('une annotation peu sûre devient E99 et sort du profil', async () => {
    const fixture = COPIES_CORRIGEES[3]!
    const erreurs = await classerAnnotations(
      extractionDe(fixture),
      transport,
      clientSimule([reponseClassification(fixture)]),
    )
    const codes = erreurs.map((erreur) => erreur.code)
    expect(codes).toContain('E07')
    expect(codes).toContain('E99')
  })

  it('E11 reste signalée mais ne pèse pas sur le dominant', async () => {
    const fixture = COPIES_CORRIGEES[0]!
    const erreurs = await classerAnnotations(
      extractionDe(fixture),
      transport,
      clientSimule([reponseClassification(fixture)]),
    )
    const recopie = erreurs.find((erreur) => erreur.code === 'E11')
    expect(recopie?.ponderee).toBe(false)
  })
})

describe('RNF-04 — zéro faux positif sur une copie propre', () => {
  it('aucune faute, et aucun appel de classification', async () => {
    for (const fixture of COPIES_PROPRES) {
      const extraction = await extraireAnnotations(
        IMAGE,
        transport,
        clientSimule([reponseExtraction(fixture)]),
      )
      expect(extraction.copiePropre).toBe(true)
      // clientSimule([]) lèverait si un appel était tenté : la garantie est là.
      const erreurs = await classerAnnotations(extraction, transport, clientSimule([]))
      expect(erreurs).toHaveLength(0)
      const diagnostic = construireDiagnostic(erreurs, { id: fixture.id, createdAt: MAINTENANT })
      expect(diagnostic.nbFautes).toBe(0)
      expect(diagnostic.typeDominant).toBeNull()
    }
  })
})
