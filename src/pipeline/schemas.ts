/**
 * Schémas et parseurs des réponses du modèle.
 *
 * Deux principes, issus du crash test du 12/11 :
 *  1. **Rien n'entre sans passer d'ici** — un modèle qui répond à côté ne doit
 *     ni casser l'écran, ni inventer une catégorie hors taxonomie ;
 *  2. **Borner et assainir, jamais rejeter en bloc** — une annotation
 *     malformée coûte cette annotation, pas toute la copie ; les textes et les
 *     listes sont plafonnés pour que l'UI ne puisse pas geler.
 *
 * Le typage strict reste garanti en sortie : `Annotation`, `ErreurBrute`,
 * `Exercice`, `VerdictGardeFou`.
 */
import { z } from 'zod'
import { MAX_ANNOTATIONS, MAX_LONGUEUR_LIGNE } from '../domain/config'
import type { Annotation, Extraction, VerdictGardeFou, Zone } from '../domain/types'
import { ErreurLLM, extraireJson } from './llm'
import {
  confianceAssainie,
  listeTolerante,
  plafonner,
  texteAssaini,
  texteOptionnelAssaini,
  zoneAssainie,
} from '../domain/tolerance'

/** Annotation + typage, telle que la rend l'appel fusionné. */
export type AnnotationFusionnee = Annotation & {
  code: string
  confiance: number
  explication: string
}

