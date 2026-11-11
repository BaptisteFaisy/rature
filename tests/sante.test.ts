import { afterEach, describe, expect, it, vi } from 'vitest'
import { sonderProxy, urlSante } from '../src/pipeline/sante'

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

  it('proxy same-origin → inconnue, sans aucun appel réseau', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sonderProxy('/api/analyze')).resolves.toBe('inconnue')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})