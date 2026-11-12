/**
 * Crash test — pannes. Réseau coupé, proxy mort, amont saturé (503/402), quota
 * dépassé, corps de réponse invalide : le produit doit **dégradér proprement**,
 * c'est-à-dire lever une `ErreurLLM` lisible (jamais une `SyntaxError` ni une
 * Promesse), en un nombre d'appels borné, et sans boucle infinie.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAINE_MODELES } from '../../src/domain/config'
import { construireDiagnostic } from '../../src/domain/diagnostic'
import { agreger, profilVide, totalPondere } from '../../src/domain/profil'
import { clientSimule } from '../../src/pipeline/client'
import { genererExerciceVerifie } from '../../src/pipeline/exercise'
import { ErreurLLM, completer, transportParDefaut } from '../../src/pipeline/llm'
import { appliquerRevue, indicesASurveiller, revoirFautesPeuSures } from '../../src/pipeline/revue'
import type { Erreur } from '../../src/domain/types'
import { creerQuota } from '../../api/_quota'

const transport = transportParDefaut('https://proxy.test/analyze')
const requete = { system: 's', user: 'u' }

function reponseBrute(statut: number, corps: string): Response {
  return new Response(corps, { status: statut, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('crash test — pannes réseau et amont', () => {
  it('réseau coupé : un seul appel, ErreurLLM lisible (pas de boucle)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).message).toContain('Réseau indisponible')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('toute la chaîne saturée : exactement un appel par modèle, puis l’erreur réelle', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reponseBrute(503, '{"erreur":"no available provider"}'))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).message).toContain('no available provider')
    expect(fetchMock).toHaveBeenCalledTimes(CHAINE_MODELES.length)
  })

  it('panaches de pannes (503, 402, 500, 504) : on finit par aboutir', async () => {
    const statuts = [503, 402, 500, 504]
    let appel = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      const statut = statuts[appel] ?? 200
      appel += 1
      return statut === 200
        ? reponseBrute(200, '{"texte":"ok"}')
        : reponseBrute(statut, '{"erreur":"panne"}')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(completer(transport, requete)).resolves.toBe('ok')
    expect(appel).toBe(5)
  })

  it('quota du proxy : un seul appel, et le message propose le BYOK', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        reponseBrute(429, '{"erreur":"Quota du proxy atteint pour cette heure.","quota":"proxy"}'),
      )
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect((erreur as ErreurLLM).message).toContain('Colle ta propre clé')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('429 amont puis 503 partout : nombre d’appels borné (pas de tempête)', async () => {
    let appel = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      appel += 1
      return appel === 1 ? reponseBrute(429, '{"erreur":"rate limit"}') : reponseBrute(503, '{"erreur":"ko"}')
    })
    vi.stubGlobal('fetch', fetchMock)

    await completer(transport, requete).catch(() => undefined)
    // 1er modèle : 429 puis une seconde chance ; les 5 autres : 1 appel chacun.
    expect(appel).toBeLessThanOrEqual(CHAINE_MODELES.length + 1)
  }, 20_000)

  it('budget global : la chaîne s’arrête au lieu de faire attendre 9 minutes', async () => {
    // L'horloge avance de 90 s à chaque lecture : avec un budget de 200 s, la
    // chaîne doit s'arrêter avant d'avoir épuisé les six modèles.
    let maintenant = 1_700_000_000_000
    const horloge = vi.spyOn(Date, 'now').mockImplementation(() => {
      const valeur = maintenant
      maintenant += 90_000
      return valeur
    })
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => reponseBrute(503, '{"erreur":"no available provider"}'))
    vi.stubGlobal('fetch', fetchMock)

    const erreur = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurLLM)
    expect((erreur as ErreurLLM).message).toContain('trop de temps')
    // Le budget doit couper la chaîne avant la fin, quelles que soient les bornes.
    expect(fetchMock.mock.calls.length).toBeLessThan(CHAINE_MODELES.length)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
    horloge.mockRestore()
  })

  it('corps invalide ou vide : ErreurLLM, jamais une SyntaxError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response('<html>502 Bad Gateway</html>', { status: 200 })),
    )
    const erreurHtml = await completer(transport, requete).catch((e: unknown) => e)
    expect(erreurHtml).toBeInstanceOf(ErreurLLM)
    expect(erreurHtml).not.toBeInstanceOf(SyntaxError)

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => reponseBrute(200, '{"texte":"   "}')))
    const erreurVide = await completer(transport, requete).catch((e: unknown) => e)
    expect((erreurVide as ErreurLLM).message).toContain('vide')
  })

  it('génération d’exercice en panne : l’erreur remonte, elle n’est pas avalée', async () => {
    const client = clientSimule([]) // aucune réponse : lève dès le premier appel
    await expect(
      genererExerciceVerifie({ typeDominant: 'E01', extraitCopie: 'x', transport, client }),
    ).rejects.toThrow()
  })

  it('seconde passe : un verdict hostile ne corrompt pas la liste des fautes', async () => {
    const erreurs: Erreur[] = [
      { code: 'E01', libelle: 'l', ligne: 'a', explication: 'e', confiance: 0.7, ponderee: true },
      { code: 'E04', libelle: 'l', ligne: 'b', explication: 'e', confiance: 0.65, ponderee: true },
      { code: 'E06', libelle: 'l', ligne: 'c', explication: 'e', confiance: 0.95, ponderee: true },
    ]
    const indices = indicesASurveiller(erreurs)
    const verdictsPourris = [
      { index: 99, code: 'E12', confiance: 0.9, explication: 'hors liste', decision: 'reclasse' },
      { index: -3, code: 'E12', confiance: 0.9, explication: 'négatif', decision: 'reclasse' },
      { index: 0, code: 'PAS_UN_CODE', confiance: 5, explication: '', decision: 'x' },
    ]
    const { erreurs: revues } = appliquerRevue(erreurs, indices, verdictsPourris)
    expect(revues).toHaveLength(erreurs.length)
    // La faute hors revue (confiance 0,95) est intacte.
    expect(revues[2]).toEqual(erreurs[2])
    // Les index hors liste (99, -3) ne touchent rien.
    const touchees = revues.filter((erreur, index) => erreur.code !== erreurs[index]!.code)
    expect(touchees).toHaveLength(1)
    // Le code inconnu retombe sur E99, jamais sur une invention.
    expect(touchees[0]!.code).toBe('E99')
    expect(revues.every((erreur) => erreur.ligne.length > 0)).toBe(true)
  })

  it('seconde passe en panne : les fautes d’origine sont conservées telles quelles', async () => {
    const erreurs: Erreur[] = [
      { code: 'E01', libelle: 'l', ligne: 'a', explication: 'e', confiance: 0.7, ponderee: true },
    ]
    await expect(revoirFautesPeuSures(erreurs, transport, clientSimule([]))).rejects.toThrow()
    expect(erreurs[0]!.code).toBe('E01')
    expect(erreurs[0]!.confiance).toBe(0.7)
  })
})

describe('crash test — quota du proxy sous charge', () => {
  it('500 visiteurs × 40 appels : les plafonds tiennent, la mémoire reste bornée', () => {
    const quota = creerQuota({ parIpParHeure: 20, globalParJour: 2000 })
    const maintenant = 1_700_000_000_000
    let autorises = 0
    for (let visiteur = 0; visiteur < 500; visiteur += 1) {
      let accepts = 0
      for (let appel = 0; appel < 40; appel += 1) {
        if (quota.autoriser(`ip-${visiteur}`, maintenant + appel)) accepts += 1
      }
      expect(accepts, `visiteur ${visiteur} au-delà du plafond`).toBeLessThanOrEqual(20)
      autorises += accepts
    }
    expect(autorises).toBeLessThanOrEqual(2000)
    expect(quota.restant('ip-0', maintenant + 100)).toBe(0)
    expect(quota.restant('jamais-vu', maintenant + 100)).toBe(0) // plafond global atteint
  })

  it('aucun dépassement après bascule de jour', () => {
    const quota = creerQuota({ parIpParHeure: 2, globalParJour: 3 })
    const maintenant = 1_700_000_000_000
    expect(quota.autoriser('a', maintenant)).toBe(true)
    expect(quota.autoriser('b', maintenant)).toBe(true)
    expect(quota.autoriser('c', maintenant)).toBe(true)
    expect(quota.autoriser('d', maintenant)).toBe(false)
    expect(quota.autoriser('d', maintenant + 86_400_001)).toBe(true)
  })
})

describe('crash test — données corrompues en stockage local', () => {
  it('un diagnostic abîmé (erreurs à null) n’effondre pas l’agrégation', () => {
    const corrompu = {
      id: 'x',
      createdAt: 'date-invalide',
      matiere: 'maths' as const,
      nbFautes: 0,
      erreurs: null as unknown as Erreur[],
      typeDominant: null,
    }
    const avant = profilVide()
    const apres = agreger(avant, corrompu)
    // Le diagnostic illisible est ignoré, pas compté : le profil reste sain.
    expect(apres.totalAnalyses).toBe(0)
    expect(totalPondere(apres)).toBe(0)
  })

  it('un diagnostic sans champs tient debout', () => {
    const squelette = { erreurs: [] } as unknown as Parameters<typeof agreger>[1]
    expect(() => agreger(profilVide(), squelette)).not.toThrow()
  })

  it('construire un diagnostic sans aucune faute reste cohérent', () => {
    const diagnostic = construireDiagnostic([], { id: 'vide', createdAt: '2026-11-12T12:00:00.000Z' })
    expect(diagnostic.nbFautes).toBe(0)
    expect(diagnostic.erreurs).toEqual([])
    expect(diagnostic.typeDominant).toBeNull()
  })
})
