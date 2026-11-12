/**
 * Crash test — volume. Un élève assidu, un professeur qui photographie un paquet
 * de 200 copies, un historique qui grossit pendant des mois : rien ne doit
 * ralentir au point de geler l'UI, ni produire de NaN, ni exploser en mémoire.
 *
 * Les bornes de temps sont volontairement larges (une CI sur runner partagé
 * varie) : l'objectif est d'attraper une complexité quadratique, pas de battre
 * un record.
 */
import { describe, expect, it } from 'vitest'
import { statsClasse } from '../../src/domain/classe'
import { construireDiagnostic } from '../../src/domain/diagnostic'
import { CODES_ERREUR } from '../../src/domain/taxonomy'
import type { CodeErreur } from '../../src/domain/taxonomy'
import { agreger, classement, partDuType, phraseSynthese, profilVide, totalPondere } from '../../src/domain/profil'
import { occurrencesParCopie, pointsCourbe, tendance } from '../../src/domain/progression'
import { ficheEnMarkdown, profilEnCsv, statsEnCsv } from '../../src/export/exports'
import type { Diagnostic, Erreur, Profil } from '../../src/domain/types'

/** Générateur déterministe : même graine, même corpus (pas de test qui flotte). */
function aleatoire(graine: number): () => number {
  let etat = graine
  return () => {
    etat = (etat * 1103515245 + 12345) % 2147483648
    return etat / 2147483648
  }
}

function erreurDe(code: CodeErreur, confiance: number): Erreur {
  return {
    code,
    libelle: code,
    ligne: 'une ligne de calcul',
    explication: 'une explication courte',
    confiance,
    ponderee: code !== 'E11' && code !== 'E99',
  }
}

function corpus(nbCopies: number, nbFautesParCopie: number, graine = 7): Diagnostic[] {
  const tirage = aleatoire(graine)
  return Array.from({ length: nbCopies }, (_, index) => {
    const fautes = Array.from({ length: nbFautesParCopie }, () => {
      const code = CODES_ERREUR[Math.floor(tirage() * CODES_ERREUR.length)]!
      return erreurDe(code, 0.6 + tirage() * 0.4)
    })
    return construireDiagnostic(fautes, {
      id: `copie-${index}`,
      createdAt: new Date(Date.UTC(2026, 10, 1) + index * 86_400_000).toISOString(),
    })
  })
}

