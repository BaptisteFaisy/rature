/**
 * Taxonomie fermée des erreurs (maths) — décision structurante du projet.
 *
 * Le modèle n'invente jamais de catégorie : il doit choisir parmi ces 12 codes,
 * ou répondre E99 (« non typée ») qui est exclue du profil. C'est ce verrou qui
 * rend le diagnostic mesurable et défendable (cf. RATURE.md §17).
 */

export const CODES_ERREUR = [
  'E01',
  'E02',
  'E03',
  'E04',
  'E05',
  'E06',
  'E07',
  'E08',
  'E09',
  'E10',
  'E11',
  'E12',
] as const

/** E99 = aucune catégorie avec confiance suffisante : signalée, hors profil. */
export type CodeErreur = (typeof CODES_ERREUR)[number] | 'E99'

export type TypeErreur = {
  code: (typeof CODES_ERREUR)[number]
  libelle: string
  /** Signature à rechercher — sert de garde-fou dans les prompts. */
  signature: string
}

export const TAXONOMIE: readonly TypeErreur[] = [
  {
    code: 'E01',
    libelle: 'Signe perdu',
    signature:
      "Changement de signe non justifié entre deux lignes, typiquement au développement.",
  },
  {
    code: 'E02',
    libelle: 'Développement incomplet',
    signature:
      "Distributivité partielle : un terme de la parenthèse n'est pas multiplié.",
  },
  {
    code: 'E03',
    libelle: 'Identité remarquable mal appliquée',
    signature: '(a+b)² développé en a²+b², ou signe du double produit erroné.',
  },
  {
    code: 'E04',
    libelle: 'Dénominateur commun erroné',
    signature:
      'Somme de fractions : dénominateurs mal combinés, numérateur non ajusté.',
  },
  {
    code: 'E05',
    libelle: 'Cas particulier oublié',
    signature:
      'Division par zéro, valeur exclue du domaine, racine négative non discutée.',
  },
  {
    code: 'E06',
    libelle: 'Puissance mal gérée',
    signature:
      "Exposant appliqué à une partie seulement, règles de puissances confondues.",
  },
  {
    code: 'E07',
    libelle: 'Racine mal simplifiée',
    signature: '√(a+b) décomposé en √a+√b, simplification incorrecte.',
  },
  {
    code: 'E08',
    libelle: 'Transposition fautive',
    signature:
      "Passage d'un membre à l'autre sans opération inverse correcte.",
  },
  {
    code: 'E09',
    libelle: 'Arrondi / précision',
    signature:
      "Arrondi prématuré, propagation d'erreur, valeur exacte remplacée trop tôt.",
  },
  {
    code: 'E10',
    libelle: 'Unité manquante ou conversion',
    signature: 'Résultat sans unité, conversion incohérente.',
  },
  {
    code: 'E11',
    libelle: 'Erreur de recopie',
    signature:
      "Inattention : l'énoncé ou la ligne précédente est mal recopié, calcul correct ensuite.",
  },
  {
    code: 'E12',
    libelle: 'Conclusion non justifiée',
    signature:
      'Raisonnement valide mais étape logique manquante ou affirmation non démontrée.',
  },
] as const

export const CODE_NON_TYPEE: CodeErreur = 'E99'
export const LIBELLE_NON_TYPEE = 'Non typée'

const PAR_CODE = new Map<string, TypeErreur>(TAXONOMIE.map((t) => [t.code, t]))

export function libelleDe(code: CodeErreur): string {
  if (code === CODE_NON_TYPEE) return LIBELLE_NON_TYPEE
  return PAR_CODE.get(code)?.libelle ?? LIBELLE_NON_TYPEE
}

export function signatureDe(code: CodeErreur): string {
  if (code === CODE_NON_TYPEE) return 'Aucun type ne correspond avec confiance suffisante.'
  return PAR_CODE.get(code)?.signature ?? ''
}

/** E99 sort du profil ; E11 y entre avec un poids nul (ce n'est pas une lacune). */
export function entreDansLeProfil(code: CodeErreur): boolean {
  return code !== CODE_NON_TYPEE
}

export function estPonderee(code: CodeErreur): boolean {
  return code !== 'E11' && code !== CODE_NON_TYPEE
}

export function estCodeConnu(valeur: unknown): valeur is CodeErreur {
  return typeof valeur === 'string' && (PAR_CODE.has(valeur) || valeur === CODE_NON_TYPEE)
}
