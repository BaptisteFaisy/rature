/**
 * Étape 3+4 fusionnées — un seul appel vision rend les annotations du
 * professeur ET leur typage.
 *
 * Pourquoi fusionner : mesuré le 11 novembre, chaque aller-retour avec l'amont
 * coûte 16 à 50 s (place de marché, modèles parfois sans capacité). Deux appels
 * séquentiels faisaient tomber le budget « photo → diagnostic » à 40-90 s. Un
 * seul appel le ramène vers les 20 s du cahier des charges (RNF-01).
 *
 * Ce qui ne change pas : les **règles** restent locales. Le modèle propose des
 * codes et des confiances ; le seuil de 0,6, la rétrogradation en E99 et la
 * pondération nulle de E11 sont appliqués par `normaliserErreur`, jamais par lui.
 */
import promptMd from '../../prompts/analyse.md?raw'
import { normaliserErreur } from '../domain/diagnostic'
import type { Erreur, Extraction } from '../domain/types'
import { clientParDefaut } from './client'
import type { ClientBrut } from './client'
import { blocTaxonomie } from './classify'
import type { Transport } from './llm'
import { parserAnalyse } from './schemas'

export const PROMPT_ANALYSE = promptMd.replace('{{TAXONOMIE}}', blocTaxonomie())

export type AnalyseFusionnee = { extraction: Extraction; erreurs: Erreur[] }

export function messageAnalyse(): string {
  return [
    'Voici la photo d’une copie corrigée.',
    'Relève les annotations du professeur et type chacune dans la taxonomie, puis rends le JSON demandé.',
  ].join(' ')
}

/** Convertit les annotations fusionnées en `Extraction` + fautes normalisées. */
export function decouperAnalyse(brut: ReturnType<typeof parserAnalyse>): AnalyseFusionnee {
  const extraction: Extraction = {
    annotations: brut.annotations.map((a) => ({
      ligne: a.ligne,
      annotation: a.annotation,
      ...(a.eleve ? { eleve: a.eleve } : {}),
      ...(a.attendu ? { attendu: a.attendu } : {}),
      ...(a.zone ? { zone: a.zone } : {}),
    })),
    copiePropre: brut.copiePropre,
    ...(brut.nomDetecte ? { nomDetecte: brut.nomDetecte } : {}),
  }
  // Copie propre : aucune faute, quoi qu'ait écrit le modèle (RNF-04).
  const erreurs = extraction.copiePropre
    ? []
    : brut.annotations.map((a) =>
        normaliserErreur({
          code: a.code,
          ligne: a.ligne,
          explication: a.explication,
          confiance: a.confiance,
          ...(a.zone ? { zone: a.zone } : {}),
        }),
      )
  return { extraction, erreurs }
}

export async function analyserImage(
  dataUrl: string,
  transport: Transport,
  client: ClientBrut = clientParDefaut(transport),
): Promise<AnalyseFusionnee> {
  const texte = await client({
    system: PROMPT_ANALYSE,
    user: messageAnalyse(),
    image: dataUrl,
    json: true,
    temperature: 0.1,
    maxTokens: 1600,
  })
  return decouperAnalyse(parserAnalyse(texte))
}
