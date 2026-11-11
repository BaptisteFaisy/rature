/**
 * Exports (RF-21 CSV du profil, RF-22 fiche de révision Markdown).
 * Logique pure : aucune dépendance au DOM, testée dans `tests/export.test.ts`.
 */
import { libelleDe } from '../domain/taxonomy'
import { classement, phraseSynthese, pourcentage, typeDominant } from '../domain/profil'
import type { Diagnostic, Profil } from '../domain/types'

function csvCell(valeur: string | number): string {
  const texte = String(valeur)
  return /[",\n;]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/** Profil → CSV (séparateur `;`, attendu par les tableurs francophones). */
export function profilEnCsv(profil: Profil): string {
  const lignes: string[] = ['code,libelle,occurrences,part_pourcent']
  for (const entree of classement(profil)) {
    lignes.push(
      [
        csvCell(entree.code),
        csvCell(libelleDe(entree.code)),
        csvCell(entree.n),
        csvCell(pourcentage(entree.part)),
      ].join(','),
    )
  }
  lignes.push(`total,,${classement(profil).reduce((s, e) => s + e.n, 0)},100`)
  return lignes.join('\n')
}

/** Fiche de révision Markdown : le type dominant, ce qu'il veut dire, 3 conseils. */
export function ficheEnMarkdown(profil: Profil, diagnostics: Diagnostic[]): string {
  const dominant = typeDominant(profil)
  const date = new Date().toISOString().slice(0, 10)
  const lignes: string[] = [`# Ma fiche Raturé — ${date}`, '']

  if (!dominant) {
    lignes.push('Aucune erreur récurrente pour le moment. Ajoute une copie corrigée.')
    return lignes.join('\n')
  }

  lignes.push(
    `**${phraseSynthese(profil)}.**`,
    '',
    `Type dominant : \`${dominant}\` — ${libelleDe(dominant)}.`,
    '',
    '## Ce que je dois travailler',
    '',
  )
  for (const entree of classement(profil).slice(0, 3)) {
    lignes.push(`- **${libelleDe(entree.code)}** — ${entree.n} occurrence(s), ${pourcentage(entree.part)} % de tes erreurs.`)
  }

  lignes.push('', '## Mes dernières copies', '')
  for (const diagnostic of diagnostics.slice(-5).reverse()) {
    const types = diagnostic.erreurs.map((e) => libelleDe(e.code)).join(', ')
    lignes.push(`- ${diagnostic.createdAt.slice(0, 10)} — ${diagnostic.nbFautes} faute(s) : ${types || 'aucune'}`)
  }

  lignes.push('', '_Généré localement par Raturé. Aucune copie n’est conservée._')
  return lignes.join('\n')
}

export function nomFichierDate(prefixe: string, extension: string): string {
  const iso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefixe}-${iso}.${extension}`
}
