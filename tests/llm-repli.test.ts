import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAINE_MODELES } from '../src/domain/config'
import { ErreurLLM, completer, transportParDefaut } from '../src/pipeline/llm'

/**
 * Le repli sur la chaîne de modèles est ce qui fait qu'une analyse aboutit un
 * soir où 5 modèles sur 6 sont sans capacité. Ces tests verrouillent aussi un
 * bug réel du 11 novembre : `throw` d'une fonction `async` sans `await` lançait
 * une **Promesse** — donc ni repli, ni message lisible (« Analyse impossible »).
 */

const transport = transportParDefaut('/api/test')
const requete = { system: 's', user: 'u' }

function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json' },
  })
}

function enregistrerAppels(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body).model as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('repli sur la chaîne de modèles', () => {
  it('un 503 fait passer au modèle suivant, qui répond', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reponse(503, { erreur: 'no available provider for A' }))
      .mockResolvedValueOnce(reponse(200, { texte: '{"annotations":[]}' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(completer(transport, requete)).resolves.toBe('{"annotations":[]}')
    const appels = enregistrerAppels(fetchMock)
    expect(appels).toHaveLength(2)
    expect(appels[0]).not.toBe(appels[1])
  })

  it('toute la chaîne indisponible → ErreurLLM avec le message réel de l’amont', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reponse(503, { erreur: 'no available provider (all offers exhausted)' }))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect(erreur).toBeInstanceOf(Error)
    expect((erreur as ErreurLLM).message).toContain('no available provider')
    expect(enregistrerAppels(fetchMock)).toHaveLength(CHAINE_MODELES.length)
  })

  it('429 du proxy (quota partagé) → remonte aussitôt avec le recours BYOK', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reponse(429, { erreur: 'Quota du proxy atteint pour cette heure.', quota: 'proxy' }))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).message).toContain('Colle ta propre clé')
    expect(enregistrerAppels(fetchMock)).toHaveLength(1)
  })

  it('429 du fournisseur → pause, même modèle, puis modèle suivant', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reponse(429, { erreur: 'Limite de débit du fournisseur.' }))
      .mockResolvedValueOnce(reponse(429, { erreur: 'Limite de débit du fournisseur.' }))
      .mockResolvedValueOnce(reponse(200, { texte: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(completer(transport, requete)).resolves.toBe('ok')
    const appels = enregistrerAppels(fetchMock)
    expect(appels).toHaveLength(3)
    expect(appels[0]).toBe(appels[1])
    expect(appels[2]).not.toBe(appels[0])
  }, 20_000)

  it('une erreur non transitoire (400) remonte immédiatement', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reponse(400, { erreur: 'corps invalide' }))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect((erreur as ErreurLLM).message).toContain('corps invalide')
    expect(enregistrerAppels(fetchMock)).toHaveLength(1)
  })
})
