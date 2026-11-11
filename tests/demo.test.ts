import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { PROMPT_CLASSIFICATION } from '../src/pipeline/classify'
import { clientDemo, etapeDe, origineDemo, reponsesEnregistrees } from '../src/pipeline/demo'
import { PROMPT_GARDE_FOU, PROMPT_GENERATION, verdictAccepte } from '../src/pipeline/exercise'
import { PROMPT_EXTRACTION } from '../src/pipeline/extract'
import { parserClassification, parserExercice, parserExtraction, parserVerdict } from '../src/pipeline/schemas'

/**
 * Le mode démo rejoue de vraies réponses de modèle : ces tests vérifient que
 * l'enregistrement est toujours exploitable (sinon la démo publique casse le
 * jour du jugement, sans réseau pour s'en apercevoir).
 */
describe('mode démonstration', () => {
  it('reconnaît l’étape à partir du prompt', () => {
    const requete = (system: string) => ({ system, user: 'x' })
    expect(etapeDe(requete(PROMPT_EXTRACTION))).toBe('extraction')
    expect(etapeDe(requete(PROMPT_CLASSIFICATION))).toBe('classification')
    expect(etapeDe(requete(PROMPT_GENERATION))).toBe('exercice')
    expect(etapeDe(requete(PROMPT_GARDE_FOU))).toBe('verdict')
  })

  it('les quatre réponses enregistrées sont présentes', () => {
    const reponses = reponsesEnregistrees()
    for (const cle of ['extraction', 'classification', 'exercice', 'verdict'] as const) {
      expect(reponses[cle].length).toBeGreaterThan(10)
    }
    expect(origineDemo().dominant).toBe('E01')
  })

  it('le rejeu produit un diagnostic cohérent, sans réseau', async () => {
    const client = clientDemo()
    const extraction = parserExtraction(await client({ system: PROMPT_EXTRACTION, user: 'x' }))
    expect(extraction.copiePropre).toBe(false)
    expect(extraction.annotations.length).toBeGreaterThanOrEqual(2)

    const brutes = parserClassification(await client({ system: PROMPT_CLASSIFICATION, user: 'x' }))
    const diagnostic = construireDiagnostic(brutes, { id: 'demo', createdAt: '2026-11-11T12:00:00.000Z' })
    expect(diagnostic.typeDominant).toBe(origineDemo().dominant)

    const exercice = parserExercice(await client({ system: PROMPT_GENERATION, user: 'x' }))
    expect(exercice.enonce.length).toBeGreaterThan(10)
    expect(exercice.solution.length).toBeGreaterThan(10)

    const verdict = parserVerdict(await client({ system: PROMPT_GARDE_FOU, user: 'x' }))
    expect(verdictAccepte(verdict)).toBe(true)
  })
})
