/**
 * Orchestrateur du pipeline (§18.2) : six étapes, une progression visible,
 * une latence mesurée par étape. L'attente devient une démonstration du
 * produit — et un échec d'étape dit précisément où ça a cassé.
 */
import { construireDiagnostic } from '../domain/diagnostic'
import { ecrireCache, empreinteImage, lireCache } from '../storage/cache'
import { libelleEtape } from '../domain/etapes'
import { analyserImage } from './analyse'
import { revoirFautesPeuSures } from './revue'
import type { CodeErreur } from '../domain/taxonomy'
import type { ExerciceVerifie, Progression, ResultatAnalyse, EtapeId } from '../domain/types'
import { masquerNom } from './anonymize'
import type { ClientBrut } from './client'
import type { Transport } from './llm'
import { obtenirExercice } from './exercise'
import { normaliserImage } from './ingest'

export type OptionsAnalyse = {
  transport: Transport
  onProgression?: (progression: Progression) => void
  client?: ClientBrut
  niveau?: string
  /** Injectables pour les tests : identifiant et horodatage déterministes. */
  id?: string
  maintenant?: () => Date
  /** Cache local des analyses (défaut : actif). Désactivable dans Réglages. */
  cache?: boolean
  /** Exercice inédit demandé (modèle appelé) au lieu de la banque locale. */
  inedit?: boolean
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

  // Cache local : même photo (à l'octet près après normalisation) → réponse
  // immédiate, aucun appel. Jamais l'image en cache, seulement son empreinte.
  if (options.cache !== false) {
    const depuisCache = await depuisLeCache(anonyme.dataUrl, options, publier)
    if (depuisCache) return depuisCache
  }
  // Un seul appel vision pour les étapes 3 et 4 : l'amont coûte 16 à 50 s par
  // aller-retour, la fusion tient le budget « photo → diagnostic » (RNF-01).
  const analyse = await etape('extrait', publier, () =>
    analyserImage(anonyme.dataUrl, options.transport, options.client),
  )
  const { extraction } = analyse
  // Étape 4 : les règles restent locales (seuil 0,6, E99, E11 pondérée à 0),
  // puis seconde passe sur les fautes peu sûres — cible : zéro faux positif.
  const classification = await etape('classifie', publier, async () => {
    const revue = await revoirFautesPeuSures(analyse.erreurs, options.transport, options.client)
    return { erreurs: revue.erreurs, bilan: { revues: revue.revues, modifiees: revue.modifiees } }
  })
  const erreurs = classification.erreurs

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
    revue: classification.bilan,
    exercice: null,
    messageExercice: 'Exercice en préparation…',
  })

  const exercice = await produireExercice(diagnostic.typeDominant, extraction, options, publier)
  const resultat: ResultatAnalyse = {
    diagnostic,
    extraction,
    imageAnonymisee: anonyme.dataUrl,
    revue: classification.bilan,
    exercice: exercice.exercice,
    ...(exercice.message ? { messageExercice: exercice.message } : {}),
  }
  if (options.cache !== false) {
    // L'image ne part jamais en cache (RNF-P1) : seulement le diagnostic.
    const { imageAnonymisee: _image, ...sansImage } = resultat
    void ecrireCache(await empreinteImage(anonyme.dataUrl), {
      ...sansImage,
      enregistreLe: maintenant().toISOString(),
    })
  }
  return resultat
}

/** Résultat rejoué depuis le cache local, progression publiée pour rester lisible. */
async function depuisLeCache(
  dataUrl: string,
  options: OptionsAnalyse,
  publier: (p: Progression) => void,
): Promise<ResultatAnalyse | null> {
  const enCache = await lireCache(await empreinteImage(dataUrl))
  if (!enCache) return null
  const etapes: EtapeId[] = ['extrait', 'classifie', 'agrege', 'genere']
  for (const etapeId of etapes) {
    publier({ etape: etapeId, etat: 'fait', message: 'réponse en cache local', ms: 0 })
  }
  options.onResultatPartiel?.({ ...enCache, imageAnonymisee: dataUrl })
  return { ...enCache, imageAnonymisee: dataUrl }
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
    // Banque locale d'abord : l'étape 6 ne coûte alors **aucun** appel réseau.
    return await etape('genere', publier, () =>
      obtenirExercice({
        typeDominant,
        extraitCopie: extrait,
        transport: options.transport,
        ...(options.client ? { client: options.client } : {}),
        ...(options.niveau ? { niveau: options.niveau } : {}),
        ...(options.inedit ? { inedit: true } : {}),
      }),
    )
  } catch {
    return { exercice: null, message: 'Exercice indisponible pour le moment : réessaie dans un instant.' }
  }
}
