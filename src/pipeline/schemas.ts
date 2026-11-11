/**
 * Schémas des réponses du modèle. Rien n'entre dans le pipeline sans passer
 * par un de ces parseurs : un modèle qui répond à côté ne doit jamais casser
 * l'écran, ni inventer une catégorie hors taxonomie.
 *
 * Tolérance assumée : les modèles renvoient volontiers `null` à la place d'un
 * champ absent, et du texte autour du JSON. Tout est donc `nullish` et
 * normalisé ici, une bonne fois.
 */
import { z } from 'zod'
import { ErreurLLM, extraireJson } from './llm'
import type { Extraction, VerdictGardeFou } from '../domain/types'

const schemaZone = z.object({
  x: z.number(),
  y: z.number(),
  largeur: z.number(),
  hauteur: z.number(),
})

/** Chaîne optionnelle : null, absent ou vide deviennent `undefined`. */
const texteOptionnel = z
  .string()
  .nullish()
  .transform((valeur) => (typeof valeur === 'string' && valeur.trim() ? valeur.trim() : undefined))

const texteOuVide = z
  .string()
  .nullish()
  .transform((valeur) => (typeof valeur === 'string' ? valeur.trim() : ''))

const nombreOuZero = z
  .number()
  .nullish()
  .transform((valeur) => (typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : 0))

const booleen = z
  .boolean()
  .nullish()
  .transform((valeur) => valeur === true)

export const schemaAnnotation = z.object({
  ligne: texteOuVide,
  annotation: texteOuVide,
  eleve: texteOptionnel,
  attendu: texteOptionnel,
  zone: schemaZone.nullish(),
})

export const schemaExtraction = z.object({
  annotations: z.array(schemaAnnotation).default([]),
  copiePropre: booleen,
  nomDetecte: texteOptionnel,
})

export const schemaErreurBrute = z.object({
  code: texteOuVide,
  ligne: texteOuVide,
  explication: texteOuVide,
  confiance: nombreOuZero,
  zone: schemaZone.nullish(),
})

export const schemaClassification = z.object({
  erreurs: z.array(schemaErreurBrute).default([]),
})

export const schemaExercice = z.object({
  enonce: texteOuVide,
  indices: z.array(z.string()).default([]),
  solution: texteOuVide,
  typeTravaille: texteOuVide,
  niveau: z.string().nullish().transform((valeur) => valeur || 'lycée'),
})

export const schemaVerdict = z.object({
  travailleLeBonType: booleen,
  neDonneLaSolutionOrigine: booleen,
  memeNiveau: booleen,
  motifs: z.array(z.string()).default([]),
})

function parser<T>(schema: z.ZodTypeAny, texte: string, quoi: string): T {
  const resultat = schema.safeParse(extraireJson(texte))
  if (!resultat.success) {
    throw new ErreurLLM(`Réponse du modèle invalide (${quoi}).`, 502)
  }
  // Les `transform` ci-dessus garantissent des champs toujours exploitables.
  return resultat.data as T
}

export function parserExtraction(texte: string): Extraction {
  const brute = parser<z.infer<typeof schemaExtraction>>(schemaExtraction, texte, 'extraction')
  const annotations = brute.annotations
    .filter((a) => a.annotation.length > 0)
    .map((a) => ({
      ligne: a.ligne,
      annotation: a.annotation,
      ...(a.eleve ? { eleve: a.eleve } : {}),
      ...(a.attendu ? { attendu: a.attendu } : {}),
      ...(a.zone ? { zone: a.zone } : {}),
    }))
  return {
    annotations,
    // Une copie sans annotation est une copie propre, même si le modèle se
    // contredit : c'est la garantie RNF-04 (zéro faux positif).
    copiePropre: annotations.length === 0 || brute.copiePropre,
    ...(brute.nomDetecte ? { nomDetecte: brute.nomDetecte } : {}),
  }
}

export function parserClassification(texte: string): z.infer<typeof schemaErreurBrute>[] {
  return parser<z.infer<typeof schemaClassification>>(schemaClassification, texte, 'classification').erreurs
}

export function parserExercice(texte: string): z.infer<typeof schemaExercice> {
  return parser<z.infer<typeof schemaExercice>>(schemaExercice, texte, 'exercice')
}

export function parserVerdict(texte: string): VerdictGardeFou {
  return parser<VerdictGardeFou>(schemaVerdict, texte, 'garde-fou')
}

/**
 * Analyse fusionnée (lot 1) : un seul appel vision rend les annotations ET leur
 * typage. Deux allers-retours de 20 à 50 s devenaient le point dur du produit ;
 * un seul les divise par deux. Les règles (seuil, E99, pondération) restent
 * appliquées localement, jamais par le modèle.
 */
export const schemaAnnotationFusionnee = schemaAnnotation.extend({
  code: texteOuVide,
  confiance: nombreOuZero,
  explication: texteOuVide,
})

export const schemaAnalyse = z.object({
  annotations: z.array(schemaAnnotationFusionnee).default([]),
  copiePropre: booleen,
  nomDetecte: texteOptionnel,
})

export type AnalyseBrute = z.infer<typeof schemaAnalyse>

/** Découpe la réponse fusionnée en extraction + fautes brutes. */
export function parserAnalyse(texte: string): {
  annotations: AnalyseBrute['annotations']
  copiePropre: boolean
  nomDetecte?: string
} {
  const brut = parser<AnalyseBrute>(schemaAnalyse, texte, 'analyse')
  const annotations = brut.annotations.filter((a) => a.annotation.length > 0)
  return {
    annotations,
    // Même garde que le chemin séparé : pas d'annotation = copie propre.
    copiePropre: annotations.length === 0 || brut.copiePropre,
    ...(brut.nomDetecte ? { nomDetecte: brut.nomDetecte } : {}),
  }
}

/** Seconde passe (lot 3) : verdict sur les fautes peu sûres. */
export const schemaFauteRevue = z.object({
  index: z.number(),
  code: texteOuVide,
  confiance: nombreOuZero,
  explication: texteOuVide,
  decision: texteOuVide,
})

export const schemaRevue = z.object({
  fautes: z.array(schemaFauteRevue).default([]),
})

export type RevueBrute = z.infer<typeof schemaRevue>

export function parserRevue(texte: string): RevueBrute['fautes'] {
  return parser<RevueBrute>(schemaRevue, texte, 'revue').fautes
}
