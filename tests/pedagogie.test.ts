import { describe, expect, it } from 'vitest'
import { CODES_ERREUR, libelleDe } from '../src/domain/taxonomy'
import { explicationDe, glossaire } from '../src/domain/pedagogie'

const MOTS_CULPABILISANTS = ["tu t'es trompé", 'tu as faux', 'nul', 'grave', 'honte', 'incapable', 'toujours faux']

function mots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length
}

describe('contenu pédagogique par type (lot 4)', () => {
  it('les 12 codes sont couverts, dans l’ordre, et E99 n’a pas d’explication', () => {
    const codes = glossaire().map((e) => e.code)
    expect(codes).toEqual([...CODES_ERREUR])
    expect(explicationDe('E99')).toBeNull()
  })

  it('chaque entrée a tous ses champs renseignés', () => {
    for (const code of CODES_ERREUR) {
      const e = explicationDe(code)!
      expect(e.titre).toBe(libelleDe(code))
      for (const champ of [e.pourquoi, e.geste, e.exemple, e.contreExemple, e.piege] as const) {
        expect(champ.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('pourquoi et geste restent courts (≤ 25 mots)', () => {
    for (const code of CODES_ERREUR) {
      const e = explicationDe(code)!
      expect(mots(e.pourquoi)).toBeLessThanOrEqual(25)
      expect(mots(e.geste)).toBeLessThanOrEqual(25)
    }
  })

  it('exemple et contre-exemple diffèrent (sinon rien n’est montré)', () => {
    for (const code of CODES_ERREUR) {
      const e = explicationDe(code)!
      expect(e.exemple).not.toBe(e.contreExemple)
    }
  })

  it('ton bienveillant : aucun mot culpabilisant', () => {
    for (const code of CODES_ERREUR) {
      const e = explicationDe(code)!
      const texte = `${e.pourquoi} ${e.geste} ${e.piege}`.toLowerCase()
      for (const mot of MOTS_CULPABILISANTS) {
        expect(texte, `${code} contient « ${mot} »`).not.toContain(mot)
      }
    }
  })

  it('chaque piège renvoie vers un AUTRE code (aide à distinguer deux types proches)', () => {
    for (const code of CODES_ERREUR) {
      const e = explicationDe(code)!
      const autres = CODES_ERREUR.filter((c) => c !== code)
      expect(autres.some((c) => e.piege.includes(c)), `${code} : piège sans autre code`).toBe(true)
    }
  })
})