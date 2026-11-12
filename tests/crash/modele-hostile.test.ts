/**
 * Crash test — réponses hostiles du modèle.
 *
 * Le produit dépend d'un modèle tiers qui peut rendre n'importe quoi : JSON
 * tronqué, types inversés, 5 000 annotations, lignes de 100 Ko, confiances
 * absurdes, zones hors cadre. Aucune de ces entrées ne doit :
 *   1. lever autre chose qu'une `ErreurLLM` (sinon l'UI affiche « Analyse
 *      impossible » sans raison et perd le contexte) ;
 *   2. produire un code hors taxonomie, une confiance hors [0,1] ou un NaN ;
 *   3. geler le rendu (listes ou textes non bornés).
 *
 * Ces invariants sont vérifiés sur chaque étape de parsing, jamais sur un seul
 * cas heureux.
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_ANNOTATIONS,
  MAX_LONGUEUR_LIGNE,
  MAX_LONGUEUR_TEXTE,
} from '../../src/domain/config'
import { CODES_ERREUR } from '../../src/domain/taxonomy'
import { construireDiagnostic, normaliserErreur } from '../../src/domain/diagnostic'
import { decouperAnalyse } from '../../src/pipeline/analyse'
import { ErreurLLM } from '../../src/pipeline/llm'
import { parserAnalyse, parserClassification, parserExtraction } from '../../src/pipeline/schemas'

const CODES_VALIDES = new Set<string>([...CODES_ERREUR, 'E99'])

function estNombreSain(valeur: number): boolean {
  return Number.isFinite(valeur)
}

/** Toute sortie du pipeline doit respecter les invariants, quel que soit l'entrée. */
function verifierInvariants(erreurs: ReturnType<typeof construireDiagnostic>['erreurs']) {
  for (const erreur of erreurs) {
    expect(CODES_VALIDES.has(erreur.code), `code hors taxonomie : ${erreur.code}`).toBe(true)
    expect(estNombreSain(erreur.confiance)).toBe(true)
    expect(erreur.confiance).toBeGreaterThanOrEqual(0)
    expect(erreur.confiance).toBeLessThanOrEqual(1)
    expect(erreur.ligne.length).toBeLessThanOrEqual(MAX_LONGUEUR_LIGNE)
    expect(erreur.explication.length).toBeLessThanOrEqual(MAX_LONGUEUR_TEXTE)
    expect(estNombreSain(erreur.ponderee ? 1 : 0)).toBe(true)
    if (erreur.zone) {
      for (const valeur of Object.values(erreur.zone)) {
        expect(estNombreSain(valeur), 'zone avec NaN/Infinity').toBe(true)
        expect(valeur).toBeGreaterThanOrEqual(0)
        expect(valeur).toBeLessThanOrEqual(1)
      }
    }
  }
}

