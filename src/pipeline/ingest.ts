/**
 * Étape 1 — Ingest : fichier photo → image normalisée (redimensionnée,
 * contraste étiré). Objectif < 300 ms et un poids d'envoi raisonnable.
 *
 * Aucune écriture disque, aucun envoi réseau ici : l'image vit en mémoire
 * jusqu'à l'étape d'extraction, puis est oubliée (RNF-P1).
 */
import { LARGEUR_CIBLE_IMAGE, TAILLE_MAX_IMAGE_OCTETS } from '../domain/config'
import { ErreurLLM } from './llm'

export type ImageNormalisee = { dataUrl: string; largeur: number; hauteur: number }

export type OptionsIngest = { largeurCible?: number; qualite?: number; contraste?: boolean }

const TAILLE_MAX_MO = Math.round(TAILLE_MAX_IMAGE_OCTETS / (1024 * 1024))

export function verifierTaille(octets: number): void {
  if (octets > TAILLE_MAX_IMAGE_OCTETS) {
    throw new ErreurLLM(
      `Photo trop lourde (max ${TAILLE_MAX_MO} Mo). Reprends-la en qualité normale.`,
      413,
    )
  }
  if (octets === 0) throw new ErreurLLM('Fichier vide : choisis une photo de ta copie.', 400)
}

/** Réduit la largeur à la cible en gardant les proportions (jamais d'agrandissement). */
export function calculerDimensions(
  largeur: number,
  hauteur: number,
  cible: number,
): { largeur: number; hauteur: number } {
  if (largeur <= cible) return { largeur, hauteur }
  const ratio = cible / largeur
  return { largeur: cible, hauteur: Math.max(1, Math.round(hauteur * ratio)) }
}

/**
 * Étirement des niveaux sur la plage [bas, haut] des luminances (2 % / 98 %) :
 * une photo de copie prise au téléphone est souvent terne, ce qui noie le
 * crayon du professeur. Opération en place sur les pixels RGBA.
 */
export function etirerNiveaux(donnees: Uint8ClampedArray): void {
  const histogramme = new Uint32Array(256)
  for (let i = 0; i < donnees.length; i += 4) {
    const lum = Math.round(0.299 * donnees[i]! + 0.587 * donnees[i + 1]! + 0.114 * donnees[i + 2]!)
    histogramme[lum]! += 1
  }
  const total = donnees.length / 4
  const bas = percentile(histogramme, total, 0.02)
  const haut = percentile(histogramme, total, 0.98)
  if (haut - bas < 16) return // image déjà contrastée ou uniforme : ne rien casser
  const facteur = 255 / (haut - bas)
  for (let i = 0; i < donnees.length; i += 4) {
    donnees[i] = (donnees[i]! - bas) * facteur
    donnees[i + 1] = (donnees[i + 1]! - bas) * facteur
    donnees[i + 2] = (donnees[i + 2]! - bas) * facteur
  }
}

/** Indice de luminance sous lequel se trouve la fraction `part` des pixels. */
function percentile(histogramme: Uint32Array, total: number, part: number): number {
  const seuil = total * part
  let cumul = 0
  for (let niveau = 0; niveau < histogramme.length; niveau += 1) {
    cumul += histogramme[niveau]!
    if (cumul >= seuil) return niveau
  }
  return 0
}

async function chargerBitmap(fichier: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(fichier)
  } catch {
    throw new ErreurLLM('Image illisible : réessaie avec une photo JPG ou PNG.', 415)
  }
}

export async function normaliserImage(
  fichier: File,
  options: OptionsIngest = {},
): Promise<ImageNormalisee> {
  verifierTaille(fichier.size)
  const bitmap = await chargerBitmap(fichier)
  const { largeur, hauteur } = calculerDimensions(
    bitmap.width,
    bitmap.height,
    options.largeurCible ?? LARGEUR_CIBLE_IMAGE,
  )

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const contexte = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexte) throw new ErreurLLM('Canvas indisponible dans ce navigateur.', 500)

  contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()

  if (options.contraste !== false) {
    const image = contexte.getImageData(0, 0, largeur, hauteur)
    etirerNiveaux(image.data)
    contexte.putImageData(image, 0, 0)
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', options.qualite ?? 0.85),
    largeur,
    hauteur,
  }
}
