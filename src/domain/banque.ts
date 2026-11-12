/**
 * Banque d'exercices locale — idée 1 du brassage « rester sur InferHub ».
 *
 * Pourquoi : générer un exercice coûte **deux** appels réseau (génération +
 * garde-fou), sur un amont qui met 16 à 57 s par appel. Ces 36 exercices sont
 * écrits à la main, ciblés sur le geste exact de chaque type, et leur pertinence
 * est vérifiée par construction (puis par `tests/banque.test.ts`). L'étape 6
 * devient donc **instantanée et hors ligne** ; l'appel modèle ne sert plus que
 * pour un « exercice inédit » demandé explicitement.
 *
 * Chaque énoncé fait faire le geste décrit par la `signature` du code dans
 * `taxonomy.ts` — pas un exercice sur la notion en général.
 */
import { CODES_ERREUR, libelleDe } from './taxonomy'
import type { Exercice, ExerciceVerifie, VerdictGardeFou } from './types'

export type CodeBanque = (typeof CODES_ERREUR)[number]

export type ExerciceBanque = {
  id: string
  code: CodeBanque
  niveau: string
  difficulte: 1 | 2 | 3
  enonce: string
  indices: string[]
  solution: string
  /** L'erreur que cet exercice tend — c'est elle qui le rend ciblé. */
  piege: string
}

/** Verdict de garde-fou : la banque est écrite pour le type, il est vérifié par les tests. */
const VERDICT_BANQUE: VerdictGardeFou = {
  travailleLeBonType: true,
  neDonneLaSolutionOrigine: true,
  memeNiveau: true,
  motifs: [],
}

function exercice(
  code: CodeBanque,
  numero: 1 | 2 | 3,
  niveau: string,
  enonce: string,
  indice: string,
  solution: string,
  piege: string,
): ExerciceBanque {
  return { id: `${code}-${numero}`, code, niveau, difficulte: numero, enonce, indices: [indice], solution, piege }
}

