/**
 * Point d'injection du modèle : tout le pipeline parle à un `ClientBrut`,
 * jamais directement à `fetch`. Les tests fournissent une fonction qui rend
 * du JSON simulé — aucun réseau, aucun quota consommé.
 */
import { completer } from './llm'
import type { RequeteLLM, Transport } from './llm'

export type ClientBrut = (requete: RequeteLLM) => Promise<string>

/** Client réel : proxy edge ou BYOK, selon le transport. */
export function clientParDefaut(transport: Transport): ClientBrut {
  return (requete: RequeteLLM) => completer(transport, requete)
}

/** Client de test : rend la réponse suivante de la file, ou échoue au-delà. */
export function clientSimule(reponses: string[]): ClientBrut {
  let index = 0
  return async () => {
    const reponse = reponses[index]
    if (reponse === undefined) throw new Error('clientSimule : plus de réponse disponible')
    index += 1
    return reponse
  }
}
