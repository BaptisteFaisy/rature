import { describe, expect, it } from 'vitest'
import { MAX_FAUTES_A_REVOIR, SEUIL_REVUE } from '../src/domain/config'
import { PROMPT_ANALYSE, decouperAnalyse, messageAnalyse } from '../src/pipeline/analyse'
import {
  PROMPT_REVUE,
  aRevoir,
  appliquerRevue,
  indicesASurveiller,
  messageRevue,
  revoirFautesPeuSures,
} from '../src/pipeline/revue'
import { parserAnalyse } from '../src/pipeline/schemas'
import { clientSimule } from '../src/pipeline/client'
import { transportParDefaut } from '../src/pipeline/llm'
import type { Erreur } from '../src/domain/types'

const transport = transportParDefaut('/api/test')

function analyserTexte(objet: unknown) {
  return decouperAnalyse(parserAnalyse(JSON.stringify(objet)))
}


function erreur(partial: Partial<Erreur> & { code: Erreur['code'] }): Erreur {
  return {
    libelle: 'libellé',
    ligne: 'ligne',
    explication: 'explication',
    confiance: 0.9,
    ponderee: true,
    ...partial,
  }
}

describe('analyse fusionnée (lot 1)', () => {
  it('le prompt embarque la taxonomie complète, sans marqueur résiduel', () => {
    expect(PROMPT_ANALYSE).toContain('E12')
    expect(PROMPT_ANALYSE).not.toContain('{{TAXONOMIE}}')
    expect(messageAnalyse().length).toBeGreaterThan(20)
  })

  it('copie propre : aucune faute, même si le modèle en propose', () => {
    const { extraction, erreurs } = analyserTexte({
      annotations: [{ ligne: 'a', annotation: 'faux', code: 'E01', confiance: 0.9, explication: 'x' }],
      copiePropre: true,
    })
    expect(extraction.copiePropre).toBe(true)
    expect(erreurs).toHaveLength(0)
  })

  it('sans annotation, la copie est propre', () => {
    const { extraction, erreurs } = analyserTexte({ annotations: [], copiePropre: false })
    expect(extraction.copiePropre).toBe(true)
    expect(erreurs).toHaveLength(0)
  })

  it('les règles locales s’appliquent : seuil, code inconnu, E11', () => {
    const { erreurs } = decouperAnalyse({
      annotations: [
        { ligne: 'a', annotation: 'signe !', code: 'E01', confiance: 0.9, explication: 'x' },
        { ligne: 'b', annotation: '?', code: 'E42', confiance: 0.9, explication: 'x' },
        { ligne: 'c', annotation: '?', code: 'E01', confiance: 0.4, explication: 'x' },
        { ligne: 'd', annotation: 'recopie', code: 'E11', confiance: 0.9, explication: 'x' },
      ],
      copiePropre: false,
    })
    expect(erreurs.map((e) => e.code)).toEqual(['E01', 'E99', 'E99', 'E11'])
    expect(erreurs[3]!.ponderee).toBe(false)
  })

  it('l’extraction conserve les champs utiles au diagnostic affiché', () => {
    const { extraction } = decouperAnalyse({
      annotations: [
        {
          ligne: 'a',
          annotation: 'faux',
          code: 'E01',
          confiance: 0.9,
          explication: 'x',
          eleve: '-6x - 10',
          zone: { x: 0.1, y: 0.2, largeur: 0.3, hauteur: 0.04 },
        },
      ],
      copiePropre: false,
      nomDetecte: 'Léa M.',
    })
    expect(extraction.annotations[0]?.eleve).toBe('-6x - 10')
    expect(extraction.annotations[0]?.zone?.x).toBe(0.1)
    expect(extraction.nomDetecte).toBe('Léa M.')
  })
})

describe('seconde passe sur les fautes peu sûres (lot 3)', () => {
  it('le seuil de revue exclut E99 et les confiances nulles', () => {
    expect(aRevoir(erreur({ code: 'E01', confiance: SEUIL_REVUE - 0.01 }))).toBe(true)
    expect(aRevoir(erreur({ code: 'E01', confiance: SEUIL_REVUE }))).toBe(false)
    expect(aRevoir(erreur({ code: 'E99', confiance: 0.5 }))).toBe(false)
    expect(aRevoir(erreur({ code: 'E01', confiance: 0 }))).toBe(false)
  })

  it('on ne reverra que les moins sûres, dans la limite fixée', () => {
    const erreurs = Array.from({ length: MAX_FAUTES_A_REVOIR + 3 }, (_, i) =>
      erreur({ code: 'E01', confiance: 0.3 + i * 0.05 }),
    )
    const indices = indicesASurveiller(erreurs)
    expect(indices).toHaveLength(MAX_FAUTES_A_REVOIR)
    expect(indices[0]).toBe(0)
    expect(erreurs[indices[0]!]!.confiance).toBeLessThan(erreurs[indices[1]!]!.confiance)
  })

  it('confirmer, reclasser, rétrograder — et rien d’autre ne bouge', () => {
    const erreurs = [
      erreur({ code: 'E01', confiance: 0.95 }), // hors revue : intouchable
      erreur({ code: 'E04', confiance: 0.6 }), // revue : reclasse en E01
      erreur({ code: 'E12', confiance: 0.5 }), // revue : rétrograde en E99
    ]
    const indices = indicesASurveiller(erreurs)
    expect(indices).toEqual([2, 1])
    const verdicts = [
      { index: 0, code: 'E99', confiance: 0.3, explication: 'annotation illisible', decision: 'retrograde' },
      { index: 1, code: 'E01', confiance: 0.88, explication: 'signe perdu', decision: 'reclasse' },
    ]
    const { erreurs: revues, modifiees } = appliquerRevue(erreurs, indices, verdicts)
    expect(revues[0]).toEqual(erreurs[0])
    expect(revues[2]!.code).toBe('E99')
    expect(revues[1]!.code).toBe('E01')
    expect(revues[1]!.confiance).toBe(0.88)
    expect(modifiees).toBe(2)
  })

  it('aucune faute douteuse : aucun appel au modèle', async () => {
    const resultat = await revoirFautesPeuSures([erreur({ code: 'E01', confiance: 0.95 })], transport, clientSimule([]))
    expect(resultat.revues).toBe(0)
    expect(resultat.erreurs).toHaveLength(1)
  })

  it('une faute douteuse : un appel, verdict appliqué', async () => {
    const reponse = JSON.stringify({
      fautes: [{ index: 0, code: 'E99', confiance: 0.3, explication: 'Trop ambigu pour trancher.', decision: 'retrograde' }],
    })
    const resultat = await revoirFautesPeuSures(
      [erreur({ code: 'E05', confiance: 0.62 })],
      transport,
      clientSimule([reponse]),
    )
    expect(resultat.revues).toBe(1)
    expect(resultat.erreurs[0]!.code).toBe('E99')
    expect(messageRevue([erreur({ code: 'E05', confiance: 0.62 })], [0])).toContain('code proposé : E05')
    expect(PROMPT_REVUE).toContain('E12')
  })
})
