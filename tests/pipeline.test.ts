import { describe, expect, it } from 'vitest'
import { normaliserZone, zoneBandeau } from '../src/pipeline/anonymize'
import { blocTaxonomie, messageAnnotations, PROMPT_CLASSIFICATION } from '../src/pipeline/classify'
import { clientSimule } from '../src/pipeline/client'
import { codesDe } from '../src/pipeline/orchestrate'
import {
  genererExerciceVerifie,
  messageGardeFou,
  verdictAccepte,
} from '../src/pipeline/exercise'
import { calculerDimensions, etirerNiveaux, verifierTaille } from '../src/pipeline/ingest'
import {
  ErreurLLM,
  construireCorps,
  construireMessages,
  extraireJson,
  transportParDefaut,
} from '../src/pipeline/llm'
import { parserExtraction } from '../src/pipeline/schemas'

const transport = transportParDefaut('/api/test')

describe('parsing tolérant des réponses du modèle', () => {
  it('accepte un JSON encadré de texte', () => {
    expect(extraireJson('voici : {"a":1} — fin')).toEqual({ a: 1 })
  })

  it('lève sur un JSON invalide', () => {
    expect(() => extraireJson('pas du json du tout')).toThrow(ErreurLLM)
  })

  it('une extraction sans annotation marque la copie propre', () => {
    const extraction = parserExtraction(JSON.stringify({ annotations: [], copiePropre: false }))
    expect(extraction.copiePropre).toBe(true)
    expect(extraction.annotations).toHaveLength(0)
  })

  it('une annotation sans texte est écartée : rien à diagnostiquer', () => {
    const extraction = parserExtraction(
      JSON.stringify({ annotations: [{ ligne: 'x', annotation: '   ' }], copiePropre: false }),
    )
    expect(extraction.copiePropre).toBe(true)
  })
})

describe('construction des requêtes', () => {
  it('texte seul : le contenu est une chaîne', () => {
    const messages = construireMessages({ system: 's', user: 'u' })
    expect(messages).toHaveLength(2)
    expect((messages[1] as { content: string }).content).toBe('u')
  })

  it('avec image : le contenu est une liste de parties', () => {
    const messages = construireMessages({ system: 's', user: 'u', image: 'data:image/png;base64,AA' })
    expect((messages[1] as { content: unknown[] }).content).toHaveLength(2)
  })

  it('le mode JSON pose response_format', () => {
    expect(construireCorps({ system: 's', user: 'u', json: true }, 'm')).toHaveProperty('response_format')
  })

  it('la taxonomie entière figure dans le prompt, sans marqueur résiduel', () => {
    expect(blocTaxonomie()).toContain('E12')
    expect(PROMPT_CLASSIFICATION).toContain('E01')
    expect(PROMPT_CLASSIFICATION).not.toContain('{{TAXONOMIE}}')
  })

  it('les annotations sont numérotées pour le modèle', () => {
    const message = messageAnnotations({
      annotations: [{ ligne: 'a', annotation: 'faux' }],
      copiePropre: false,
    })
    expect(message).toContain('1. ligne : a')
  })
})

describe('garde-fou de l’exercice (§18.3)', () => {
  const exercice = {
    enonce: 'Développe -2(3x - 5)',
    indices: ['Écris chaque produit séparément.'],
    solution: '-6x + 10',
    typeTravaille: 'E01' as const,
    niveau: 'seconde',
    tentative: 1,
  }
  const refus = JSON.stringify({
    travailleLeBonType: false,
    neDonneLaSolutionOrigine: true,
    memeNiveau: true,
    motifs: ['hors sujet'],
  })
  const accepte = JSON.stringify({
    travailleLeBonType: true,
    neDonneLaSolutionOrigine: true,
    memeNiveau: true,
    motifs: [],
  })

  it('verdict complet → accepté, un critère refusé → refus', () => {
    expect(verdictAccepte({ travailleLeBonType: true, neDonneLaSolutionOrigine: true, memeNiveau: true, motifs: [] })).toBe(true)
    expect(verdictAccepte({ travailleLeBonType: false, neDonneLaSolutionOrigine: true, memeNiveau: true, motifs: [] })).toBe(false)
  })

  it('deux tentatives refusées → exercice null et message honnête', async () => {
    const resultat = await genererExerciceVerifie({
      typeDominant: 'E01',
      extraitCopie: '-2(3x - 5)',
      transport,
      client: clientSimule([JSON.stringify(exercice), refus, JSON.stringify(exercice), refus]),
    })
    expect(resultat.exercice).toBeNull()
    expect(resultat.message).toContain('non disponible')
  })

  it('premier verdict valide → exercice rendu avec son verdict', async () => {
    const resultat = await genererExerciceVerifie({
      typeDominant: 'E01',
      extraitCopie: '-2(3x - 5)',
      transport,
      client: clientSimule([JSON.stringify(exercice), accepte]),
    })
    expect(resultat.exercice?.exercice.enonce).toContain('Développe')
    expect(resultat.exercice?.exercice.tentative).toBe(1)
    expect(messageGardeFou(exercice, 'E01', 'contexte')).toContain('Type visé : E01')
  })
})

describe('étapes pures (ingest et anonymisation)', () => {
  it('redimensionne sans jamais agrandir', () => {
    expect(calculerDimensions(3000, 2000, 1600)).toEqual({ largeur: 1600, hauteur: 1067 })
    expect(calculerDimensions(800, 600, 1600)).toEqual({ largeur: 800, hauteur: 600 })
  })

  it('refuse une photo au-delà de 10 Mo, et un fichier vide', () => {
    expect(() => verifierTaille(11 * 1024 * 1024)).toThrow(ErreurLLM)
    expect(() => verifierTaille(0)).toThrow(ErreurLLM)
    expect(() => verifierTaille(1024)).not.toThrow()
  })

  it('étire les niveaux d’une image terne, laisse une image contrastée intacte', () => {
    const terne = new Uint8ClampedArray([100, 100, 100, 255, 120, 120, 120, 255])
    etirerNiveaux(terne)
    expect(terne[0]).toBeLessThan(100)
    const deja = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    etirerNiveaux(deja)
    expect(deja[0]).toBe(0)
    expect(deja[4]).toBe(255)
  })

  it('le bandeau par défaut reste dans l’image', () => {
    const zone = normaliserZone(zoneBandeau())
    expect(zone.x).toBeGreaterThanOrEqual(0)
    expect(zone.x + zone.largeur).toBeLessThanOrEqual(1)
    expect(zone.y + zone.hauteur).toBeLessThanOrEqual(1)
  })

  it('une zone débordante est ramenée dans l’image', () => {
    const zone = normaliserZone({ x: -0.2, y: 0.9, largeur: 0.5, hauteur: 0.5 })
    expect(zone.x).toBe(0)
    expect(zone.y + zone.hauteur).toBeLessThanOrEqual(1)
  })
})

describe('preuves du pipeline', () => {
  it('la liste des codes est dédupliquée et ordonnée', () => {
    expect(codesDe([{ code: 'E01' }, { code: 'E01' }, { code: 'E11' }, { code: 'E04' }])).toBe('E01, E11, E04')
    expect(codesDe([])).toBe('aucune')
  })
})
