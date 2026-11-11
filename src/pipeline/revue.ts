/**
 * Étape 4 bis — seconde passe sur les fautes peu sûres (lot 3).
 *
 * Le risque que le cahier des charges qualifie de fatal est le faux positif :
 * un Raturé qui invente des fautes détruit la confiance. Le seuil de 0,6 écarte
 * les réponses franchement douteuses, mais laisse passer une faute typée à 0,7
 * sur une annotation ambiguë. D'où cette relecture : un second appel, **texte
 * seul** (donc rapide et peu coûteux), qui confirme, reclasse ou rétrograde en
 * E99 — sans jamais ajouter de faute.
 */
import promptMd from '../../prompts/revue.md?raw'
import { MAX_FAUTES_A_REVOIR, SEUIL_REVUE } from '../domain/config'
import { normaliserErreur } from '../domain/diagnostic'
import { libelleDe } from '../domain/taxonomy'
import type { Erreur } from '../domain/types'
import { clientParDefaut } from './client'
import type { ClientBrut } from './client'
import { blocTaxonomie } from './classify'
import type { Transport } from './llm'
import { parserRevue } from './schemas'

export const PROMPT_REVUE = promptMd.replace('{{TAXONOMIE}}', blocTaxonomie())

export type ResultatRevue = { erreurs: Erreur[]; revues: number; modifiees: number }

/** Une faute est à revoir si elle est typée mais sous le seuil de revue. */
export function aRevoir(erreur: Erreur): boolean {
  return erreur.code !== 'E99' && erreur.confiance > 0 && erreur.confiance < SEUIL_REVUE
}

/** Indices à revoir, les moins sûrs d'abord, bornés pour tenir la latence. */
export function indicesASurveiller(erreurs: Erreur[]): number[] {
  return erreurs
    .map((erreur, index) => ({ index, erreur }))
    .filter(({ erreur }) => aRevoir(erreur))
    .sort((a, b) => a.erreur.confiance - b.erreur.confiance)
    .slice(0, MAX_FAUTES_A_REVOIR)
    .map(({ index }) => index)
}

export function messageRevue(erreurs: Erreur[], indices: number[]): string {
  const lignes = indices.map((index, position) => {
    const erreur = erreurs[index]!
    return [
      `${position}. ligne : ${erreur.ligne}`,
      `   code proposé : ${erreur.code} (${libelleDe(erreur.code)}), confiance ${erreur.confiance.toFixed(2)}`,
      `   explication proposée : ${erreur.explication}`,
    ].join('\n')
  })
  return ['Fautes à revérifier, dans cet ordre :', '', lignes.join('\n')].join('\n')
}

/** Applique les verdicts : seuls les indices demandés peuvent changer. */
export function appliquerRevue(
  erreurs: Erreur[],
  indices: number[],
  verdicts: ReturnType<typeof parserRevue>,
): { erreurs: Erreur[]; modifiees: number } {
  const parPosition = new Map(verdicts.map((v) => [v.index, v]))
  let modifiees = 0
  const resultat = erreurs.map((erreur, index) => {
    const position = indices.indexOf(index)
    const verdict = position >= 0 ? parPosition.get(position) : undefined
    if (!verdict) return erreur
    const revue = normaliserErreur({
      code: verdict.code,
      ligne: erreur.ligne,
      explication: verdict.explication || erreur.explication,
      confiance: verdict.confiance,
      ...(erreur.zone ? { zone: erreur.zone } : {}),
    })
    if (revue.code !== erreur.code || revue.confiance !== erreur.confiance) modifiees += 1
    return revue
  })
  return { erreurs: resultat, modifiees }
}

export async function revoirFautesPeuSures(
  erreurs: Erreur[],
  transport: Transport,
  client: ClientBrut = clientParDefaut(transport),
): Promise<ResultatRevue> {
  const indices = indicesASurveiller(erreurs)
  if (indices.length === 0) return { erreurs, revues: 0, modifiees: 0 }

  const texte = await client({
    system: PROMPT_REVUE,
    user: messageRevue(erreurs, indices),
    json: true,
    temperature: 0,
    maxTokens: 900,
  })
  const { erreurs: revues, modifiees } = appliquerRevue(erreurs, indices, parserRevue(texte))
  return { erreurs: revues, revues: indices.length, modifiees }
}
