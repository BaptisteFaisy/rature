/**
 * Corpus de validation — 5 copies corrigées + 2 copies propres.
 *
 * Ces fixtures sont **synthétiques** : elles décrivent des annotations telles
 * qu'elles apparaissent sur une copie de lycée, et la réponse JSON que rend le
 * modèle de classification. Elles rendent le test reproductible et versionné
 * (RNF-03/RNF-04 se mesurent en CI, sans réseau ni quota).
 *
 * La validation sur vraies copies (5 photos + 2 copies propres, go/no-go du
 * jour 1) reste indispensable : voir `corpus/README.md`.
 */
import type { CodeErreur } from '../src/domain/taxonomy'
import type { Annotation } from '../src/domain/types'

export type ErreurSimulee = {
  code: string
  ligne: string
  explication: string
  confiance: number
}

export type FixtureCopie = {
  id: string
  description: string
  annotations: Annotation[]
  classementModele: ErreurSimulee[]
  typeDominantAttendu: CodeErreur | null
  estPropre: boolean
}

const COPIE_1: FixtureCopie = {
  id: 'c1-signes',
  description: 'Développement avec signe perdu + une faute de recopie',
  annotations: [
    { ligne: '-2(3x - 5) = -6x - 10', annotation: 'signe !' },
    { ligne: '4(x - 1) = 4x - 4', annotation: 'ok' },
    { ligne: '2x + 3 = 2x + 5 (énoncé recopié 2x + 7)', annotation: 'recopie' },
  ],
  classementModele: [
    { code: 'E01', ligne: '-2(3x - 5) = -6x - 10', explication: 'Le signe change entre les deux lignes.', confiance: 0.92 },
    { code: 'E01', ligne: '-2(3x - 5) + 4(x - 1) = -2x - 14', explication: 'Même signe perdu, propagé.', confiance: 0.81 },
    { code: 'E11', ligne: '2x + 3 recopié au lieu de 2x + 7', explication: 'L’énoncé a été mal recopié, le calcul est juste.', confiance: 0.74 },
  ],
  typeDominantAttendu: 'E01',
  estPropre: false,
}

const COPIE_2: FixtureCopie = {
  id: 'c2-identite',
  description: 'Identité remarquable mal appliquée',
  annotations: [
    { ligne: '(x + 3)² = x² + 9', annotation: 'faux' },
    { ligne: '(2x - 1)² = 4x² + 1', annotation: 'double produit ?' },
  ],
  classementModele: [
    { code: 'E03', ligne: '(x + 3)² = x² + 9', explication: 'Il manque le double produit 6x.', confiance: 0.95 },
    { code: 'E03', ligne: '(2x - 1)² = 4x² + 1', explication: 'Il manque -4x et le signe du carré.', confiance: 0.88 },
    { code: 'E02', ligne: '3(x + 2) = 3x + 2', explication: 'Le 3 ne multiplie pas le 2.', confiance: 0.52 },
  ],
  typeDominantAttendu: 'E03',
  estPropre: false,
}

const COPIE_3: FixtureCopie = {
  id: 'c3-fractions',
  description: 'Dénominateur commun erroné',
  annotations: [
    { ligne: '1/3 + 1/4 = 2/7', annotation: 'non !' },
    { ligne: '2/5 - 1/5 = 1/5', annotation: 'ok' },
  ],
  classementModele: [
    { code: 'E04', ligne: '1/3 + 1/4 = 2/7', explication: 'On additionne les numérateurs sur dénominateur commun 12.', confiance: 0.9 },
    { code: 'E04', ligne: '3/8 + 1/2 = 4/10', explication: 'Même confusion sur le dénominateur.', confiance: 0.77 },
  ],
  typeDominantAttendu: 'E04',
  estPropre: false,
}

const COPIE_4: FixtureCopie = {
  id: 'c4-racines',
  description: 'Racine mal simplifiée + une annotation illisible (confiance basse)',
  annotations: [
    { ligne: '√(9 + 16) = 3 + 4', annotation: 'faux' },
    { ligne: 'gribouillis', annotation: 'illisible' },
  ],
  classementModele: [
    { code: 'E07', ligne: '√(9 + 16) = 3 + 4', explication: 'La racine d’une somme n’est pas la somme des racines.', confiance: 0.93 },
    { code: 'E05', ligne: 'gribouillis', explication: 'Annotation illisible, impossible à typer.', confiance: 0.31 },
  ],
  typeDominantAttendu: 'E07',
  estPropre: false,
}

const COPIE_5: FixtureCopie = {
  id: 'c5-transposition',
  description: 'Transposition fautive + conclusion non justifiée',
  annotations: [
    { ligne: '2x + 3 = 7 donc x = 7 + 3 / 2', annotation: '?' },
    { ligne: 'donc x = 5', annotation: 'justifie' },
  ],
  classementModele: [
    { code: 'E08', ligne: '2x + 3 = 7 donc x = 7 + 3 / 2', explication: 'On soustrait 3 des deux côtés, on n’additionne pas.', confiance: 0.86 },
    { code: 'E12', ligne: 'donc x = 5', explication: 'Aucune étape ne justifie ce résultat.', confiance: 0.64 },
  ],
  typeDominantAttendu: 'E08',
  estPropre: false,
}

const PROPRE_1: FixtureCopie = {
  id: 'p1-propre',
  description: 'Copie sans aucune annotation du professeur',
  annotations: [],
  classementModele: [],
  typeDominantAttendu: null,
  estPropre: true,
}

const PROPRE_2: FixtureCopie = {
  id: 'p2-propre-avec-note',
  description: 'Copie juste, seule une note globale est présente (pas une faute)',
  annotations: [],
  classementModele: [],
  typeDominantAttendu: null,
  estPropre: true,
}

export const COPIES_CORRIGEES: FixtureCopie[] = [COPIE_1, COPIE_2, COPIE_3, COPIE_4, COPIE_5]
export const COPIES_PROPRES: FixtureCopie[] = [PROPRE_1, PROPRE_2]
export const CORPUS: FixtureCopie[] = [...COPIES_CORRIGEES, ...COPIES_PROPRES]

/** Réponse JSON telle que la rendrait le modèle d'extraction. */
export function reponseExtraction(fixture: FixtureCopie): string {
  return JSON.stringify({
    annotations: fixture.annotations,
    copiePropre: fixture.estPropre,
    nomDetecte: fixture.estPropre ? null : 'Élève Test',
  })
}

/** Réponse JSON telle que la rendrait le modèle de classification. */
export function reponseClassification(fixture: FixtureCopie): string {
  return JSON.stringify({ erreurs: fixture.classementModele })
}