export type ErreurBrute = {
  code: string
  ligne: string
  explication: string
  confiance: number
  zone?: Zone
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

function interpreterAnnotation(item: unknown): Annotation | null {
  if (!estObjet(item)) return null
  const annotation = texteAssaini(item.annotation, '')
  if (!annotation) return null // rien à diagnostiquer sur une annotation vide
  const ligne = texteAssaini(item.ligne, '', MAX_LONGUEUR_LIGNE)
  const eleve = texteOptionnelAssaini(item.eleve)
  const attendu = texteOptionnelAssaini(item.attendu)
  const zone = zoneAssainie(item.zone)
  return {
    ligne,
    annotation,
    ...(eleve ? { eleve } : {}),
    ...(attendu ? { attendu } : {}),
    ...(zone ? { zone } : {}),
  }
}

function interpreterErreur(item: unknown): ErreurBrute | null {
  if (!estObjet(item)) return null
  const zone = zoneAssainie(item.zone)
  return {
    code: typeof item.code === 'string' ? item.code : '',
    ligne: texteAssaini(item.ligne, '', MAX_LONGUEUR_LIGNE),
    explication: texteAssaini(item.explication, ''),
    confiance: confianceAssainie(item.confiance),
    ...(zone ? { zone } : {}),
  }
}

function interpreterFusionnee(item: unknown): AnnotationFusionnee | null {
  const annotation = interpreterAnnotation(item)
  const erreur = interpreterErreur(item)
  if (!annotation || !erreur) return null
  return { ...annotation, code: erreur.code, confiance: erreur.confiance, explication: erreur.explication }
}

/** Schémas conservés pour les tests et la documentation du contrat. */
export const schemaAnnotation = z.unknown().transform(interpreterAnnotation)
export const schemaErreurBrute = z.unknown().transform(interpreterErreur)

function objetBrut(texte: string, quoi: string): Record<string, unknown> {
  const json = extraireJson(texte)
  if (!estObjet(json) || Array.isArray(json)) {
    throw new ErreurLLM(`Réponse du modèle invalide (${quoi}) : objet JSON attendu.`, 502)
  }
  return json
}

function copiePropreDe(brut: Record<string, unknown>, annotations: unknown[]): boolean {
  // Une copie sans annotation exploitable est une copie propre, même si le
  // modèle affirme le contraire : c'est la garantie RNF-04 (zéro faux positif).
  return annotations.length === 0 || brut.copiePropre === true
}

export function parserExtraction(texte: string): Extraction {
  const brut = objetBrut(texte, 'extraction')
  const annotations = plafonner(listeTolerante(brut.annotations, interpreterAnnotation), MAX_ANNOTATIONS)
  const nomDetecte = texteOptionnelAssaini(brut.nomDetecte)
  return {
    annotations,
    copiePropre: copiePropreDe(brut, annotations),
    ...(nomDetecte ? { nomDetecte } : {}),
  }
}

export function parserAnalyse(texte: string): {
  annotations: AnnotationFusionnee[]
  copiePropre: boolean
  nomDetecte?: string
} {
  const brut = objetBrut(texte, 'analyse')
  const annotations = plafonner(listeTolerante(brut.annotations, interpreterFusionnee), MAX_ANNOTATIONS)
  const nomDetecte = texteOptionnelAssaini(brut.nomDetecte)
  return {
    annotations,
    copiePropre: copiePropreDe(brut, annotations),
    ...(nomDetecte ? { nomDetecte } : {}),
  }
}

export function parserClassification(texte: string): ErreurBrute[] {
  const brut = objetBrut(texte, 'classification')
  return plafonner(listeTolerante(brut.erreurs, interpreterErreur), MAX_ANNOTATIONS)
}

const schemaExercice = z.object({
  enonce: z.unknown(),
  indices: z.unknown(),
  solution: z.unknown(),
  typeTravaille: z.unknown(),
  niveau: z.unknown(),
})

export type ExerciceBrut = {
  enonce: string
  indices: string[]
  solution: string
  typeTravaille: string
  niveau: string
}

export function parserExercice(texte: string): ExerciceBrut {
  const brut = objetBrut(texte, 'exercice')
  const valide = schemaExercice.safeParse(brut)
  const source = (valide.success ? valide.data : brut) as Record<string, unknown>
  const enonce = texteAssaini(source.enonce, '')
  const solution = texteAssaini(source.solution, '')
  if (!enonce || !solution) {
    throw new ErreurLLM('Réponse du modèle invalide (exercice) : énoncé ou solution absente.', 502)
  }
  const indices = plafonner(
    listeTolerante(source.indices, (item) => (typeof item === 'string' && item.trim() ? item.trim() : null)),
    4,
  )
  const niveau = texteAssaini(source.niveau, 'lycée', 60)
  return { enonce, indices, solution, typeTravaille: texteAssaini(source.typeTravaille, '', 10), niveau }
}

const schemaVerdict = z.object({
  travailleLeBonType: z.unknown(),
  neDonneLaSolutionOrigine: z.unknown(),
  memeNiveau: z.unknown(),
  motifs: z.unknown(),
})

export function parserVerdict(texte: string): VerdictGardeFou {
  const brut = objetBrut(texte, 'garde-fou')
  const valide = schemaVerdict.safeParse(brut)
  const source = (valide.success ? valide.data : brut) as Record<string, unknown>
  // Un verdict absent ou illisible est un REFUS : on ne sert jamais un exercice
  // dont la pertinence n'a pas pu être vérifiée.
  return {
    travailleLeBonType: source.travailleLeBonType === true,
    neDonneLaSolutionOrigine: source.neDonneLaSolutionOrigine === true,
    memeNiveau: source.memeNiveau === true,
    motifs: plafonner(
      listeTolerante(source.motifs, (item) => (typeof item === 'string' && item.trim() ? item.trim() : null)),
      5,
    ),
  }
}

const schemaRevue = z.object({ fautes: z.unknown() })

export type FauteRevue = { index: number; code: string; confiance: number; explication: string; decision: string }

export function parserRevue(texte: string): FauteRevue[] {
  const brut = objetBrut(texte, 'revue')
  schemaRevue.parse(brut)
  return plafonner(
    listeTolerante(brut.fautes, (item): FauteRevue | null => {
      if (!estObjet(item)) return null
      const index = Number(item.index)
      if (!Number.isInteger(index) || index < 0) return null
      return {
        index,
        code: typeof item.code === 'string' ? item.code : '',
        confiance: confianceAssainie(item.confiance),
        explication: texteAssaini(item.explication, ''),
        decision: texteAssaini(item.decision, '', 20),
      }
    }),
    MAX_ANNOTATIONS,
  )
}
