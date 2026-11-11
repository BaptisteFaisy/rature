/**
 * Schémas des réponses du modèle. Rien n'entre dans le pipeline sans passer
 * par un de ces parseurs : un modèle qui répond à côté ne doit jamais casser
 * l'écran, ni inventer une catégorie hors taxonomie.
 */
import { z } from 'zod'
import { extraireJson } from './llm'
import { ErreurLLM } from './llm'
import type { Extraction } from '../domain/types'
import type { VerdictGardeFou } from '../domain/types'

const schemaZone = z.object({
  x: z.number(),
  y: z.number(),
  largeur: z.number(),
  hauteur: z.number(),
})

export const schemaAnnotation = z.object({
  ligne: z.string().default(''),
  annotation: z.string().default(''),
  eleve: z.string().optional(),
  attendu: z.string().optional(),
  zone: schemaZone.optional(),
})

export const schemaExtraction = z.object({
  annotations: z.array(schemaAnnotation).default([]),
  copiePropre: z.boolean().default(false),
  nomDetecte: z.string().nullish(),
})

export const schemaErreurBrute = z.object({
  code: z.string(),
  ligne: z.string().default(''),
  explication: z.string().default(''),
  confiance: z.number().default(0),
  zone: schemaZone.optional(),
})

export const schemaClassification = z.object({
  erreurs: z.array(schemaErreurBrute).default([]),
})

export const schemaExercice = z.object({
  enonce: z.string(),
  indices: z.array(z.string()).default([]),
  solution: z.string(),
  typeTravaille: z.string().default(''),
  niveau: z.string().default('lycée'),
})

export const schemaVerdict = z.object({
  travailleLeBonType: z.boolean(),
  neDonneLaSolutionOrigine: z.boolean(),
  memeNiveau: z.boolean(),
  motifs: z.array(z.string()).default([]),
})

function parser<T>(schema: z.ZodTypeAny, texte: string, quoi: string): T {
  const resultat = schema.safeParse(extraireJson(texte))
  if (!resultat.success) {
    throw new ErreurLLM(`Réponse du modèle invalide (${quoi}).`, 502)
  }
  // `default()` garantit les champs optionnels : le type de sortie est complet.
  return resultat.data as T
}

export function parserExtraction(texte: string): Extraction {
  const brute = parser<z.infer<typeof schemaExtraction>>(schemaExtraction, texte, 'extraction')
  const annotations = brute.annotations.filter((a) => a.annotation.trim().length > 0)
  return {
    annotations,
    // Une copie sans annotation est une copie propre, même si le modèle se
    // contredit : c'est la garantie RNF-04 (zéro faux positif).
    copiePropre: annotations.length === 0 || brute.copiePropre,
    ...(typeof brute.nomDetecte === 'string' && brute.nomDetecte ? { nomDetecte: brute.nomDetecte } : {}),
  }
}

export function parserClassification(texte: string): z.infer<typeof schemaErreurBrute>[] {
  return parser<z.infer<typeof schemaClassification>>(schemaClassification, texte, 'classification').erreurs
}

export function parserExercice(texte: string): z.infer<typeof schemaExercice> {
  return parser<z.infer<typeof schemaExercice>>(schemaExercice, texte, 'exercice')
}

export function parserVerdict(texte: string): VerdictGardeFou {
  return parser<z.infer<typeof schemaVerdict>>(schemaVerdict, texte, 'garde-fou')
}
