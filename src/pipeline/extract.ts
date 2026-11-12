/**
 * Étape 3 — Extraction : un seul appel multimodal lit la copie et rend les
 * annotations du professeur. Pas d'OCR classique : Tesseract échoue sur le
 * manuscrit, et c'est justement le manuscrit qui porte l'information.
 */
import promptMd from '../../prompts/extraction.md?raw'
import { clientParDefaut } from './client'
import type { ClientBrut } from './client'
import type { Transport } from './llm'
import { parserExtraction } from './schemas'
import type { Extraction } from '../domain/types'

export const PROMPT_EXTRACTION = promptMd

/** Le message utilisateur ne contient que l'image et une consigne courte. */
export function messageExtraction(): string {
  return 'Voici la photo d’une copie corrigée. Relève les annotations du professeur et rends le JSON demandé.'
}

export async function extraireAnnotations(
  dataUrl: string,
  transport: Transport,
  client: ClientBrut = clientParDefaut(transport),
): Promise<Extraction> {
  const texte = await client({
    system: PROMPT_EXTRACTION,
    user: messageExtraction(),
    image: dataUrl,
    json: true,
    temperature: 0.1,
    maxTokens: 2000,
  })
  return parserExtraction(texte)
}
