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

/**
 * Exécute une étape en publiant son état, sa durée **et sa preuve** : ce que
 * l'étape a réellement produit. La preuve est calculée à partir du résultat,
 * donc elle ne peut pas mentir.
 */
async function etape<T>(
  id: EtapeId,
  publier: (p: Progression) => void,
  travail: () => Promise<T>,
  preuve?: (resultat: T) => string,
): Promise<T> {
  publier({ etape: id, etat: 'en-cours', message: libelleEtape(id) })
  const debut = Date.now()
  try {
    const resultat = await travail()
    publier({
      etape: id,
      etat: 'fait',
      message: libelleEtape(id),
      ms: Date.now() - debut,
      ...(preuve ? { preuve: preuve(resultat) } : {}),
    })
    return resultat
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Étape impossible.'
    publier({ etape: id, etat: 'echec', message, ms: Date.now() - debut })
    throw erreur
  }
}

/** Codes lus dans l'ordre, pour la preuve de l'étape de classification. */
export function codesDe(erreurs: { code: string }[]): string {
  const uniques = [...new Set(erreurs.map((erreur) => erreur.code))]
  return uniques.length > 0 ? uniques.join(', ') : 'aucune'
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

  const image = await etape(
    'ingest',
    publier,
    () => normaliserImage(fichier),
    (resultat) => `photo normalisée en ${resultat.largeur} × ${resultat.hauteur} px`,
  )
  const anonyme = await etape(
    'anonymise',
    publier,
    () => masquerNom(image.dataUrl),
    (resultat) =>
      resultat.zoneMasquee
        ? `bandeau du nom pixelisé (${Math.round(resultat.zoneMasquee.largeur * 100)} % de la largeur)`
        : 'aucune zone de nom à masquer',
  )

  // Cache local : même photo (à l'octet près après normalisation) → réponse
  // immédiate, aucun appel. Jamais l'image en cache, seulement son empreinte.
  if (options.cache !== false) {
    const depuisCache = await depuisLeCache(anonyme.dataUrl, options, publier)
    if (depuisCache) return depuisCache
  }
  // Un seul appel vision pour les étapes 3 et 4 : l'amont coûte 16 à 50 s par
  // aller-retour, la fusion tient le budget « photo → diagnostic » (RNF-01).
  const analyse = await etape(
    'extrait',
    publier,
    () => analyserImage(anonyme.dataUrl, options.transport, options.client),
    (resultat) =>
      `${resultat.extraction.annotations.length} annotation(s) relevée(s) sur la copie` +
      (resultat.extraction.copiePropre ? ' — copie propre, aucune faute' : ''),
  )
  const { extraction } = analyse
  // Étape 4 : les règles restent locales (seuil 0,6, E99, E11 pondérée à 0),
  // puis seconde passe sur les fautes peu sûres — cible : zéro faux positif.
  const classification = await etape(
    'classifie',
    publier,
    async () => {
      const revue = await revoirFautesPeuSures(analyse.erreurs, options.transport, options.client)
      return { erreurs: revue.erreurs, bilan: { revues: revue.revues, modifiees: revue.modifiees } }
    },
    (resultat) =>
      `${resultat.erreurs.length} faute(s) typée(s) : ${codesDe(resultat.erreurs)}` +
      (resultat.bilan.revues > 0
        ? ` — seconde passe : ${resultat.bilan.revues} revue(s), ${resultat.bilan.modifiees} corrigée(s)`
        : ' — aucune faute n’a nécessité de seconde passe'),
  )
  const erreurs = classification.erreurs

  const diagnostic = await etape(
    'agrege',
    publier,
    async () =>
      construireDiagnostic(erreurs, {
        id: options.id ?? crypto.randomUUID(),
        createdAt: maintenant().toISOString(),
      }),
    (resultat) =>
      `profil mis à jour : ${resultat.nbFautes} faute(s), type dominant ${resultat.typeDominant ?? 'aucun'}`,
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

  const exercice = await etape(
    'genere',
    publier,
    () => produireExercice(diagnostic.typeDominant, extraction, options, publier),
    (resultat) =>
      resultat.exercice
        ? `exercice ${
            resultat.exercice.exercice.source === 'banque'
              ? 'tiré de la banque locale'
              : 'inédit, généré par le modèle'
          } sur ${resultat.exercice.exercice.typeTravaille} — garde-fou : ${
            resultat.exercice.verdict.travailleLeBonType &&
            resultat.exercice.verdict.neDonneLaSolutionOrigine &&
            resultat.exercice.verdict.memeNiveau
              ? '3 critères validés'
              : 'refusé'
          }`
        : (resultat.message ?? 'pas d’exercice disponible'),
  )
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
  const preuves: Record<string, string> = {
    extrait: `${enCache.extraction.annotations.length} annotation(s) déjà relevée(s)`,
    classifie: `${enCache.diagnostic.erreurs.length} faute(s) déjà typée(s) : ${codesDe(enCache.diagnostic.erreurs)}`,
    agrege: `profil déjà à jour : ${enCache.diagnostic.nbFautes} faute(s)`,
    genere: enCache.exercice
      ? `exercice déjà prêt sur ${enCache.exercice.exercice.typeTravaille}`
      : (enCache.messageExercice ?? 'pas d’exercice disponible'),
  }
  for (const etapeId of etapes) {
    publier({
      etape: etapeId,
      etat: 'fait',
      message: 'réponse en cache local',
      ms: 0,
      preuve: `${preuves[etapeId]} — aucun appel réseau`,
    })
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
