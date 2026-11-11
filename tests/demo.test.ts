import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { PROMPT_ANALYSE } from '../src/pipeline/analyse'
import { clientDemo, etapeDe, origineDemo, reponsesEnregistrees } from '../src/pipeline/demo'
import { PROMPT_GARDE_FOU, PROMPT_GENERATION, verdictAccepte } from '../src/pipeline/exercise'
import { PROMPT_REVUE } from '../src/pipeline/revue'
import { parserAnalyse, parserExercice, parserVerdict } from '../src/pipeline/schemas'
import { decouperAnalyse } from '../src/pipeline/analyse'

/**
 * Le mode démo rejoue de vraies réponses de modèle : ces tests vérifient que
 * l'enregistrement est toujours exploitable **sur le chemin courant du produit**
 * (un seul appel vision fusionné). Sans eux, une évolution du pipeline casse la
 * démo publique en silence — c'est exactement ce qui s'est produit le 11/11 en
 * passant de deux appels à un seul.
 */
describe('mode démonstration', () => {
  it('reconnaît l’étape à partir du prompt', () => {
    const requete = (system: string) => ({ system, user: 'x' })
    expect(etapeDe(requete(PROMPT_ANALYSE))).toBe('analyse')
    expect(etapeDe(requete(PROMPT_REVUE))).toBe('revue')
    expect(etapeDe(requete(PROMPT_GENERATION))).toBe('exercice')
    expect(etapeDe(requete(PROMPT_GARDE_FOU))).toBe('verdict')
  })

  it('les réponses enregistrées sont présentes', () => {
    const reponses = reponsesEnregistrees()
    for (const cle of ['analyse', 'exercice', 'verdict'] as const) {
      expect(reponses[cle].length, `${cle} manquante`).toBeGreaterThan(10)
    }
    expect(origineDemo().dominant).toMatch(/^E[0-9]{2}$/)
  })

  it('le rejeu produit un diagnostic typé, sans réseau', async () => {
    const client = clientDemo()

    const brut = parserAnalyse(await client({ system: PROMPT_ANALYSE, user: 'x' }))
    const { extraction, erreurs } = decouperAnalyse(brut)
    expect(extraction.copiePropre).toBe(false)
    expect(erreurs.length).toBeGreaterThanOrEqual(2)

    const diagnostic = construireDiagnostic(erreurs, { id: 'demo', createdAt: '2026-11-11T12:00:00.000Z' })
    expect(diagnostic.typeDominant).toBe(origineDemo().dominant)
    // Une faute au moins doit être typée (pas tout en E99) : sinon la démo ment.
    expect(diagnostic.erreurs.some((e) => e.code !== 'E99')).toBe(true)

    const exercice = parserExercice(await client({ system: PROMPT_GENERATION, user: 'x' }))
    expect(exercice.enonce.length).toBeGreaterThan(10)
    expect(exercice.solution.length).toBeGreaterThan(10)

    const verdict = parserVerdict(await client({ system: PROMPT_GARDE_FOU, user: 'x' }))
    expect(verdictAccepte(verdict)).toBe(true)
  })
})