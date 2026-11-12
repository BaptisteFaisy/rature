/**
 * Sommaire unique de l'écran « Comment ça marche ».
 *
 * Chaque section lit ici son ancre et son titre ; l'écran y lit son sommaire.
 * Aucune chaîne n'est recopiée d'un fichier à l'autre : ajouter une section,
 * c'est ajouter une entrée ici.
 */
export const SECTIONS = {
  pipeline: { id: 'pipeline', titre: 'Le pipeline, étape par étape' },
  taxonomie: { id: 'taxonomie', titre: 'Les 12 types d’erreur' },
  gardeFou: { id: 'garde-fou', titre: 'Le garde-fou de l’exercice' },
  confidentialite: { id: 'confidentialite', titre: 'Tes données : les cinq règles' },
  mesures: { id: 'mesures', titre: 'Les chiffres réels, mesurés' },
  outilsIA: { id: 'outils-ia', titre: 'L’IA dans le produit, l’IA dans le code' },
  liens: { id: 'liens', titre: 'Aller plus loin' },
} as const

export type SectionDef = (typeof SECTIONS)[keyof typeof SECTIONS]

/** Ordre d'affichage : l'ordre de déclaration ci-dessus. */
export const SOMMAIRE: readonly SectionDef[] = Object.values(SECTIONS)
