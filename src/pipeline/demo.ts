/**
 * Mode démonstration — rejoue des réponses **réellement enregistrées** par le
 * modèle sur la copie synthétique n°1 (`corpus/reponses/copie-1-signes.json`,
 * captées par `tests/live/enregistrer-demo.test.ts`).
 *
 * À quoi ça sert : la démo publique (GitHub Pages) n'embarque aucune clé, et
 * l'amont peut être lent ou sans capacité le jour du jugement. Le parcours
 * complet reste donc démontrable hors ligne — les parseurs zod travaillent sur
 * du vrai JSON de modèle, rien n'est court-circuité.
 *
 * Honnêteté : l'UI affiche « réponses enregistrées » quand ce mode tourne.
 */
import imageDemoUrl from '../../corpus/images/copie-1-signes.png'
import enregistrement from '../../corpus/reponses/copie-1-signes.json'
import type { ClientBrut } from './client'
import type { RequeteLLM } from './llm'

export type EtapeDemo = 'extraction' | 'classification' | 'exercice' | 'verdict'

/** Quelle étape le prompt en cours correspond-il ? (marqueurs de titres) */
export function etapeDe(requete: RequeteLLM): EtapeDemo {
  const system = requete.system
  if (system.includes('Garde-fou')) return 'verdict'
  if (system.includes('Génération')) return 'exercice'
  if (system.includes('Classification')) return 'classification'
  return 'extraction'
}

/** Réponses enregistrées, brutes, telles que le modèle les a rendues. */
export function reponsesEnregistrees(): Record<EtapeDemo, string> {
  const brutes = enregistrement.reponses as Record<string, string>
  return {
    extraction: brutes.extraction ?? '',
    classification: brutes.classification ?? '',
    exercice: brutes.exercice ?? '',
    verdict: brutes.verdict ?? '',
  }
}

export function clientDemo(): ClientBrut {
  const reponses = reponsesEnregistrees()
  return async (requete: RequeteLLM) => {
    const texte = reponses[etapeDe(requete)]
    if (!texte) throw new Error('Mode démo : réponse enregistrée manquante.')
    return texte
  }
}

/** Métadonnées de l'enregistrement, affichées dans l'UI. */
export function origineDemo(): { modele: string; enregistreLe: string; dominant: string } {
  return {
    modele: enregistrement.modele,
    enregistreLe: enregistrement.enregistreLe,
    dominant: enregistrement.dominant,
  }
}

export { imageDemoUrl }

/** La copie de démo, en `File` : le pipeline tourne exactement comme en vrai. */
export async function fichierDemo(): Promise<File> {
  const reponse = await fetch(imageDemoUrl)
  const blob = await reponse.blob()
  return new File([blob], 'copie-demo.png', { type: blob.type || 'image/png' })
}
