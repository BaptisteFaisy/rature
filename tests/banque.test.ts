import { describe, expect, it } from 'vitest'
import { BANQUE, exercicePour, exerciceVerifie, exercicesDe, origineExercice } from '../src/domain/banque'
import { CODES_ERREUR, libelleDe } from '../src/domain/taxonomy'
import type { CodeErreur } from '../src/domain/taxonomy'

/**
 * La banque remplace deux appels réseau : si un exercice est hors sujet, le
 * produit sert un exercice qui ne travaille pas la faille de l'élève. Ces tests
 * sont donc le garde-fou de la banque — ils vérifient que chaque énoncé fait
 * bien faire le geste de son type.
 */
/** Limites de mots : « positif ou nul » n'est pas un mot culpabilisant. */
const MOTS_INTERDITS = [
  /tu t'es trompé/,
  /tu as faux/,
  // « nul » retiré : en maths, « positif ou nul » est un mot légitime ; les
  // autres termes sont sans ambiguïté.
  /\bgrave\b/,
  /\bhonte\b/,
  /\bincapable\b/,
  /toujours faux/,
]

/** Mot-clé du geste attendu dans l'énoncé, par code. */
const SIGNATURES: Record<string, RegExp> = {
  E01: /-\s*\d*\s*\(/, // un facteur négatif devant une parenthèse
  E02: /\d?\(?x?\)?\(/, // une parenthèse à développer
  E03: /²|\) ?\(/, // un carré ou un produit de deux binômes
  E04: /\d\/\d/, // des fractions
  E05: /domaine|x² = |√\(/, // valeur interdite, deux racines, domaine
  E06: /[²³ⁿ]|x⁵|÷ x/, // des exposants
  E07: /√/, // des racines
  E08: /=/, // une équation à transposer
  E09: /exact|arrondi/i, // la précision
  E10: /unité|m²|km\/h|Convertis/i, // les unités
  E11: /Recopie/i, // la recopie
  E12: /Montre|Prouve|justif/i, // la justification
}

describe('banque d’exercices locale (idée 1)', () => {
  it('couvre les 12 codes avec 3 exercices et les 3 difficultés', () => {
    for (const code of CODES_ERREUR) {
      const liste = BANQUE[code]
      expect(liste, `${code} absent de la banque`).toHaveLength(3)
      expect(liste.map((e) => e.difficulte).sort()).toEqual([1, 2, 3])
      for (const exercice of liste) {
        expect(exercice.code).toBe(code)
        expect(exercice.niveau).toMatch(/seconde|première/)
      }
    }
  })

  it('identifiants uniques sur toute la banque', () => {
    const ids = CODES_ERREUR.flatMap((code) => BANQUE[code].map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(36)
  })

  it('aucun champ vide, un ou deux indices, une solution qui explique', () => {
    for (const code of CODES_ERREUR) {
      for (const exercice of BANQUE[code]) {
        expect(exercice.enonce.trim().length).toBeGreaterThan(8)
        expect(exercice.solution.trim().length).toBeGreaterThan(10)
        expect(exercice.piege.trim().length).toBeGreaterThan(5)
        expect(exercice.indices.length).toBeGreaterThanOrEqual(1)
        expect(exercice.indices.length).toBeLessThanOrEqual(2)
        expect(exercice.indices[0]!.length).toBeGreaterThan(8)
        // Un indice ne doit pas donner la réponse finale.
        expect(exercice.indices[0]).not.toBe(exercice.solution)
      }
    }
  })

  it('chaque énoncé fait bien faire le geste de son type', () => {
    for (const code of CODES_ERREUR) {
      const signature = SIGNATURES[code]!
      for (const exercice of BANQUE[code]) {
        expect(
          signature.test(exercice.enonce),
          `${exercice.id} (${libelleDe(code)}) : « ${exercice.enonce} » ne correspond pas au geste attendu`,
        ).toBe(true)
      }
    }
  })

  it('ton bienveillant : aucun mot culpabilisant', () => {
    for (const code of CODES_ERREUR) {
      for (const exercice of BANQUE[code]) {
        const texte = `${exercice.enonce} ${exercice.indices.join(' ')} ${exercice.solution} ${exercice.piege}`.toLowerCase()
        for (const mot of MOTS_INTERDITS) {
          expect(mot.test(texte), `${exercice.id} contient « ${mot.source} »`).toBe(false)
        }
      }
    }
  })

  it('E99 n’a pas d’exercice : on ne travaille pas une faute non typée', () => {
    expect(exercicesDe('E99')).toEqual([])
    expect(exercicesDe('ZZZ' as CodeErreur)).toEqual([])
    expect(exercicePour('E99')).toBeUndefined()
  })

  it('exercicePour respecte la difficulté et évite les exercices déjà vus', () => {
    expect(exercicePour('E01', { difficulte: 2 })?.difficulte).toBe(2)
    const premier = exercicePour('E04', { graine: 0 })!
    const second = exercicePour('E04', { graine: 0, exclure: [premier.id] })!
    expect(second.id).not.toBe(premier.id)
  })

  it('déterministe à options égales', () => {
    const a = exercicePour('E06', { graine: 1 })
    const b = exercicePour('E06', { graine: 1 })
    expect(a).toEqual(b)
  })

  it('retombe sur un exercice du même type quand tout est exclu', () => {
    const tous = BANQUE.E07.map((e) => e.id)
    const resultat = exercicePour('E07', { exclure: tous })
    expect(resultat).toBeDefined()
    expect(resultat!.code).toBe('E07')
  })

  it('la conversion produit un exercice vérifié, marqué comme venant de la banque', () => {
    const exercice = exerciceVerifie(BANQUE.E01[0]!)
    expect(exercice.exercice.typeTravaille).toBe('E01')
    expect(exercice.exercice.tentative).toBe(0)
    expect(exercice.verdict.travailleLeBonType).toBe(true)
    expect(exercice.verdict.neDonneLaSolutionOrigine).toBe(true)
    expect(exercice.verdict.memeNiveau).toBe(true)
    expect(origineExercice(exercice.exercice)).toContain('banque locale')
    expect(origineExercice({ ...exercice.exercice, tentative: 1 })).toContain('inédit')
  })
})
