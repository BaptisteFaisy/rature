/**
 * Orchestrateur du pipeline (§18.2) : six étapes, une progression visible,
 * une latence mesurée par étape. L'attente devient une démonstration du
 * produit — et un échec d'étape dit précisément où ça a cassé.
 */
import { construireDiagnostic } from '../domain/diagnostic'
import { libelleEtape } from '../domain/etapes'
import type { CodeErreur } from '../domain/taxonomy'
import type { ExerciceVerifie, Progression, ResultatAnalyse, EtapeId } from '../domain/types'
import { masquerNom } from './anonymize'
import type { ClientBrut } from './client'
import { classerAnnotations } from './classify'
import type { Transport } from './llm'
import { genererExerciceVerifie } from './exercise'
import { extraireAnnotations } from './extract'
import { normaliserImage } from './ingest'

export type OptionsAnalyse = {
  transport: Transport
  onProgression?: (progression: Progression) => void
  client?: ClientBrut
  niveau?: string
  /** Injectables pour les tests : identifiant et horodatage déterministes. */
  id?: string
  maintenant?: () => Date
  /**
   * Publié dès la fin de l'étape 5 : le diagnostic s'affiche pendant que
   * l'exercice se prépare (RNF-01 porte sur photo → diagnostic, pas sur
   * photo → exercice).
   */
  onResultatPartiel?: (partiel: ResultatAnalyse) => void
}

/** Exécute une étape en publiant son état et sa durée. */
async function etape<T>(
  id: EtapeId,
  publier: (p: Progression) => void,
  travail: () => Promise<T>,
): Promise<T> {
  publier({ etape: id, etat: 'en-cours', message: libelleEtape(id) })
  const debut = Date.now()
  try {
    const resultat = await travail()
    publier({ etape: id, etat: 'fait', message: libelleEtape(id), ms: Date.now() - debut })
    return resultat
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Étape impossible.'
    publier({ etape: id, etat: 'echec', message, ms: Date.now() - debut })
    throw erreur
  }
}

function extraitPourExercice(lignes: string[]): string {
  return lignes.filter((l) => l.trim().length > 0).slice(0, 6).join('\n')
}

export async function analyserCopie(
  fichier: File,
  options: OptionsAnalyse,
): Promise<ResultatAnalyse> {
  const publier = options.onProgression ?? (() => {})
  const maintenant = options.maintenant ?? (() => new Date())

  const image = await etape('ingest', publier, () => normaliserImage(fichier))
  const anonyme = await etape('anonymise', publier, () => masquerNom(image.dataUrl))
  const extraction = await etape('extrait', publier, () =>
    extraireAnnotations(anonyme.dataUrl, options.transport, options.client),
  )
  const erreurs = await etape('classifie', publier, () =>
    classerAnnotations(extraction, options.transport, options.client),
  )

  const diagnostic = await etape('agrege', publier, async () =>
    construireDiagnostic(erreurs, {
      id: options.id ?? crypto.randomUUID(),
      createdAt: maintenant().toISOString(),
    }),
  )

  // Le diagnostic est affiché dès maintenant : l'exercice se prépare derrière
  // (RNF-01 porte sur photo → diagnostic).
  options.onResultatPartiel?.({
    diagnostic,
    extraction,
    imageAnonymisee: anonyme.dataUrl,
    exercice: null,
    messageExercice: 'Exercice en préparation…',
  })

  const exercice = await produireExercice(diagnostic.typeDominant, extraction, options, publier)
  return {
    diagnostic,
    extraction,
    imageAnonymisee: anonyme.dataUrl,
    exercice: exercice.exercice,
    ...(exercice.message ? { messageExercice: exercice.message } : {}),
  }
}

/** L'étape 6 ne doit jamais faire échouer le diagnostic : elle est facultative. */
async function produireExercice(
  typeDominant: CodeErreur | null,
  extraction: { annotations: { ligne: string }[] },
  options: OptionsAnalyse,
  publier: (p: Progression) => void,
): Promise<{ exercice: ExerciceVerifie | null; message?: string }> {
  if (!typeDominant) {
    publier({ etape: 'genere', etat: 'sautee', message: 'Aucune erreur à travailler' })
    return { exercice: null, message: 'Aucune erreur récurrente : rien à travailler, et c’est une bonne nouvelle.' }
  }
  const extrait = extraitPourExercice(extraction.annotations.map((a) => a.ligne))
  try {
    return await etape('genere', publier, () =>
      genererExerciceVerifie({
        typeDominant,
        extraitCopie: extrait,
        transport: options.transport,
        ...(options.client ? { client: options.client } : {}),
        ...(options.niveau ? { niveau: options.niveau } : {}),
      }),
    )
  } catch {
    return { exercice: null, message: 'Exercice indisponible pour le moment : réessaie dans un instant.' }
  }
}
