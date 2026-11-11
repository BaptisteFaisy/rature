/**
 * Étape 4 — Classification : chaque annotation reçoit un code de la taxonomie
 * fermée, avec une confiance. Le seuil (0,6) et la pondération (E11 = 0) sont
 * appliqués par `normaliserErreur`, pas par le modèle : c'est nous qui tenons
 * la règle, jamais le modèle.
 */
import promptMd from '../../prompts/classification.md?raw'
import { TAXONOMIE } from '../domain/taxonomy'
import { normaliserErreur } from '../domain/diagnostic'
import type { Erreur, Extraction } from '../domain/types'
import { clientParDefaut } from './client'
import type { ClientBrut } from './client'
import type { Transport } from './llm'
import { parserClassification } from './schemas'

/** Taxonomie rendue en texte : une seule source de vérité, le code. */
export function blocTaxonomie(): string {
  return TAXONOMIE.map((t) => `- \`${t.code}\` — **${t.libelle}** : ${t.signature}`).join('\n')
}

export const PROMPT_CLASSIFICATION = promptMd.replace('{{TAXONOMIE}}', blocTaxonomie())

/** Les annotations sont numérotées : le modèle répond dans le même ordre. */
export function messageAnnotations(extraction: Extraction): string {
  const lignes = extraction.annotations.map((annotation, index) => {
    const morceaux = [`${index + 1}. ligne : ${annotation.ligne}`, `   annotation : ${annotation.annotation}`]
    if (annotation.eleve) morceaux.push(`   écrit par l'élève : ${annotation.eleve}`)
    if (annotation.attendu) morceaux.push(`   attendu (d'après le prof) : ${annotation.attendu}`)
    return morceaux.join('\n')
  })
  return [
    "Annonce de la copie : une annotation = une erreur. Classe chacune.",
    '',
    lignes.join('\n'),
  ].join('\n')
}

export async function classerAnnotations(
  extraction: Extraction,
  transport: Transport,
  client: ClientBrut = clientParDefaut(transport),
): Promise<Erreur[]> {
  // Copie propre : on ne classe rien. Zéro appel, zéro faute inventée (RNF-04).
  if (extraction.copiePropre || extraction.annotations.length === 0) return []

  const texte = await client({
    system: PROMPT_CLASSIFICATION,
    user: messageAnnotations(extraction),
    json: true,
    temperature: 0.1,
    maxTokens: 2000,
  })
  return parserClassification(texte).map(normaliserErreur)
}
