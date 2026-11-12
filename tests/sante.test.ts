import { afterEach, describe, expect, it, vi } from 'vitest'
import { reordonner, sonderModeles, sonderProxy, urlSante } from '../src/pipeline/sante'
import { controleBanque, controleBudget, controleTaxonomie } from '../src/pipeline/diagnostic'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sonde du proxy (lot 2)', () => {
  it('remplace /analyze par /health, sans casser une origine simple', () => {
    expect(urlSante('https://h.modal.run/analyze')).toBe('https://h.modal.run/health')
    expect(urlSante('https://h.modal.run/analyze/')).toBe('https://h.modal.run/health')
    expect(urlSante('https://h.modal.run')).toBe('https://h.modal.run/health')
  })

  it('200 → ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))
    await expect(sonderProxy('https://h.modal.run/analyze')).resolves.toBe('ok')
  })

  it('503 → ko', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })))
    await expect(sonderProxy('https://h.modal.run/analyze')).resolves.toBe('ko')
  })

  it('erreur réseau → ko', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')))
    await expect(sonderProxy('https://h.modal.run/analyze')).resolves.toBe('ko')
  })

  it('proxy same-origin ou adresse vide → inconnue, sans aucun appel réseau', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sonderProxy('/api/analyze')).resolves.toBe('inconnue')
    await expect(sonderProxy('')).resolves.toBe('inconnue')
    await expect(sonderProxy('/health')).resolves.toBe('inconnue')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('une adresse absolue est sondable, y compris l’adresse par défaut injectée au build', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sonderProxy('https://proxy.exemple.run/analyze')).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.exemple.run/health')
  })
})
describe('sonde de disponibilité des modèles (idée 5)', () => {
  it('place les modèles vivants devant, sans changer leur ordre relatif', () => {
    const ordre = reordonner({
      chaine: ['a', 'b', 'c', 'd'],
      disjoncteur: { b: 42, d: 7 },
    })
    expect(ordre).toEqual(['a', 'c', 'b', 'd'])
  })

  it('chaîne vide ou absente → null (on garde la chaîne par défaut)', () => {
    expect(reordonner({ chaine: [], disjoncteur: {} })).toBeNull()
    expect(reordonner({ chaine: ['a'], disjoncteur: null as unknown as Record<string, number> })).toEqual(['a'])
  })

  it('lit le disjoncteur du proxy et rend la chaîne réordonnée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ chaine: ['m1', 'm2', 'm3'], disjoncteur: { m1: 30 } }), {
          status: 200,
        }),
      ),
    )
    await expect(sonderModeles('https://h.modal.run/analyze')).resolves.toEqual(['m2', 'm3', 'm1'])
  })

  it('proxy injoignable ou same-origin → null, jamais d’exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('ko')))
    await expect(sonderModeles('https://h.modal.run/analyze')).resolves.toBeNull()
    await expect(sonderModeles('/api/analyze')).resolves.toBeNull()
  })
})

describe('auto-vérification (preuves par sous-système)', () => {
  it('la banque est jugée complète seulement si les 12 types ont 3 exercices', () => {
    const controle = controleBanque()
    expect(controle.ok).toBe(true)
    expect(controle.preuve).toContain('36 exercices')
    expect(controle.preuve).toContain('0 appel réseau')
  })

  it('la taxonomie et le budget d’attente sont vérifiés par des faits', () => {
    expect(controleTaxonomie().ok).toBe(true)
    expect(controleTaxonomie().preuve).toContain('12 codes')
    expect(controleBudget().ok).toBe(true)
    expect(controleBudget().preuve).toMatch(/\d+ s par appel/)
  })
})
