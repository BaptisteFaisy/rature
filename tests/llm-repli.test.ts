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

  it('le proxy a épuisé sa chaîne → un seul appel, on ne rejoue pas la nôtre', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        reponse(503, { erreur: 'no available provider', chaineEpuisee: true, tentatives: 6 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).chaineEpuisee).toBe(true)
    expect(enregistrerAppels(fetchMock)).toHaveLength(1)
  })

  it('le modèle qui a réellement répondu est remonté au transport', async () => {
    const vus: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => reponse(200, { texte: 'ok', modele: 'ag/gemini-4-carbon', tentatives: 2 })),
    )
    await completer({ ...transport, surModele: (modele) => vus.push(modele) }, requete)
    expect(vus).toEqual(['ag/gemini-4-carbon'])
  })

  it('en flux (SSE) : la progression est relayée et le texte final rendu', async () => {
    const flux = new ReadableStream({
      start(controleur) {
        controleur.enqueue(
          new TextEncoder().encode(
            'event: progres\ndata: {"modele":"ag/gemini-4-carbon","statut":503,"essai":1}\n\n',
          ),
        )
        controleur.enqueue(
          new TextEncoder().encode(
            'event: resultat\ndata: {"texte":"ok","modele":"ag/claude-sonnet-4-6","tentatives":2}\n\n',
          ),
        )
        controleur.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(flux, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    )
    const progres: string[] = []
    const modeles: string[] = []
    const reponse = await completer(
      { ...transport, stream: true, surProgres: (m) => progres.push(m), surModele: (m) => modeles.push(m) },
      requete,
    )
    expect(reponse).toBe('ok')
    expect(progres.join(' ')).toContain('essai 1')
    expect(modeles).toEqual(['ag/claude-sonnet-4-6'])
  })

  it('en flux : un événement erreur remonte comme une ErreurLLM', async () => {
    const flux = new ReadableStream({
      start(controleur) {
        controleur.enqueue(
          new TextEncoder().encode('event: erreur\ndata: {"erreur":"aucun modèle","statut":503}\n\n'),
        )
        controleur.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(flux, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    )
    const erreur = await completer({ ...transport, stream: true }, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).chaineEpuisee).toBe(true)
  })

  it('un proxy qui ne parle pas SSE retombe sur le chemin JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ texte: 'json', modele: 'ag/gemini-4-carbon' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(completer({ ...transport, stream: true }, requete)).resolves.toBe('json')
  })

  it('une erreur non transitoire (400) remonte immédiatement', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reponse(400, { erreur: 'corps invalide' }))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect((erreur as ErreurLLM).message).toContain('corps invalide')
    expect(enregistrerAppels(fetchMock)).toHaveLength(1)
  })
})
