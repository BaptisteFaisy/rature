/**
 * Banc de validation live — appelle le VRAI modèle via InferHub.
 *
 * Désactivé sans clé : `INFERHUB_API_KEY` absente → les tests sont ignorés,
 * donc la CI reste verte et ne consomme aucun quota. Lancement manuel :
 *
 *   INFERHUB_API_KEY=… npx vitest run tests/live/inferhub.test.ts
 *
 * Ce banc mesure le go / no-go du jour 1 (RATURE-SPEC §22) : le modèle
 * lit-il les annotations manuscrites, et type-t-il correctement ? Les images
 * sont synthétiques (scripts/generer-copies.py) : elles valident le contrat
 * des prompts, pas la lecture d'un vrai manuscrit — pour ça, voir
 * corpus/README.md.
 *
 * Le client ici parle directement à l'amont (pas de proxy) : c'est un banc de
 * mesure, pas le chemin du produit.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../../src/domain/diagnostic'
import { classerAnnotations } from '../../src/pipeline/classify'
import type { ClientBrut } from '../../src/pipeline/client'
import { extraireAnnotations } from '../../src/pipeline/extract'
import type { RequeteLLM, Transport } from '../../src/pipeline/llm'
import { chaineModeles, construireCorps } from '../../src/pipeline/llm'
import { MODELE_PAR_DEFAUT } from '../../src/domain/config'

const CLE = process.env.INFERHUB_API_KEY ?? ''
const AMONT = process.env.RATURE_AMONT ?? 'https://api.inferhub.dev/v1'
const MODELE = process.env.RATURE_MODELE ?? MODELE_PAR_DEFAUT
const DELAI_MS = 90_000

const transport: Transport = { proxy: `${AMONT}/chat/completions`, modele: MODELE }

const TRANSITOIRES = new Set([402, 500, 502, 503, 504])

async function appeler(requete: RequeteLLM, modele: string): Promise<string> {
  const reponse = await fetch(`${AMONT}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CLE}` },
    body: JSON.stringify(construireCorps(requete, modele)),
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!reponse.ok) {
    throw Object.assign(new Error(`amont HTTP ${reponse.status} : ${(await reponse.text()).slice(0, 160)}`), {
      statut: reponse.status,
    })
  }
  const data = (await reponse.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/** Même chaîne de repli que le produit : un modèle sans capacité n'arrête pas le banc. */
const clientDirect: ClientBrut = async (requete: RequeteLLM) => {
  let derniere = 'aucun modèle disponible'
  for (const modele of chaineModeles(transport)) {
    try {
      return await appeler(requete, modele)
    } catch (erreur) {
      const statut = (erreur as { statut?: number }).statut ?? 0
      if (!TRANSITOIRES.has(statut)) throw erreur
      derniere = (erreur as Error).message
    }
  }
  throw new Error(derniere)
}

function image(nom: string): string {
  const chemin = fileURLToPath(new URL(`../../corpus/images/${nom}`, import.meta.url))
  return `data:image/png;base64,${readFileSync(chemin).toString('base64')}`
}

/** Mesure une copie de bout en bout : extraction puis classification. */
async function mesurer(nom: string) {
  const debut = Date.now()
  const extraction = await extraireAnnotations(image(nom), transport, clientDirect)
  const msExtraction = Date.now() - debut
  const debutClassement = Date.now()
  const erreurs = await classerAnnotations(extraction, transport, clientDirect)
  const diagnostic = construireDiagnostic(erreurs, { id: nom, createdAt: new Date().toISOString() })
  return {
    extraction,
    erreurs,
    diagnostic,
    msExtraction,
    msClassement: Date.now() - debutClassement,
  }
}

describe.skipIf(!CLE)('validation live du modèle (InferHub)', () => {
  it(
    'copie 1 : le signe perdu domine',
    async () => {
      const { extraction, diagnostic, msExtraction, msClassement } = await mesurer('copie-1-signes.png')
      console.info(
        `[copie-1] annotations=${extraction.annotations.length} dominant=${diagnostic.typeDominant} ` +
          `codes=${diagnostic.erreurs.map((e) => `${e.code}:${e.confiance}`).join(',')} ` +
          `extraction=${msExtraction}ms classement=${msClassement}ms`,
      )
      expect(extraction.copiePropre).toBe(false)
      expect(extraction.annotations.length).toBeGreaterThanOrEqual(2)
      expect(diagnostic.typeDominant).toBe('E01')
    },
    DELAI_MS * 2,
  )

  it(
    'copie 2 : identité remarquable et dénominateur commun',
    async () => {
      const { extraction, diagnostic } = await mesurer('copie-2-fractions.png')
      console.info(
        `[copie-2] annotations=${extraction.annotations.length} dominant=${diagnostic.typeDominant} ` +
          `codes=${diagnostic.erreurs.map((e) => `${e.code}:${e.confiance}`).join(',')}`,
      )
      expect(extraction.copiePropre).toBe(false)
      expect(['E03', 'E04']).toContain(diagnostic.typeDominant)
    },
    DELAI_MS * 2,
  )

  it(
    'copie 3 : aucune erreur inventée (RNF-04)',
    async () => {
      const { extraction, diagnostic } = await mesurer('copie-3-propre.png')
      console.info(
        `[copie-3] copiePropre=${extraction.copiePropre} annotations=${extraction.annotations.length} fautes=${diagnostic.nbFautes}`,
      )
      expect(diagnostic.nbFautes).toBe(0)
      expect(diagnostic.typeDominant).toBeNull()
    },
    DELAI_MS * 2,
  )
})
