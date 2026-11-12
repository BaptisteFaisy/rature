/**
 * Banc de validation live — appelle le VRAI modèle via InferHub sur tout le
 * corpus (`corpus/images/` + `manifeste.json`, générés par
 * `scripts/generer-copies.py`).
 *
 * Ignoré sans clé : la CI reste verte et ne consomme aucun quota.
 *
 *   INFERHUB_API_KEY=… npx vitest run tests/live/inferhub.test.ts
 *
 * Trois mesures, celles du go / no-go (§22 jour 1) :
 *  - RNF-03 : ≥ 80 % de dominants corrects sur les copies nettes ;
 *  - robustesse : les copies dégradées (rotation, lumière, bruit) tiennent ;
 *  - RNF-04 : **zéro** faute sur une copie sans annotation.
 *
 * Limite assumée : images synthétiques. Le manuscrit réel reste à valider avec
 * de vraies photos (protocole dans `corpus/README.md`).
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
import type { CodeErreur } from '../../src/domain/taxonomy'

const CLE = process.env.INFERHUB_API_KEY ?? ''
const AMONT = process.env.RATURE_AMONT ?? 'https://api.inferhub.dev/v1'
const MODELE = process.env.RATURE_MODELE ?? ''
const DELAI_APPEL_MS = 120_000
const DELAI_JEU_MS = 20 * 60_000

const transport: Transport = { proxy: `${AMONT}/chat/completions`, ...(MODELE ? { modele: MODELE } : {}) }

type EntreeManifeste = { fichier: string; dominant: CodeErreur | null; degradee: boolean }
const manifeste: { copies: EntreeManifeste[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../corpus/images/manifeste.json', import.meta.url)), 'utf8'),
)

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

const TRANSITOIRES = new Set([402, 500, 502, 503, 504, 429])

/** Même chaîne de repli que le produit : un modèle sans capacité n'arrête pas le banc. */
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

type Mesure = { fichier: string; attendu: CodeErreur | null; obtenu: CodeErreur | null; fautes: number; ms: number }

async function mesurer(entree: EntreeManifeste): Promise<Mesure> {
  const debut = Date.now()
  const extraction = await extraireAnnotations(image(entree.fichier), transport, clientDirect)
  const erreurs = await classerAnnotations(extraction, transport, clientDirect)
  const diagnostic = construireDiagnostic(erreurs, { id: entree.fichier, createdAt: new Date().toISOString() })
  return {
    fichier: entree.fichier,
    attendu: entree.dominant,
    obtenu: diagnostic.typeDominant,
    fautes: diagnostic.nbFautes,
    ms: Date.now() - debut,
  }
}

async function mesurerToutes(cibles: EntreeManifeste[]): Promise<Mesure[]> {
  const mesures: Mesure[] = []
  for (const entree of cibles) {
    const mesure = await mesurer(entree)
    mesures.push(mesure)
    console.info(
      `[${mesure.fichier}] attendu=${mesure.attendu ?? 'propre'} obtenu=${mesure.obtenu ?? 'aucun'} ` +
        `fautes=${mesure.fautes} ${(mesure.ms / 1000).toFixed(1)}s`,
    )
  }
  return mesures
}

function taux(mesures: Mesure[]): number {
  if (mesures.length === 0) return 0
  return mesures.filter((m) => m.obtenu === m.attendu).length / mesures.length
}

describe.skipIf(!CLE)('validation live du modèle (InferHub)', () => {
  const nettes = manifeste.copies.filter((c) => !c.degradee && c.dominant !== null)
  const propres = manifeste.copies.filter((c) => c.dominant === null)
  const degradees = manifeste.copies.filter((c) => c.degradee && c.dominant !== null)

  it(
    'RNF-03 : au moins 80 % de dominants corrects sur les copies nettes',
    async () => {
      const mesures = await mesurerToutes(nettes)
      const precision = taux(mesures)
      console.info(`[RNF-03] nettes : ${(precision * 100).toFixed(0)} % (${mesures.filter((m) => m.obtenu === m.attendu).length}/${mesures.length})`)
      expect(precision).toBeGreaterThanOrEqual(0.8)
    },
    DELAI_JEU_MS,
  )

  it(
    'RNF-04 : zéro faute sur les copies propres, nette et dégradée',
    async () => {
      const mesures = await mesurerToutes(propres)
      for (const mesure of mesures) {
        expect(mesure.fautes, `${mesure.fichier} : faute inventée`).toBe(0)
      }
    },
    DELAI_JEU_MS,
  )

  it(
    'robustesse : les copies dégradées (photo téléphone) gardent le bon dominant',
    async () => {
      const mesures = await mesurerToutes(degradees)
      const precision = taux(mesures)
      console.info(`[robustesse] dégradées : ${(precision * 100).toFixed(0)} %`)
      expect(precision).toBeGreaterThanOrEqual(0.5)
    },
    DELAI_JEU_MS,
  )
})
