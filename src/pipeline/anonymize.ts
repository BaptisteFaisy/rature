/**
 * Étape 2 — Anonymisation (RNF-P2) : le nom de l'élève est masqué AVANT tout
 * affichage. On pixelise le bandeau d'en-tête de la copie (là où le nom est
 * écrit dans la quasi-totalité des cas) plutôt que de le flouter : un flou se
 * laisse deviner, une pixelisation non.
 */
import type { Zone } from '../domain/types'

/** Bandeau supérieur centré : le nom est presque toujours en haut de la copie. */
export function zoneBandeau(): Zone {
  return { x: 0.18, y: 0.02, largeur: 0.64, hauteur: 0.16 }
}

function borne(valeur: number): number {
  return Math.min(1, Math.max(0, valeur))
}

/** Normalise une zone quelconque en coordonnées relatives valides. */
export function normaliserZone(zone: Zone): Zone {
  const x = borne(Math.min(zone.x, zone.x + zone.largeur))
  const y = borne(Math.min(zone.y, zone.y + zone.hauteur))
  const largeur = borne(Math.abs(zone.largeur))
  const hauteur = borne(Math.abs(zone.hauteur))
  return { x, y, largeur: Math.min(largeur, 1 - x), hauteur: Math.min(hauteur, 1 - y) }
}

async function chargerDepuisDataUrl(dataUrl: string): Promise<ImageBitmap> {
  const reponse = await fetch(dataUrl)
  return createImageBitmap(await reponse.blob())
}

/** Pixelise une zone : on réduit à quelques blocs puis on ré-agrandit sans lissage. */
function pixeliser(contexte: CanvasRenderingContext2D, zone: Zone, bloc: number): void {
  const x = Math.round(zone.x * contexte.canvas.width)
  const y = Math.round(zone.y * contexte.canvas.height)
  const largeur = Math.max(1, Math.round(zone.largeur * contexte.canvas.width))
  const hauteur = Math.max(1, Math.round(zone.hauteur * contexte.canvas.height))
  const petit = document.createElement('canvas')
  petit.width = Math.max(1, Math.floor(largeur / bloc))
  petit.height = Math.max(1, Math.floor(hauteur / bloc))
  const ctxPetit = petit.getContext('2d')
  if (!ctxPetit) return
  ctxPetit.drawImage(contexte.canvas, x, y, largeur, hauteur, 0, 0, petit.width, petit.height)
  contexte.imageSmoothingEnabled = false
  contexte.drawImage(petit, 0, 0, petit.width, petit.height, x, y, largeur, hauteur)
  contexte.imageSmoothingEnabled = true
}

export async function masquerNom(
  dataUrl: string,
  zone?: Zone,
): Promise<{ dataUrl: string; zoneMasquee: Zone | null }> {
  const cible = normaliserZone(zone ?? zoneBandeau())
  const bitmap = await chargerDepuisDataUrl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const contexte = canvas.getContext('2d')
  if (!contexte) return { dataUrl, zoneMasquee: null }

  contexte.drawImage(bitmap, 0, 0)
  bitmap.close()
  pixeliser(contexte, cible, 12)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), zoneMasquee: cible }
}