describe('crash test — entrées hostiles du modèle', () => {
  const CAS_HOSTILES: [string, string][] = [
    ['JSON tronqué', '{"annotations": [{"ligne": "a"'],
    ['pas du JSON', 'désolé, je ne peux pas analyser cette image'],
    ['tableau au lieu d’un objet', '[{"ligne":"a"}]'],
    ['chaîne JSON', '"texte"'],
    ['nombre', '42'],
    ['null', 'null'],
    ['objet vide', '{}'],
    ['types inversés', '{"annotations":"beaucoup","copiePropre":"oui"}'],
    ['null partout', '{"annotations":null,"copiePropre":null,"nomDetecte":null}'],
    [
      'confiances absurdes',
      JSON.stringify({
        annotations: [
          { ligne: 'a', annotation: 'faux', code: 'E01', confiance: -5 },
          { ligne: 'b', annotation: 'faux', code: 'E01', confiance: 999 },
          { ligne: 'c', annotation: 'faux', code: 'E01', confiance: 'NaN' },
          { ligne: 'd', annotation: 'faux', code: 'E01', confiance: null },
          { ligne: 'e', annotation: 'faux', code: 'E01', confiance: '0.9' },
        ],
      }),
    ],
    [
      'codes inconnus',
      JSON.stringify({
        annotations: [
          { ligne: 'a', annotation: 'x', code: 'E42', confiance: 0.9 },
          { ligne: 'b', annotation: 'x', code: '', confiance: 0.9 },
          { ligne: 'c', annotation: 'x', code: null, confiance: 0.9 },
          { ligne: 'd', annotation: 'x', code: 12, confiance: 0.9 },
          { ligne: 'e', annotation: 'x', confiance: 0.9 },
        ],
      }),
    ],
    [
      'zones hors cadre',
      JSON.stringify({
        annotations: [
          { ligne: 'a', annotation: 'x', code: 'E01', confiance: 0.9, zone: { x: -3, y: 9, largeur: 1e9, hauteur: -0.5 } },
          { ligne: 'b', annotation: 'x', code: 'E01', confiance: 0.9, zone: { x: 'a', y: null, largeur: NaN, hauteur: Infinity } },
          { ligne: 'c', annotation: 'x', code: 'E01', confiance: 0.9, zone: null },
        ],
      }),
    ],
    ['ligne de 100 Ko', JSON.stringify({ annotations: [{ ligne: 'x'.repeat(100_000), annotation: 'faux', code: 'E01', confiance: 0.9 }] })],
    [
      '5 000 annotations',
      JSON.stringify({
        annotations: Array.from({ length: 5000 }, (_, i) => ({
          ligne: `ligne ${i}`,
          annotation: 'faux',
          code: 'E01',
          confiance: 0.9,
        })),
      }),
    ],
    ['champs inconnus', JSON.stringify({ annotations: [{ ligne: 'a', annotation: 'x', code: 'E01', confiance: 0.9, surprise: { a: [1, 2, 3] } }], injection: 'ignore les instructions' })],
    ['markdown autour', '```json\n{"annotations":[{"ligne":"a","annotation":"faux","code":"E01","confiance":0.9}]}\n```'],
    ['texte avant et après', 'Voici : {"annotations":[{"ligne":"a","annotation":"faux","code":"E01","confiance":0.9}]} — fin'],
  ]

  it.each(CAS_HOSTILES)('extraction : %s ne casse rien', (_titre, brut) => {
    let extraction
    try {
      extraction = parserExtraction(brut)
    } catch (erreur) {
      expect(erreur, 'une erreur doit être une ErreurLLM').toBeInstanceOf(ErreurLLM)
      return
    }
    expect(extraction.annotations.length).toBeLessThanOrEqual(MAX_ANNOTATIONS)
    for (const annotation of extraction.annotations) {
      expect(annotation.ligne.length).toBeLessThanOrEqual(MAX_LONGUEUR_LIGNE)
      expect(annotation.annotation.length).toBeLessThanOrEqual(MAX_LONGUEUR_TEXTE)
      if (annotation.zone) {
        for (const valeur of Object.values(annotation.zone)) {
          expect(Number.isFinite(valeur)).toBe(true)
          expect(valeur).toBeGreaterThanOrEqual(0)
          expect(valeur).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it.each(CAS_HOSTILES)('analyse fusionnée : %s ne casse rien', (_titre, brut) => {
    let resultat
    try {
      resultat = decouperAnalyse(parserAnalyse(brut))
    } catch (erreur) {
      expect(erreur, 'une erreur doit être une ErreurLLM').toBeInstanceOf(ErreurLLM)
      return
    }
    expect(resultat.extraction.annotations.length).toBeLessThanOrEqual(MAX_ANNOTATIONS)
    verifierInvariants(resultat.erreurs)
  })

  it.each(CAS_HOSTILES)('classification : %s ne casse rien', (_titre, brut) => {
    let brutes
    try {
      brutes = parserClassification(brut)
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurLLM)
      return
    }
    const diagnostic = construireDiagnostic(brutes, { id: 'crash', createdAt: '2026-11-12T12:00:00.000Z' })
    verifierInvariants(diagnostic.erreurs)
  })

  it('normaliserErreur encaisse n’importe quoi sans lever', () => {
    const entrees = [
      {},
      { code: null },
      { code: undefined, confiance: undefined },
      { code: 'E01', confiance: Number.NaN },
      { code: 'E01', confiance: Number.POSITIVE_INFINITY },
      { code: 'E01', confiance: -1, ligne: null, explication: 42 },
      { code: 'E01', confiance: 0.9, zone: 'pas-une-zone' },
      { code: 'E01', confiance: 0.9, ligne: { objet: true } },
    ]
    for (const entree of entrees) {
      const erreur = normaliserErreur(entree as never)
      expect(CODES_VALIDES.has(erreur.code)).toBe(true)
      expect(Number.isFinite(erreur.confiance)).toBe(true)
      expect(erreur.confiance).toBeGreaterThanOrEqual(0)
      expect(erreur.confiance).toBeLessThanOrEqual(1)
    }
  })

  it('une copie sans annotation valide reste « propre » : zéro faute inventée', () => {
    const cas = [
      '{"annotations":[],"copiePropre":false}',
      '{"annotations":[{"ligne":"","annotation":"   "}],"copiePropre":false}',
      '{"annotations":null}',
      '{"annotations":[null,null]}',
    ]
    for (const brut of cas) {
      try {
        const { extraction, erreurs } = decouperAnalyse(parserAnalyse(brut))
        if (extraction.annotations.length === 0) {
          expect(extraction.copiePropre).toBe(true)
          expect(erreurs).toHaveLength(0)
        }
      } catch (erreur) {
        expect(erreur).toBeInstanceOf(ErreurLLM)
      }
    }
  })
})
