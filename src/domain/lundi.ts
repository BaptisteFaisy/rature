/**
 * Décision « quoi reprendre lundi » (mode prof) — logique pure, testée.
 *
 * À partir de la statistique de classe, on dégage les deux types d'erreur
 * majoritaires et on propose une reprise collective concrète. Le contenu des
 * consignes est **statique** (table par code) : aucune génération, aucune
 * dépendance réseau, aucune mention culpabilisante envers les élèves.
 */
import { CODES_ERREUR, estPonderee, libelleDe } from './taxonomy'
import type { CodeErreur } from './taxonomy'
import type { StatsClasse } from './types'

/** Plan de reprise proposé au professeur. */
export type PlanLundi = {
  /** Types retenus, triés par fréquence décroissante (1 ou 2 entrées). */
  types: CodeErreur[]
  /** Phrase d'action en français, ton neutre et utile. */
  phrase: string
  /** Consigne d'exercice collectif pour chaque type retenu. */
  exercices: { code: CodeErreur; consigne: string }[]
  /** Part cumulée (0..1) des types retenus dans le total pondéré. */
  partCumulee: number
}

/**
 * Seuil de rétention du deuxième type, exprimé en part du total pondéré.
 *
 * On garde le deuxième type uniquement s'il pèse au moins 20 % des erreurs
 * pondérées de la classe. En dessous, le signal est trop faible pour justifier
 * une reprise en classe entière : on garde donc un unique type majoritaire.
 */
const SEUIL_DEUXIEME_TYPE = 0.2

/** Consignes collectives, une par type — contenu statique, jamais généré. */
const CONSIGNES: Record<(typeof CODES_ERREUR)[number], string> = {
  E01: 'Cinq développements avec un facteur négatif, à faire au tableau en nommant chaque signe.',
  E02: 'Trois doubles distributivités où chaque terme de la parenthèse est multiplié, à vérifier en binôme.',
  E03: 'Quatre identités remarquables à développer en écrivant les trois termes, dont le double produit.',
  E04: 'Trois sommes de fractions à mettre au même dénominateur en réécrivant chaque numérateur ajusté.',
  E05: 'Cinq équations à résoudre en discutant les valeurs exclues du domaine avant de conclure.',
  E06: 'Quatre calculs de puissances à détailler en appliquant chaque règle d’exposant, étape par étape.',
  E07: 'Trois simplifications de racines à justifier en gardant chaque facteur sous le radical.',
  E08: 'Cinq équations à transposer en nommant l’opération inverse appliquée à chaque membre.',
  E09: 'Trois calculs à mener en valeurs exactes jusqu’au dernier pas, puis arrondir une seule fois.',
  E10: 'Quatre énoncés à résoudre en écrivant l’unité à chaque résultat et en vérifiant les conversions.',
  E11: 'Relire l’énoncé à voix haute avant de démarrer, puis pointer la ligne recopiée.',
  E12: 'Deux démonstrations courtes à compléter en écrivant chaque implication logique qui relie les étapes.',
}

/** Consigne d'un type retenu ; E99 n'étant jamais retenu, ce repli est défensif. */
function consignePour(code: CodeErreur): string {
  if (code === 'E99') return 'Reprise ciblée avec la classe.'
  return CONSIGNES[code]
}

/** Total pondéré restreint aux codes effectivement pondérés (hors E11, E99). */
function totalPondereStats(stats: StatsClasse): number {
  return CODES_ERREUR.reduce((somme, code) => somme + (estPonderee(code) ? stats.parType[code] ?? 0 : 0), 0)
}

/** Types pondérés classés par fréquence décroissante, puis ordre de la taxonomie. */
function typesTries(stats: StatsClasse): CodeErreur[] {
  return CODES_ERREUR.filter((code) => estPonderee(code) && (stats.parType[code] ?? 0) > 0).sort(
    (a, b) => (stats.parType[b] ?? 0) - (stats.parType[a] ?? 0),
  )
}

export function quoiReprendreLundi(stats: StatsClasse): PlanLundi {
  const total = totalPondereStats(stats)
  if (total === 0) {
    return { types: [], phrase: 'Rien à reprendre en classe entière.', exercices: [], partCumulee: 0 }
  }

  const classes = typesTries(stats)
  const premier = classes[0]
  if (!premier) {
    return { types: [], phrase: 'Rien à reprendre en classe entière.', exercices: [], partCumulee: 0 }
  }

  const second = classes[1]
  const partSecond = second ? (stats.parType[second] ?? 0) / total : 0
  const garderSecond = second !== undefined && partSecond >= SEUIL_DEUXIEME_TYPE

  const types = garderSecond ? [premier, second] : [premier]
  const partCumulee = types.reduce((somme, code) => somme + (stats.parType[code] ?? 0), 0) / total

  const libelles = types.map((code) => libelleDe(code).toLowerCase())
  const phrase =
    libelles.length === 1
      ? `À reprendre lundi : ${libelles[0]}.`
      : `À reprendre lundi : ${libelles[0]} et ${libelles[1]}.`

  return {
    types,
    phrase,
    exercices: types.map((code) => ({ code, consigne: consignePour(code) })),
    partCumulee,
  }
}