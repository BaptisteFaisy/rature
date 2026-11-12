/**
 * Construction du diagnostic à partir des erreurs classifiées.
 *
 * Deux garde-fous appliqués ici, avant tout affichage :
 *  1. seuil de confiance (0,6) → en dessous, la faute devient E99 « non typée »
 *     et sort du profil ;
 *  2. copie propre : si le modèle ne rend aucune annotation, on ne fabrique
 *     aucune faute (RNF-04 : zéro faux positif toléré).
 */
import { CODE_NON_TYPEE, estCodeConnu, estPonderee, libelleDe } from './taxonomy'
import type { CodeErreur } from './taxonomy'
import { SEUIL_CONFIANCE } from './config'
import { confianceAssainie, texteAssaini, zoneAssainie } from './tolerance'
import type { Erreur, Diagnostic } from './types'

export type ErreurBrute = {
  code: unknown
  ligne?: unknown
  explication?: unknown
  confiance?: unknown
  zone?: unknown
}

/**
 * Normalise une entrée brute en Erreur typée : seuil de confiance appliqué,
 * textes bornés, zone assainie. Les invariants tiennent quel que soit
 * l'appelant (pipeline, seconde passe, ou test).
 */
export function normaliserErreur(brute: ErreurBrute): Erreur {
  const confiance = confianceAssainie(brute.confiance)
  const code: CodeErreur = estCodeConnu(brute.code) && confiance >= SEUIL_CONFIANCE ? brute.code : CODE_NON_TYPEE
  const zone = zoneAssainie(brute.zone)
  return {
    code,
    libelle: libelleDe(code),
    ligne: texteAssaini(brute.ligne, 'Ligne non localisée'),
    explication: texteAssaini(brute.explication, 'À revoir avec ton professeur.'),
    confiance,
    ponderee: estPonderee(code),
    ...(zone ? { zone } : {}),
  }
}

/** Type dominant d'une liste d'erreurs : le plus fréquent parmi les pondérées. */
export function dominantDe(erreurs: Erreur[]): CodeErreur | null {
  const compteurs = new Map<CodeErreur, number>()
  for (const erreur of erreurs) {
    if (!erreur.ponderee) continue
    compteurs.set(erreur.code, (compteurs.get(erreur.code) ?? 0) + 1)
  }
  let meilleur: CodeErreur | null = null
  let max = 0
  for (const [code, n] of compteurs) {
    if (n > max) {
      max = n
      meilleur = code
    }
  }
  return meilleur
}

export function construireDiagnostic(
  brutes: ErreurBrute[],
  options: { id: string; createdAt: string },
): Diagnostic {
  const erreurs = brutes.map(normaliserErreur)
  return {
    id: options.id,
    createdAt: options.createdAt,
    matiere: 'maths',
    nbFautes: erreurs.length,
    erreurs,
    typeDominant: dominantDe(erreurs),
  }
}
