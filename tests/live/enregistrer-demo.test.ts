/**
 * Enregistreur du corpus de démo — capte les vraies réponses du modèle sur la
 * copie synthétique n°1 et les écrit dans `corpus/reponses/`.
 *
 * Pourquoi : la démo publique (GitHub Pages) n'a pas de clé, et l'amont peut
 * être lent ou sans capacité le jour du jugement. Le produit rejoue donc ces
 * réponses enregistrées — c'est le « cache des réponses sur le corpus de démo »
 * prévu au tableau des risques (§24). Tout est rejoué **brut** : les parseurs
 * zod travaillent pour de vrai, rien n'est triché.
 *
 * Ignoré sans clé. Lancement :
 *   INFERHUB_API_KEY=… npx vitest run tests/live/enregistrer-demo.test.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../../src/domain/diagnostic'
import { MODELE_PAR_DEFAUT } from '../../src/domain/config'
import { classerAnnotations } from '../../src/pipeline/classify'
import type { ClientBrut } from '../../src/pipeline/client'
import { genererExerciceVerifie } from '../../src/pipeline/exercise'
import { extraireAnnotations } from '../../src/pipeline/extract'
import type { RequeteLLM, Transport } from '../../src/pipeline/llm'
import { chaineModeles, construireCorps } from '../../src/pipeline/llm'

const CLE = process.env.INFERHUB_API_KEY ?? ''
const AMONT = process.env.RATURE_AMONT ?? 'https://api.inferhub.dev/v1'
const DELAI_MS = 90_000
const COPIE = 'copie-1-signes.png'
const SORTIE = '../../corpus/reponses/copie-1-signes.json'
const transport: Transport = { proxy: `${AMONT}/chat/completions`, modele: MODELE_PAR_DEFAUT }

async function appeler(requete: RequeteLLM, modele: string): Promise<string> {
  const reponse = await fetch(`${AMONT}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CLE}` },
    body: JSON.stringify(construireCorps(requete, modele)),
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!reponse.ok) {
    throw Object.assign(new Error(`amont HTTP ${reponse.status}`), { statut: reponse.status })
  }
  const data = (await reponse.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

const TRANSITOIRES = new Set([402, 500, 502, 503, 504])

/** Client réel avec repli, qui enregistre chaque réponse brute sous une clé. */
function clientEnregistreur(brut: Record<string, string[]>, cle: string): ClientBrut {
  return async (requete: RequeteLLM) => {
    let derniere = 'aucun modèle disponible'
    for (const modele of chaineModeles(transport)) {
      try {
        const texte = await appeler(requete, modele)
        brut[cle] = [...(brut[cle] ?? []), texte]
        return texte
      } catch (erreur) {
        if (!TRANSITOIRES.has((erreur as { statut?: number }).statut ?? 0)) throw erreur
        derniere = (erreur as Error).message
      }
    }
    throw new Error(derniere)
  }
}

function image(nom: string): string {
  const chemin = fileURLToPath(new URL(`../../corpus/images/${nom}`, import.meta.url))
  return `data:image/png;base64,${readFileSync(chemin).toString('base64')}`
}

describe.skipIf(!CLE)('enregistrement du corpus de démo', () => {
  it(
    'capte extraction, classification, exercice et verdict sur la copie 1',
    async () => {
      const brut: Record<string, string[]> = {}
      const extraction = await extraireAnnotations(
        image(COPIE),
        transport,
        clientEnregistreur(brut, 'extraction'),
      )
      const erreurs = await classerAnnotations(
        extraction,
        transport,
        clientEnregistreur(brut, 'classification'),
      )
      const diagnostic = construireDiagnostic(erreurs, { id: COPIE, createdAt: new Date().toISOString() })
      expect(diagnostic.typeDominant).toBeTruthy()

      await genererExerciceVerifie({
        typeDominant: diagnostic.typeDominant!,
        extraitCopie: extraction.annotations.map((a) => a.ligne).slice(0, 6).join('\n'),
        transport,
        client: async (requete: RequeteLLM) => {
          const cle = requete.system.includes('Garde-fou') ? 'verdict' : 'exercice'
          return clientEnregistreur(brut, cle)(requete)
        },
      })

      const sortie = fileURLToPath(new URL(SORTIE, import.meta.url))
      mkdirSync(fileURLToPath(new URL('../../corpus/reponses/', import.meta.url)), { recursive: true })
      writeFileSync(
        sortie,
        `${JSON.stringify(
          {
            source: `corpus/images/${COPIE}`,
            modele: MODELE_PAR_DEFAUT,
            enregistreLe: new Date().toISOString(),
            dominant: diagnostic.typeDominant,
            reponses: Object.fromEntries(Object.entries(brut).map(([cle, liste]) => [cle, liste[0]])),
          },
          null,
          2,
        )}\n`,
      )
      console.info(`[démo] enregistré dans ${sortie} — dominant ${diagnostic.typeDominant}`)
      expect(brut.extraction?.[0]).toBeTruthy()
      expect(brut.classification?.[0]).toBeTruthy()
      expect(brut.exercice?.[0]).toBeTruthy()
      expect(brut.verdict?.[0]).toBeTruthy()
    },
    DELAI_MS * 6,
  )
})
