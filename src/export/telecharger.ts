import { nomFichierDate } from './exports'

/**
 * Téléchargement côté navigateur : un Blob, un lien éphémère, puis on le
 * retire du DOM (sinon les téléchargements successifs s'empilent en mémoire).
 */
export function telecharger(contenu: string, nom: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([contenu], { type })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(url)
}

export function telechargerCsv(contenu: string, prefixe = 'rature-profil'): void {
  telecharger(contenu, nomFichierDate(prefixe, 'csv'), 'text/csv;charset=utf-8')
}

export function telechargerMarkdown(contenu: string, prefixe = 'rature-fiche'): void {
  telecharger(contenu, nomFichierDate(prefixe, 'md'), 'text/markdown;charset=utf-8')
}
