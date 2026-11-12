/**
 * Adresses publiques du projet. Un seul endroit : les sections qui pointent vers
 * le dépôt ou la démo en découlent, aucune URL n'est recopiée.
 */
export const DEPOT = 'https://github.com/BaptisteFaisy/rature'

export const DEMO = 'https://baptistefaisy.github.io/rature/'

/** Lien GitHub vers un fichier du dépôt, sur la branche principale. */
export function docDuDepot(chemin: string): string {
  return `${DEPOT}/blob/main/${chemin}`
}
