/**
 * Contenu pédagogique par type d'erreur — lot 4.
 *
 * Statique, zéro appel API : chaque type reçoit une explication courte, le
 * geste concret qui l'évite, un mini-exemple faux et sa version juste, et le
 * piège voisin qui lui ressemble. C'est ce qui transforme un diagnostic en
 * apprentissage — l'argument pédagogique du projet. Ton bienveillant, jamais
 * culpabilisant.
 */
import { CODES_ERREUR, libelleDe } from './taxonomy'
import type { CodeErreur } from './taxonomy'

export type ExplicationType = {
  code: (typeof CODES_ERREUR)[number]
  titre: string
  pourquoi: string
  geste: string
  exemple: string
  contreExemple: string
  piege: string
}

const CONTENU: Record<(typeof CODES_ERREUR)[number], Omit<ExplicationType, 'code' | 'titre'>> = {
  E01: {
    pourquoi: "Un facteur négatif distribué sur une parenthèse inverse chaque signe ; on en oublie souvent un.",
    geste: "Écris chaque produit séparément avant de réduire, et encadre le signe qui change.",
    exemple: "-2(3x - 5) = -6x - 10",
    contreExemple: "-2(3x - 5) = -6x + 10",
    piege: "Ne pas confondre avec E08 : ici le calcul est juste, seul le signe bouge.",
  },
  E02: {
    pourquoi: "La distributivité s'arrête au premier terme : un facteur doit multiplier chaque terme de la parenthèse.",
    geste: "Souligne chaque terme de la parenthèse et vérifie qu'il a bien reçu le facteur.",
    exemple: "5(2x + 3) = 10x + 3",
    contreExemple: "5(2x + 3) = 10x + 15",
    piege: "Voisin de E03 : ici c'est un produit simple, pas une identité remarquable.",
  },
  E03: {
    pourquoi: "(a+b)² n'est pas a²+b² : il manque le double produit 2ab, et son signe compte.",
    geste: "Récite la formule à voix haute : carré, double produit, carré — puis remplace.",
    exemple: "(x + 3)² = x² + 9",
    contreExemple: "(x + 3)² = x² + 6x + 9",
    piege: "Voisin de E02 : ici c'est une identité remarquable, pas une simple distributivité.",
  },
  E04: {
    pourquoi: "On additionne les numérateurs et les dénominateurs au lieu de chercher un dénominateur commun.",
    geste: "Trouve le dénominateur commun, ajuste chaque numérateur, puis additionne en haut seulement.",
    exemple: "1/3 + 1/4 = 2/7",
    contreExemple: "1/3 + 1/4 = 4/12 + 3/12 = 7/12",
    piege: "Voisin de E08 : ici c'est la mise au même dénominateur qui manque.",
  },
  E05: {
    pourquoi: "Une valeur interdite (division par zéro, racine d'un négatif) n'a pas été discutée.",
    geste: "Avant de conclure, demande-toi : pour quelles valeurs ceci n'a-t-il pas de sens ?",
    exemple: "f(x) = (x+1)/(x-2), Df = ℝ",
    contreExemple: "f(x) = (x+1)/(x-2), Df = ℝ \\ {2}",
    piege: "Voisin de E12 : ici une valeur est oubliée, pas une étape de raisonnement.",
  },
  E06: {
    pourquoi: "Un exposant s'applique à tout le facteur, et les règles xᵃ·xᵇ = xᵃ⁺ᵇ se confondent.",
    geste: "Entoure la base exacte concernée par l'exposant avant de calculer.",
    exemple: "(2x²)³ = 2x⁶",
    contreExemple: "(2x²)³ = 8x⁶",
    piege: "Voisin de E07 : ici c'est une puissance, pas une racine.",
  },
  E07: {
    pourquoi: "La racine d'une somme n'est pas la somme des racines : √(a+b) ≠ √a + √b.",
    geste: "Calcule d'abord ce qui est sous la racine, puis extrais la racine.",
    exemple: "√(9 + 16) = 3 + 4",
    contreExemple: "√(9 + 16) = √25 = 5",
    piege: "Voisin de E06 : ici c'est une racine, pas une puissance.",
  },
  E08: {
    pourquoi: "En passant d'un membre à l'autre, on oublie l'opération inverse (on additionne au lieu de soustraire).",
    geste: "Écris l'opération inverse appliquée des DEUX côtés avant de simplifier.",
    exemple: "3x + 4 = 10 donc 3x = 14",
    contreExemple: "3x + 4 = 10 donc 3x = 10 - 4 = 6",
    piege: "Voisin de E12 : ici le geste algébrique est faux, pas seulement omis.",
  },
  E09: {
    pourquoi: "Un arrondi trop tôt propage l'erreur ; la valeur exacte est perdue avant la fin.",
    geste: "Garde la valeur exacte (fraction, racine) jusqu'à la dernière étape, arrondis seulement à la fin.",
    exemple: "v = 100/3 = 33 donc d = 33 × 7 = 231",
    contreExemple: "v = 100/3 donc d = (100/3) × 7 = 700/3 ≈ 233,3",
    piege: "Voisin de E10 : ici c'est la précision, pas l'unité.",
  },
  E10: {
    pourquoi: "Le résultat est donné sans unité, ou la conversion entre unités est incohérente.",
    geste: "Écris l'unité à chaque résultat et vérifie l'homogénéité avant de conclure.",
    exemple: "d = 231",
    contreExemple: "d = 231 m",
    piege: "Voisin de E09 : ici c'est l'unité qui manque, pas la précision.",
  },
  E11: {
    pourquoi: "Le calcul est juste mais l'énoncé a été mal recopié : une inattention, pas une lacune.",
    geste: "Relis l'énoncé recopié avant de calculer ; entoure les données reportées.",
    exemple: "énoncé 2x+7 recopié 2x+3",
    contreExemple: "énoncé 2x+7 recopié 2x+7",
    piege: "À ne pas confondre avec E12 : ici le raisonnement est bon, seule la recopie de l'énoncé diffère.",
  },
  E12: {
    pourquoi: "Le raisonnement est bon mais une étape logique manque, ou une affirmation n'est pas démontrée.",
    geste: "Écris le « donc » ou le « car » qui relie chaque étape : le lecteur doit pouvoir suivre.",
    exemple: "f(x)=0 donc x=-1",
    contreExemple: "f(x)=0 ⇔ x+1=0 ⇔ x=-1",
    piege: "Voisin de E05 : ici c'est la justification, pas une valeur oubliée.",
  },
}

export function explicationDe(code: CodeErreur): ExplicationType | null {
  if (code === 'E99') return null
  const contenu = CONTENU[code]
  if (!contenu) return null
  return { code, titre: libelleDe(code), ...contenu }
}

export function glossaire(): ExplicationType[] {
  return CODES_ERREUR.map((code) => explicationDe(code)!).filter((e) => e !== null)
}
