/**
 * Zoom et recadrage de la copie — lot 7. Logique **pure** (aucun DOM) pour être
 * testable en Node ; le composant ne fait qu'appliquer la transformation CSS.
 *
 * Convention : `transform: translate(x%, y%) scale(e)`. Les pourcentages de
 * translation sont relatifs à la taille NON mise à l'échelle de l'image, donc
 * un point en coordonnées relatives (cx, cy) se recentre en ramenant
 * x = (0,5 − cx) × e × 100, borné pour que l'image ne sorte jamais du cadre.
 */
import type { Zone } from '../../domain/types'

export type Vue = { echelle: number; x: number; y: number }

export const ECHELLE_MIN = 1
export const ECHELLE_MAX = 4
export const ECHELLE_CIBLE_ZONE = 2.5
export const PAS_ZOOM = 0.5

export function clamp(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur))
}

export function reinitialiser(): Vue {
  return { echelle: 1, x: 0, y: 0 }
}

/** Translation maximale (en %) pour que l'image remplisse toujours le cadre. */
function limite(echelle: number): number {
  return (echelle - 1) * 50
}

/** Ramène la vue dans le cadre : échelle bornée, translation bornée. */
export function borner(vue: Vue): Vue {
  const echelle = clamp(vue.echelle, ECHELLE_MIN, ECHELLE_MAX)
  const max = limite(echelle)
  return { echelle, x: clamp(vue.x, -max, max), y: clamp(vue.y, -max, max) }
}

/** Centre une zone (coordonnées relatives 0..1) à l'échelle cible. */
export function centrerSurZone(zone: Zone, echelleCible = ECHELLE_CIBLE_ZONE): Vue {
  const echelle = clamp(echelleCible, ECHELLE_MIN, ECHELLE_MAX)
  const cx = clamp(zone.x + zone.largeur / 2, 0, 1)
  const cy = clamp(zone.y + zone.hauteur / 2, 0, 1)
  return borner({ echelle, x: (0.5 - cx) * echelle * 100, y: (0.5 - cy) * echelle * 100 })
}

/** Zoom avant/arrière autour du centre, borné. */
export function zoomer(vue: Vue, delta: number): Vue {
  return borner({ ...vue, echelle: vue.echelle + delta })
}
