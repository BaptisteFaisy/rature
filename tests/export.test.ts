import { describe, expect, it } from 'vitest'
import { statsClasse } from '../src/domain/classe'
import { construireDiagnostic } from '../src/domain/diagnostic'
import { agreger, profilVide } from '../src/domain/profil'
import { ficheEnMarkdown, nomFichierDate, profilEnCsv, statsEnCsv } from '../src/export/exports'

const id = { id: 'd1', createdAt: '2026-11-11T10:00:00.000Z' }

function jeuDeTest() {
  const diagnostic = construireDiagnostic(
    [
      { code: 'E01', ligne: '-2(3x-5)', explication: 'signe', confiance: 0.9 },
      { code: 'E01', ligne: 'autre', explication: 'signe', confiance: 0.8 },
      { code: 'E04', ligne: '1/3+1/4', explication: 'dénominateur', confiance: 0.7 },
    ],
    id,
  )
  return { profil: agreger(profilVide(), diagnostic), diagnostics: [diagnostic] }
}

describe('export CSV du profil (RF-21)', () => {
  it('en-tête, tri par fréquence et total', () => {
    const csv = profilEnCsv(jeuDeTest().profil)
    const lignes = csv.split('\n')
    expect(lignes[0]).toBe('code,libelle,occurrences,part_pourcent')
    expect(lignes[1]).toContain('E01')
    expect(lignes[1]).toContain('67')
    expect(lignes.at(-1)).toContain('total')
  })

  it('un profil vide ne casse pas l’export', () => {
    const csv = profilEnCsv(profilVide())
    expect(csv).not.toContain('undefined')
    expect(csv.split('\n')).toHaveLength(2)
  })
})

describe('fiche de révision Markdown (RF-22)', () => {
  it('cite le type dominant et reste bienveillante', () => {
    const { profil, diagnostics } = jeuDeTest()
    const fiche = ficheEnMarkdown(profil, diagnostics)
    expect(fiche).toContain('signe perdu')
    expect(fiche.toLowerCase()).not.toContain('tu as fait')
    expect(fiche).toContain('Mes dernières copies')
  })

  it('profil vide : message d’invitation, pas de tableau', () => {
    expect(ficheEnMarkdown(profilVide(), [])).toContain('Aucune erreur récurrente')
  })
})

describe('mode prof (RF-20)', () => {
  it('statistique de classe et son CSV', () => {
    const { diagnostics } = jeuDeTest()
    const stats = statsClasse([...diagnostics, ...diagnostics])
    expect(stats.nbCopies).toBe(2)
    expect(stats.typeLePlusFrequent).toBe('E01')
    expect(stats.pourcentageTypeFrequent).toBe(67)
    expect(statsEnCsv(stats).split('\n')[0]).toBe('nb_copies,code,libelle,occurrences,part_pourcent')
  })

  it('nom de fichier daté', () => {
    expect(nomFichierDate('rature-profil', 'csv')).toMatch(/^rature-profil-\d{4}-\d{2}-\d{2}T.*\.csv$/)
  })
})
