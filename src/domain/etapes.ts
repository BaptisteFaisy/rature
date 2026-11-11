import type { EtapeId } from './types'

/**
 * Les six étapes du pipeline, dans l'ordre. Source unique des libellés :
 * l'orchestrateur et l'écran d'analyse les lisent ici, jamais en double.
 */
export const ETAPES: { id: EtapeId; libelle: string }[] = [
  { id: 'ingest', libelle: 'Lecture de la photo' },
  { id: 'anonymise', libelle: 'Masquage du nom' },
  { id: 'extrait', libelle: 'Relevé des annotations du professeur' },
  { id: 'classifie', libelle: 'Classement dans les 12 types' },
  { id: 'agrege', libelle: 'Mise à jour de ton profil' },
  { id: 'genere', libelle: 'Fabrication de l’exercice ciblé' },
]

export function libelleEtape(id: EtapeId): string {
  return ETAPES.find((e) => e.id === id)?.libelle ?? id
}
