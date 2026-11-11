/**
 * Banc fusionné — mesure le NOUVEAU chemin (lots 1+3) : un seul appel vision
 * (annotations + typage), puis la seconde passe sur les fautes peu sûres.
 *
 * À comparer aux mesures du chemin séparé (extraction puis classification),
 * déjà enregistrées le 11 novembre : latence 53-92 s par copie.
 *
 *   INFERHUB_API_KEY=… npx vitest run tests/live/fusion.test.ts
 *
 * Ignoré sans clé : la CI reste verte et ne consomme aucun quota.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { construireDiagnostic } from '../../src/domain/diagnostic'
import { analyserImage } from '../../src/pipeline/analyse'
import type { ClientBrut } from '../../src/pipeline/client'
import { revoirFautesPeuSures } from '../../src/pipeline/revue'
import type { RequeteLLM, Transport } from '../../src/pipeline/llm'
import { chaineModeles, construireCorps } from '../../src/pipeline/llm'
import type { CodeErreur } from '../../src/domain/taxonomy'

const CLE = process.env.INFERHUB_API_KEY ?? ''
const AMONT = process.env.RATURE_AMONT ?? 'https://api.inferhub.dev/v1'
const MODELE = process.env.RATURE_MODELE ?? ''
const DELAI_APPEL_MS = 120_000

const transport: Transport = { proxy: `${AMONT}/chat/completions`, ...(MODELE ? { modele: MODELE } : {}) }

type EntreeManifeste = { fichier: string; dominant: CodeErreur | null; degradee: boolean }
const manifeste: { copies: EntreeManifeste[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../corpus/images/manifeste.json', import.meta.url)), 'utf8'),
)

// Sous-ensemble représentatif : 2 nettes, 1 dégradée, 1 propre, 1 ambiguë.
const CIBLES = ['copie-1-signes.png', 'copie-4-developpement.png', 'copie-8-grandeurs.png', 'copie-3-propre.png', 'copie-6-puissances-photo.png']

async function appeler(requete: RequeteLLM, modele: string): Promise<string> {
  const reponse = await fetch(`${AMONT}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CLE}` },
    body: JSON.stringify(construireCorps(requete, modele)),
    signal: AbortSignal.timeout(DELAI_APPEL_MS),
  })
  if (!reponse.ok) {
    throw Object.assign(new Error(`amont HTTP ${reponse.status}`), { statut: reponse.status })
  }
  const data = (await reponse.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

const TRANSITOIRES = new Set([402, 429, 500, 502, 503, 504])

const clientDirect: ClientBrut = async (requete: RequeteLLM) => {
  let derniere = 'aucun modèle disponible'
  for (const modele of chaineModeles(transport)) {
    try {
      return await appeler(requete, modele)
    } catch (erreur) {
      if (!TRANSITOIRES.has((erreur as { statut?: number }).statut ?? 0)) throw erreur
      derniere = (erreur as Error).message
    }
  }
  throw new Error(derniere)
}

function image(nom: string): string {
  const chemin = fileURLToPath(new URL(`../../corpus/images/${nom}`, import.meta.url))
  return `data:image/png;base64,${readFileSync(chemin).toString('base64')}`
}

describe.skipIf(!CLE)('nouveau chemin fusionné (lots 1+3)', () => {
  it('mesure précision et latence sur le sous-ensemble représentatif', async () => {
    let bons = 0
    let totalMs = 0
    for (const fichier of CIBLES) {
      const entree = manifeste.copies.find((c) => c.fichier === fichier)!
      const debut = Date.now()
      const { erreurs } = await analyserImage(image(fichier), transport, clientDirect)
      const revue = await revoirFautesPeuSures(erreurs, transport, clientDirect)
      const diagnostic = construireDiagnostic(revue.erreurs, { id: fichier, createdAt: new Date().toISOString() })
      const ms = Date.now() - debut
      totalMs += ms
      const ok = diagnostic.typeDominant === entree.dominant
      if (ok) bons += 1
      console.info(
        `[fusion:${fichier}] attendu=${entree.dominant ?? 'propre'} obtenu=${diagnostic.typeDominant ?? 'aucun'} ` +
          `fautes=${diagnostic.nbFautes} revues=${revue.revues} modifiées=${revue.modifiees} ${(ms / 1000).toFixed(1)}s`,
      )
    }
    const moyenne = totalMs / CIBLES.length / 1000
    console.info(`[fusion] précision=${bons}/${CIBLES.length} latence moyenne=${moyenne.toFixed(1)}s`)
    // Latence : cible < 25 s en moyenne (le chemin séparé mesurait 53-92 s).
    expect(moyenne).toBeLessThan(40)
  }, 30 * 60_000)
})