export const BANQUE: Record<CodeBanque, ExerciceBanque[]> = {
  E01: [
    exercice('E01', 1, 'seconde', 'Développe : A = -3(2x - 4)', 'Écris d’abord -3 × 2x puis -3 × (-4), séparément.', 'A = -6x + 12. Le point clé : -3 × (-4) = +12, le signe change.', 'Le produit de deux négatifs est positif.'),
    exercice('E01', 2, 'seconde', 'Développe et réduis : B = 5x - 2(x - 3)', 'Traîne le signe du facteur -2 sur chacun des deux termes.', 'B = 5x - 2x + 6 = 3x + 6. Ici -2 × (-3) = +6.', 'Le facteur négatif doit toucher les deux termes.'),
    exercice('E01', 3, 'seconde', 'Développe et réduis : C = -(x + 7) + 2(3 - x)', 'Un signe « - » devant une parenthèse, c’est un facteur -1.', 'C = -x - 7 + 6 - 2x = -3x - 1.', 'Deux facteurs négatifs différents dans le même calcul.'),
  ],
  E02: [
    exercice('E02', 1, 'seconde', 'Développe : A = 4(3x + 5)', 'Le 4 multiplie le 3x ET le 5.', 'A = 12x + 20.', 'Oublier de multiplier le second terme.'),
    exercice('E02', 2, 'seconde', 'Développe et réduis : B = x(2x + 3) - 2', 'Deux termes dans la parenthèse, donc deux produits.', 'B = 2x² + 3x - 2.', 'Le -2 final n’a rien à voir avec la distributivité.'),
    exercice('E02', 3, 'seconde', 'Développe : C = (x + 2)(x + 5)', 'Double distributivité : quatre produits au total.', 'C = x² + 5x + 2x + 10 = x² + 7x + 10.', 'Oublier les produits croisés.'),
  ],
  E03: [
    exercice('E03', 1, 'seconde', 'Développe : A = (x + 4)²', 'Récite : carré, double produit, carré.', 'A = x² + 8x + 16. Le double produit est 2 × x × 4 = 8x.', 'Croire que (a+b)² = a² + b².'),
    exercice('E03', 2, 'seconde', 'Développe : B = (3x - 2)²', 'Le signe du double produit suit celui du second terme.', 'B = 9x² - 12x + 4.', 'Oublier le carré du coefficient 3, ou le signe du -12x.'),
    exercice('E03', 3, 'seconde', 'Développe : C = (x + 6)(x - 6)', 'C’est la troisième identité remarquable.', 'C = x² - 36.', 'Écrire x² + 36 au lieu de x² - 36.'),
  ],
  E04: [
    exercice('E04', 1, 'seconde', 'Calcule : A = 1/2 + 1/3', 'Cherche un dénominateur commun avant d’additionner.', 'A = 3/6 + 2/6 = 5/6.', 'Additionner aussi les dénominateurs.'),
    exercice('E04', 2, 'seconde', 'Calcule : B = 3/4 - 1/6', 'Sur 12, ajuste chaque numérateur.', 'B = 9/12 - 2/12 = 7/12.', 'Oublier d’ajuster le numérateur quand on change le dénominateur.'),
    exercice('E04', 3, 'seconde', 'Calcule et simplifie : C = 2/5 + 1/2 - 1/10', 'Trois fractions, un seul dénominateur commun.', 'C = 4/10 + 5/10 - 1/10 = 8/10 = 4/5.', 'Traiter les trois termes deux par deux et se tromper de dénominateur.'),
  ],
  E05: [
    exercice('E05', 1, 'première', 'Résous f(x) = 0 pour f(x) = (x - 3)/(x + 2), en précisant le domaine.', 'Une fraction n’existe pas si son dénominateur vaut zéro.', 'Domaine : x ≠ -2. f(x) = 0 ⇔ x - 3 = 0 ⇔ x = 3, qui est bien dans le domaine.', 'Oublier la valeur interdite.'),
    exercice('E05', 2, 'seconde', 'Résous x² = 9.', 'Un carré a deux racines, pas une.', 'x = 3 ou x = -3.', 'Ne donner que la racine positive.'),
    exercice('E05', 3, 'première', 'Résous √(x - 1) = 2 en discutant le domaine.', 'Une racine carrée exige un contenu positif ou nul.', 'Domaine : x ≥ 1. En élevant au carré : x - 1 = 4 donc x = 5, qui vérifie le domaine.', 'Élever au carré sans vérifier que la solution convient.'),
  ],
  E06: [
    exercice('E06', 1, 'seconde', 'Écris sous la forme a × xⁿ : A = (2x)³', 'L’exposant porte sur TOUT ce qui est dans la parenthèse.', 'A = 2³ × x³ = 8x³.', 'N’élever que le x et oublier le 2.'),
    exercice('E06', 2, 'seconde', 'Simplifie : B = x⁵ × x²', 'Quand on multiplie, les exposants s’additionnent.', 'B = x⁷ : quand on multiplie, les exposants s’additionnent.', 'Multiplier les exposants au lieu de les additionner.'),
    exercice('E06', 3, 'première', 'Simplifie : C = (3x²)² ÷ x³', 'Commence par la puissance du produit.', 'C = 9x⁴ ÷ x³ = 9x.', 'Quand on divise, les exposants se soustraient.'),
  ],
  E07: [
    exercice('E07', 1, 'seconde', 'Calcule : A = √(9 + 16)', 'Calcule d’abord ce qui est sous la racine.', 'A = √25 = 5. Et non 3 + 4.', 'Croire que la racine d’une somme est la somme des racines.'),
    exercice('E07', 2, 'seconde', 'Simplifie : B = √50', 'Cherche le plus grand carré parfait diviseur de 50.', 'B = √(25 × 2) = 5√2.', 'Répondre 25√2 en oubliant la racine sur 25.'),
    exercice('E07', 3, 'première', 'Simplifie : C = √12 + √27', 'Même méthode sur chaque racine, puis regroupe.', 'C = 2√3 + 3√3 = 5√3.', 'Additionner les nombres sous les racines.'),
  ],
  E08: [
    exercice('E08', 1, 'seconde', 'Résous : 3x + 7 = 22', 'Écris l’opération inverse appliquée des DEUX côtés.', '3x = 22 - 7 = 15, donc x = 5.', 'Additionner 7 au lieu de le soustraire.'),
    exercice('E08', 2, 'seconde', 'Résous : 5x - 4 = 2x + 11', 'Regroupe les x d’un côté, les nombres de l’autre.', '3x = 15, donc x = 5.', 'Changer le signe d’un terme en le faisant passer de l’autre côté.'),
    exercice('E08', 3, 'seconde', 'Résous : (x + 3)/2 = 7', 'Que faut-il faire pour se débarrasser du dénominateur ?', 'x + 3 = 14, donc x = 11.', 'Diviser au lieu de multiplier des deux côtés.'),
  ],
  E09: [
    exercice('E09', 1, 'seconde', 'Une voiture roule à 100/3 km/h. Quelle distance en 7 h ? Garde la valeur exacte.', 'N’arrondis pas avant la dernière ligne.', 'd = (100/3) × 7 = 700/3 km, soit environ 233,33 km.', 'Arrondir 100/3 à 33 trop tôt.'),
    exercice('E09', 2, 'seconde', 'Calcule exactement : A = (2/3) × (9/4)', 'Simplifie avant de multiplier si possible.', 'A = 18/12 = 3/2.', 'Donner 1,5 alors qu’on demande la valeur exacte.'),
    exercice('E09', 3, 'première', 'Exprime 3√2 exactement, puis arrondis au centième.', 'La valeur exacte reste sous forme de racine.', '3√2 ≈ 4,24 (car √2 ≈ 1,41421).', 'Arrondir √2 à 1,4 puis multiplier : on perd la précision.'),
  ],
  E10: [
    exercice('E10', 1, 'seconde', 'Un rectangle mesure 3 m sur 2,5 m. Donne son aire, avec l’unité.', 'Une aire s’exprime en unités carrées.', 'A = 3 × 2,5 = 7,5 m².', 'Oublier l’unité, ou écrire m au lieu de m².'),
    exercice('E10', 2, 'seconde', 'Convertis 2 h 30 min en heures décimales.', '30 minutes valent une demi-heure.', '2 h 30 = 2,5 h.', 'Écrire 2,3 h en collant les chiffres.'),
    exercice('E10', 3, 'première', 'Convertis 90 km/h en m/s.', '1 km = 1000 m et 1 h = 3600 s.', '90 × 1000 ÷ 3600 = 25 m/s.', 'Multiplier au lieu de diviser par 3,6.'),
  ],
  E11: [
    exercice('E11', 1, 'seconde', 'Recopie l’équation 4x + 9 = 25, puis résous-la.', 'Relis ta recopie chiffre par chiffre avant de calculer.', '4x = 16, donc x = 4.', 'Recopier 4x - 9 ou 4x + 6 et juste ensuite.'),
    exercice('E11', 2, 'seconde', 'Recopie 3(x - 2) + 5, puis développe.', 'Entoure les nombres recopiés pour les vérifier.', '3x - 6 + 5 = 3x - 1.', 'Recopier 3(x + 2) et développer correctement… la mauvaise expression.'),
    exercice('E11', 3, 'première', 'Recopie la fraction (x + 1)/(x - 2), puis donne son domaine.', 'Le dénominateur est le point sensible à recopier.', 'Domaine : x ≠ 2.', 'Recopier x + 2 au dénominateur et conclure x ≠ -2.'),
  ],
  E12: [
    exercice('E12', 1, 'seconde', 'Montre que x = 2 est solution de 3x - 1 = 5, en écrivant chaque étape.', 'Remplace, calcule, puis conclus par une phrase.', '3 × 2 - 1 = 6 - 1 = 5. Donc 2 est bien solution.', 'Écrire seulement « x = 2 » sans vérification.'),
    exercice('E12', 2, 'seconde', 'Résous x² = 25 en justifiant chaque passage.', 'Nomme la propriété que tu utilises.', 'x² = 25 ⇔ x² - 25 = 0 ⇔ (x - 5)(x + 5) = 0, donc x = 5 ou x = -5.', 'Donner les deux solutions sans expliquer d’où elles viennent.'),
    exercice('E12', 3, 'première', 'Prouve que la somme de deux entiers pairs est paire.', 'Pose deux entiers pairs avec des variables, puis factorise.', 'Soit 2a et 2b. Leur somme est 2a + 2b = 2(a + b), qui est un multiple de 2 : elle est paire.', 'Affirmer le résultat sans passer par les variables.'),
  ],
}