describe('crash test — volume', () => {
  it('1 000 copies agrégées en moins d’une seconde, sans NaN', () => {
    const copies = corpus(1000, 4)
    const debut = Date.now()
    let profil: Profil = profilVide()
    for (const copie of copies) profil = agreger(profil, copie)
    const duree = Date.now() - debut

    expect(duree).toBeLessThan(1000)
    expect(profil.totalAnalyses).toBe(1000)
    expect(profil.evolution).toHaveLength(1000)
    const total = totalPondere(profil)
    expect(Number.isFinite(total)).toBe(true)
    expect(total).toBeGreaterThan(0)
    for (const code of CODES_ERREUR) {
      const part = partDuType(profil, code)
      expect(Number.isFinite(part)).toBe(true)
      expect(part).toBeGreaterThanOrEqual(0)
      expect(part).toBeLessThanOrEqual(1)
    }
    const sommeParts = CODES_ERREUR.reduce((somme, code) => somme + partDuType(profil, code), 0)
    expect(Math.abs(sommeParts - 1)).toBeLessThan(0.001)
  })

  it('classement et phrase de synthèse restent bornés avec 1 000 copies', () => {
    const copies = corpus(1000, 4)
    let profil = profilVide()
    for (const copie of copies) profil = agreger(profil, copie)

    const lignes = classement(profil)
    expect(lignes.length).toBeLessThanOrEqual(CODES_ERREUR.length)
    expect(lignes[0]!.n).toBeGreaterThanOrEqual(lignes[lignes.length - 1]!.n)
    const phrase = phraseSynthese(profil)
    expect(phrase.length).toBeLessThan(200)
    expect(phrase).not.toContain('NaN')
  })

  it('les exports ne grossissent pas avec l’historique (pas de fichier de 10 Mo)', () => {
    const copies = corpus(1000, 4)
    let profil = profilVide()
    for (const copie of copies) profil = agreger(profil, copie)

    const csv = profilEnCsv(profil)
    expect(csv.split('\n').length).toBeLessThanOrEqual(CODES_ERREUR.length + 2)
    expect(csv).not.toContain('NaN')

    const fiche = ficheEnMarkdown(profil, copies)
    // La fiche liste les 5 dernières copies, pas les 1 000.
    expect(fiche.split('\n').length).toBeLessThan(40)
    expect(fiche).not.toContain('NaN')

    const stats = statsClasse(copies)
    const csvClasse = statsEnCsv(stats)
    expect(stats.nbCopies).toBe(1000)
    expect(csvClasse.split('\n').length).toBeLessThanOrEqual(CODES_ERREUR.length + 2)
    expect(csvClasse).not.toContain('NaN')
  })

  it('trajectoire sur 1 000 copies : série complète, tendance cohérente', () => {
    const copies = corpus(1000, 3)
    const serie = occurrencesParCopie(copies, 'E01')
    expect(serie).toHaveLength(1000)
    expect(serie.every((n) => Number.isInteger(n) && n >= 0)).toBe(true)
    expect(['baisse', 'hausse', 'stable']).toContain(tendance(serie))
    expect(pointsCourbe(serie)).toHaveLength(1000)
  })

  it('mode prof : 200 copies d’un paquet, statistique exacte et rapide', () => {
    const copies = corpus(200, 5)
    const debut = Date.now()
    const stats = statsClasse(copies)
    expect(Date.now() - debut).toBeLessThan(300)

    const attendu = copies.reduce(
      (somme, copie) => somme + copie.erreurs.filter((erreur) => erreur.ponderee).length,
      0,
    )
    const obtenu = Object.values(stats.parType).reduce((somme, n) => somme + n, 0)
    expect(obtenu).toBe(attendu)
    expect(stats.copiesParType).toHaveLength(200)
    expect(stats.pourcentageTypeFrequent).toBeGreaterThanOrEqual(0)
    expect(stats.pourcentageTypeFrequent).toBeLessThanOrEqual(100)
  })

  it('un diagnostic géant (5 000 fautes brutes) ne casse ni le dominant ni l’agrégation', () => {
    const brutes = Array.from({ length: 5000 }, (_, index) => ({
      code: index % 3 === 0 ? 'E01' : index % 3 === 1 ? 'E04' : 'ZZZ',
      ligne: `ligne ${index}`,
      explication: 'x',
      confiance: 0.9,
    }))
    const diagnostic = construireDiagnostic(brutes, { id: 'geant', createdAt: '2026-11-12T12:00:00.000Z' })
    expect(diagnostic.nbFautes).toBe(5000)
    expect(diagnostic.typeDominant).toBe('E01')
    const profil = agreger(profilVide(), diagnostic)
    expect(profil.parType.E01).toBeGreaterThan(0)
    expect(profil.parType.E99).toBe(0)
    expect(profil.signalees.E99).toBeGreaterThan(0)
  })

  it('valeurs extrêmes : aucune propagation de NaN ou d’Infinity', () => {
    const extremes = construireDiagnostic(
      [
        { code: 'E01', ligne: 'a', explication: 'b', confiance: Number.MAX_VALUE },
        { code: 'E02', ligne: 'c', explication: 'd', confiance: Number.MIN_VALUE },
        { code: 'E03', ligne: 'e', explication: 'f', confiance: -Number.MAX_VALUE },
      ],
      { id: 'extreme', createdAt: '2026-11-12T12:00:00.000Z' },
    )
    for (const erreur of extremes.erreurs) {
      expect(Number.isFinite(erreur.confiance)).toBe(true)
      expect(erreur.confiance).toBeGreaterThanOrEqual(0)
      expect(erreur.confiance).toBeLessThanOrEqual(1)
    }
    const profil = agreger(profilVide(), extremes)
    expect(phraseSynthese(profil)).not.toContain('NaN')
    expect(profilEnCsv(profil)).not.toContain('Infinity')
  })
})
