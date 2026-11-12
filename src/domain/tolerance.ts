/**
 * Tolérance d'entrée — crash test du 12/11.
 *
 * Un modèle tiers peut rendre n'importe quoi. Règle retenue : **borner et
 * assainir, jamais rejeter en bloc**. Avant ce module, une seule annotation
 * malformée (zone avec `NaN`) faisait échouer le parsing de toute la réponse,
 * donc perdre une copie entière pour un détail. Chaque valeur est maintenant
 * assainie individuellement, et les listes/textes sont plafonnés pour que l'UI
 * ne puisse pas geler.
 */
import { MAX_LONGUEUR_LIGNE, MAX_LONGUEUR_TEXTE } from './config'
import type { Zone } from './types'

export function borne01(valeur: number): number {
  return Math.min(1, Math.max(0, valeur))
}

/** Tronque proprement, en signalant la coupure. */
export function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte
  return `${texte.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function texteAssaini(valeur: unknown, repli: string, max = MAX_LONGUEUR_TEXTE): string {
  if (typeof valeur !== 'string') return repli
  const propre = valeur.trim()
  return propre.length === 0 ? repli : tronquer(propre, max)
}

export function texteOptionnelAssaini(valeur: unknown): string | undefined {
  if (typeof valeur !== 'string') return undefined
  const propre = valeur.trim()
  return propre.length === 0 ? undefined : tronquer(propre, MAX_LONGUEUR_LIGNE)
}

export function nombreAssaini(valeur: unknown, repli = 0): number {
  const nombre = typeof valeur === 'string' ? Number(valeur) : valeur
  return typeof nombre === 'number' && Number.isFinite(nombre) ? nombre : repli
}

/** Confiance bornée à [0,1] ; toute valeur absurde retombe sur 0. */
export function confianceAssainie(valeur: unknown): number {
  return borne01(nombreAssaini(valeur, 0))
}

/**
 * Zone assainie : nombres finis uniquement, ramenés dans [0,1], largeur et
 * hauteur positives et contenues dans l'image. Rend `undefined` si la zone est
 * inutilisable — l'annotation reste valable, seule la surbrillance est perdue.
 */
export function zoneAssainie(valeur: unknown): Zone | undefined {
  if (typeof valeur !== 'object' || valeur === null) return undefined
  const brute = valeur as Record<string, unknown>
  const x = nombreAssaini(brute.x, Number.NaN)
  const y = nombreAssaini(brute.y, Number.NaN)
  const largeur = nombreAssaini(brute.largeur, Number.NaN)
  const hauteur = nombreAssaini(brute.hauteur, Number.NaN)
  if (![x, y, largeur, hauteur].every((v) => Number.isFinite(v))) return undefined

  const xBorne = borne01(Math.min(x, x + largeur))
  const yBorne = borne01(Math.min(y, y + hauteur))
  const largeurBornee = Math.min(borne01(Math.abs(largeur)), 1 - xBorne)
  const hauteurBornee = Math.min(borne01(Math.abs(hauteur)), 1 - yBorne)
  if (largeurBornee <= 0 || hauteurBornee <= 0) return undefined
  return { x: xBorne, y: yBorne, largeur: largeurBornee, hauteur: hauteurBornee }
}

/**
 * Interprète une liste élément par élément : un élément inutilisable est écarté,
 * il ne fait pas échouer toute la réponse.
 */
export function listeTolerante<T>(valeur: unknown, interpreter: (item: unknown) => T | null): T[] {
  if (!Array.isArray(valeur)) return []
  const resultat: T[] = []
  for (const item of valeur) {
    const interprete = interpreter(item)
    if (interprete !== null && interprete !== undefined) resultat.push(interprete)
  }
  return resultat
}

/** Plafonne une liste : au-delà, on garde le début (l'UI le signale). */
export function plafonner<T>(liste: T[], max: number): T[] {
  return liste.length <= max ? liste : liste.slice(0, max)
}
