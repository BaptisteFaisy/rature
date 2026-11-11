import { describe, expect, it } from 'vitest'
import { creerQuota } from './_quota'

const T0 = 1_700_000_000_000
const HEURE = 60 * 60 * 1000

describe('quota du proxy', () => {
  it('autorise jusqu’au plafond par visiteur, puis refuse', () => {
    const quota = creerQuota({ parIpParHeure: 3, globalParJour: 100 })
    expect(quota.autoriser('a', T0)).toBe(true)
    expect(quota.autoriser('a', T0 + 1)).toBe(true)
    expect(quota.autoriser('a', T0 + 2)).toBe(true)
    expect(quota.autoriser('a', T0 + 3)).toBe(false)
    expect(quota.restant('a', T0 + 3)).toBe(0)
  })

  it('isole les visiteurs entre eux', () => {
    const quota = creerQuota({ parIpParHeure: 1, globalParJour: 100 })
    expect(quota.autoriser('a', T0)).toBe(true)
    expect(quota.autoriser('b', T0)).toBe(true)
    expect(quota.autoriser('a', T0)).toBe(false)
  })

  it('rouvre la fenêtre glissante après une heure', () => {
    const quota = creerQuota({ parIpParHeure: 1, globalParJour: 100 })
    expect(quota.autoriser('a', T0)).toBe(true)
    expect(quota.autoriser('a', T0 + HEURE + 1)).toBe(true)
  })

  it('applique le plafond global même sous le plafond individuel', () => {
    const quota = creerQuota({ parIpParHeure: 10, globalParJour: 2 })
    expect(quota.autoriser('a', T0)).toBe(true)
    expect(quota.autoriser('b', T0)).toBe(true)
    expect(quota.autoriser('c', T0)).toBe(false)
  })

  it('réinitialise le compteur global au changement de jour', () => {
    const quota = creerQuota({ parIpParHeure: 10, globalParJour: 1 })
    expect(quota.autoriser('a', T0)).toBe(true)
    expect(quota.autoriser('b', T0)).toBe(false)
    expect(quota.autoriser('b', T0 + 24 * HEURE + 1)).toBe(true)
  })

  it('un id inconnu dispose de tout son quota', () => {
    const quota = creerQuota({ parIpParHeure: 5, globalParJour: 50 })
    expect(quota.restant('inconnu', T0)).toBe(5)
  })
})
