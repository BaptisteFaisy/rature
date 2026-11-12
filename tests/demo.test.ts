import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { PROMPT_ANALYSE, decouperAnalyse } from '../src/pipeline/analyse'
import {
  COPIES_DEMO,
  ID_COPIES_DEMO,
  clientDemoPour,
  copieDemo,
  etapeDe,
  origineDemo,
} from '../src/pipeline/demo'
import { PROMPT_GARDE_FOU, PROMPT_GENERATION, verdictAccepte } from '../src/pipeline/exercise'
import { PROMPT_REVUE } from '../src/pipeline/revue'
import { parserAnalyse, parserExercice, parserVerdict } from '../src/pipeline/schemas'

/**
 * Le mode démo rejoue de vraies réponses de modèle. Ces tests vérifient que
 * chaque enregistrement est toujours exploitable **sur le chemin courant du
 * produit** : une évolution du pipeline (fusion d'appels, seconde passe) casse
 * la démo en silence si on ne recapture pas — c'est arrivé le 11/11, tout
 * retombait en E99. Le test échoue désormais dans ce cas.
 */
describe('mode démonstration', () => {
  it('reconnaît l’étape à partir du prompt', () => {
    const requete = (system: string) => ({ system, user: 'x' })
    expect(etapeDe(requete(PROMPT_ANALYSE))).toBe('analyse')
    expect(etapeDe(requete(PROMPT_REVUE))).toBe('revue')
    expect(etapeDe(requete(PROMPT_GENERATION))).toBe('exercice')
    expect(etapeDe(requete(PROMPT_GARDE_FOU))).toBe('verdict')
  })

  it('au moins une copie est enregistrée, avec un identifiant stable', () => {
    expect(COPIES_DEMO.length).toBeGreaterThanOrEqual(1)
    expect(ID_COPIES_DEMO).toHaveLength(COPIES_DEMO.length)
    expect(copieDemo(ID_COPIES_DEMO[0])?.id).toBe(ID_COPIES_DEMO[0])
    expect(copieDemo('inexistant')).toBeUndefined()
    expect(copieDemo()).toBeDefined()
  })

  it.each(ID_COPIES_DEMO)('la copie %s se rejoue en un diagnostic typé', async (id) => {
    const client = clientDemoPour(id)
    const meta = origineDemo(id)
    expect(meta).not.toBeNull()

    const brut = parserAnalyse(await client({ system: PROMPT_ANALYSE, user: 'x' }))
    const { extraction, erreurs } = decouperAnalyse(brut)
    expect(extraction.copiePropre).toBe(false)
    expect(erreurs.length).toBeGreaterThanOrEqual(1)

    const diagnostic = construireDiagnostic(erreurs, { id, createdAt: '2026-11-12T12:00:00.000Z' })
    // Garde anti-E99 : si tout retombe en « non typée », l'enregistrement est périmé.
    expect(diagnostic.erreurs.some((e) => e.code !== 'E99'), 'toutes les fautes en E99').toBe(true)
    expect(diagnostic.typeDominant).toBe(meta!.dominant)
    if (meta!.nbFautes !== null) expect(diagnostic.nbFautes).toBe(meta!.nbFautes)

    const exercice = parserExercice(await client({ system: PROMPT_GENERATION, user: 'x' }))
    expect(exercice.enonce.length).toBeGreaterThan(10)
    expect(exercice.solution.length).toBeGreaterThan(10)

    const verdict = parserVerdict(await client({ system: PROMPT_GARDE_FOU, user: 'x' }))
    expect(verdictAccepte(verdict), 'le garde-fou enregistré doit être validé').toBe(true)
  })

  it('un enregistrement sans réponse de seconde passe lève un message explicite', async () => {
    const copie = COPIES_DEMO.find((c) => !c.enregistrement.reponses.revue)
    if (!copie) return // toutes les copies ont une revue enregistrée : rien à tester
    const client = clientDemoPour(copie.id)
    await expect(client({ system: PROMPT_REVUE, user: 'x' })).rejects.toThrow(/recapturer/)
  })
})
