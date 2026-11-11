/**
 * Trajectoire du profil — lot 5. Le pitch du produit : « 1ʳᵉ copie → un
 * diagnostic, 3ᵉ → un pattern, 5ᵉ → un plan ». Jusqu'ici le profil était une
 * photo (des compteurs) ; ce module en fait une trajectoire : comment chaque
 * type évolue au fil des copies, et quand une faille a disparu.
 *
 * Logique pure, testée, aucune dépendance au DOM.
 */
import { CODES_ERREUR, libelleDe } from './taxonomy'
import type { CodeErreur } from './taxonomy'
import { typeDominant } from './profil'
import type { Diagnostic, Profil } from './types'

export type Tendance = 'baisse' | 'hausse' | 'stable' | 'inconnue'

/**
 * Nombre de fautes d'un code par copie, dans l'ordre chronologique. E11 et E99
 * comptent 0 dans la série pondérée : ce ne sont pas des lacunes de fond, les
 * faire varier ferait croire à une progression qui n'existe pas.
 */
export function occurrencesParCopie(diagnostics: Diagnostic[], code: CodeErreur): number[] {
  return diagnostics.map(
    (diagnostic) =>
      diagnostic.erreurs.filter((erreur) => erreur.code === code && erreur.ponderee).length,
  )
}

/**
 * Tendance simple et documentée : on compare la moyenne des 2 dernières copies
 * à celle des copies précédentes. Moins de 2 copies → « inconnue » (on ne devine
 * pas une progression sur une seule copie).
 */
export function tendance(serie: number[]): Tendance {
  if (serie.length < 2) return 'inconnue'
  const recentes = serie.slice(-2)
  const anciennes = serie.slice(0, -2)
  const moyenne = (nombres: number[]) =>
    nombres.length === 0 ? 0 : nombres.reduce((a, b) => a + b, 0) / nombres.length
  const mRecente = moyenne(recentes)
  const mAncienne = anciennes.length === 0 ? moyenne(serie.slice(0, -1)) : moyenne(anciennes)
  if (mRecente < mAncienne - 0.001) return 'baisse'
  if (mRecente > mAncienne + 0.001) return 'hausse'
  return 'stable'
}

/**
 * Une faille a « disparu » si elle était dominante sur les premières copies et
 * n'apparaît plus du tout sur les 3 dernières. Règle volontairement prudente :
 * il faut au moins 4 copies pour pouvoir l'affirmer.
 */
export function failleDisparue(diagnostics: Diagnostic[], code: CodeErreur): boolean {
  if (diagnostics.length < 4) return false
  const premieres = diagnostics.slice(0, -3)
  const dernieres = diagnostics.slice(-3)
  const etaitDominante = premieres.some((d) => d.typeDominant === code)
  const plusAucune = dernieres.every((d) => !d.erreurs.some((e) => e.code === code && e.ponderee))
  return etaitDominante && plusAucune
}

export function pointsCourbe(serie: number[]): { index: number; valeur: number }[] {
  return serie.map((valeur, index) => ({ index, valeur }))
}

/** Phrase bienveillante qui reflète la tendance du type dominant. */
export function messageProgression(profil: Profil, diagnostics: Diagnostic[]): string {
  const dominant = typeDominant(profil)
  if (!dominant) return "Pas encore d'erreur récurrente : ajoute une copie pour commencer ta trajectoire."
  const serie = occurrencesParCopie(diagnostics, dominant)
  const tendanceDuType = tendance(serie)
  const nom = libelleDe(dominant).toLowerCase()
  const total = serie.reduce((a, b) => a + b, 0)

  if (failleDisparue(diagnostics, dominant)) {
    return `Belle progression : « ${nom} » ne revient plus sur tes 3 dernières copies.`
  }
  if (tendanceDuType === 'baisse') {
    return `« ${nom} » diminue : ${total} occurrence(s) au total, moins sur tes dernières copies. Continue.`
  }
  if (tendanceDuType === 'hausse') {
    return `« ${nom} » apparaît plus souvent ces derniers temps : c'est le bon moment pour un exercice ciblé.`
  }
  if (tendanceDuType === 'stable') {
    return `« ${nom} » reste stable (${total} occurrence(s)) : un exercice ciblé peut aider à le faire baisser.`
  }
  return `Analyse au moins deux copies pour voir ta progression sur « ${nom} ».`
}

/** Les codes à tracer : les 3 plus fréquents du profil. */
export function codesATracer(profil: Profil): CodeErreur[] {
  return CODES_ERREUR.filter((code) => (profil.parType[code] ?? 0) > 0)
    .sort((a, b) => (profil.parType[b] ?? 0) - (profil.parType[a] ?? 0))
    .slice(0, 3)
}