export function exercicesDe(code: string): ExerciceBanque[] {
  return CODES_ERREUR.includes(code as CodeBanque) ? BANQUE[code as CodeBanque] : []
}

/**
 * Choisit un exercice du type visé. Déterministe à options égales : la graine
 * (par défaut l'horodatage) ne sert qu'à varier d'un tirage à l'autre quand
 * l'élève demande « un autre exercice ».
 */
export function exercicePour(
  code: string,
  options: { difficulte?: 1 | 2 | 3; exclure?: string[]; graine?: number } = {},
): ExerciceBanque | undefined {
  const liste = exercicesDe(code)
  if (liste.length === 0) return undefined
  const exclus = new Set(options.exclure ?? [])
  const candidats = liste.filter((exercice) => !exclus.has(exercice.id))
  const pool = candidats.length > 0 ? candidats : liste

  if (options.difficulte) {
    const vise = pool.find((exercice) => exercice.difficulte === options.difficulte)
    if (vise) return vise
  }
  const graine = options.graine ?? 0
  return pool[graine % pool.length]
}

/** Convertit en `ExerciceVerifie` : tentative 0 signale « vient de la banque ». */
export function exerciceVerifie(exercice: ExerciceBanque): ExerciceVerifie {
  const exerciceProduit: Exercice = {
    enonce: exercice.enonce,
    indices: exercice.indices,
    solution: exercice.solution,
    typeTravaille: exercice.code,
    niveau: exercice.niveau,
    tentative: 0,
    id: exercice.id,
    source: 'banque',
  }
  return { exercice: exerciceProduit, verdict: VERDICT_BANQUE }
}

/** Libellé affiché pour signaler l'origine de l'exercice. */
export function origineExercice(exercice: Exercice): string {
  return exercice.tentative === 0
    ? `Exercice de la banque locale (${libelleDe(exercice.typeTravaille)}) — aucun appel réseau.`
    : 'Exercice inédit, généré et vérifié par le modèle.'
}
