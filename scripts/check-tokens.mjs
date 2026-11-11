#!/usr/bin/env node
/**
 * Garde de taille (règle user 2026-10-24) : fichiers < 500 lignes,
 * fonctions < 50 lignes. Un fichier qui grossit se découpe, il ne s'accepte pas.
 *
 * Usage : node scripts/check-tokens.mjs [--strict]
 *   défaut  : échoue (exit 1) sur un fichier > 500 lignes ; les fonctions
 *             longues sont signalées en avertissement ;
 *   --strict: échoue aussi sur les fonctions > 50 lignes.
 *
 * Le comptage des fonctions est une heuristique par accolades (pas d'analyseur) :
 * les accolades écrites dans des chaînes faussent la mesure, d'où le mode
 * avertissement par défaut.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RACINE = process.cwd()
const IGNORES = new Set(['node_modules', 'dist', '.git', '.github', 'corpus', 'coverage', '.vercel'])
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js'])
const LIMITE_FICHIER = 500
const LIMITE_FONCTION = 50
const strict = process.argv.includes('--strict')

function fichiers(dir) {
  const trouves = []
  for (const entree of readdirSync(dir)) {
    if (IGNORES.has(entree)) continue
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin))
    else if (EXTENSIONS.has(entree.slice(entree.lastIndexOf('.')))) trouves.push(chemin)
  }
  return trouves
}

function fonctionsLongues(lignes) {
  const longues = []
  for (let i = 0; i < lignes.length; i += 1) {
    const motif = lignes[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/)
    if (!motif) continue
    let profondeur = 0
    let ouverte = false
    for (let j = i; j < lignes.length; j += 1) {
      for (const caractere of lignes[j]) {
        if (caractere === '{') {
          profondeur += 1
          ouverte = true
        } else if (caractere === '}') profondeur -= 1
      }
      if (ouverte && profondeur <= 0) {
        const taille = j - i + 1
        if (taille > LIMITE_FONCTION) longues.push({ nom: motif[1], ligne: i + 1, taille })
        break
      }
    }
  }
  return longues
}

const cibles = fichiers(RACINE).sort()
const tropGros = []
const longues = []

for (const chemin of cibles) {
  const lignes = readFileSync(chemin, 'utf8').split('\n')
  const relatif = relative(RACINE, chemin)
  if (lignes.length > LIMITE_FICHIER) tropGros.push({ relatif, taille: lignes.length })
  for (const fonction of fonctionsLongues(lignes)) longues.push({ ...fonction, relatif })
}

console.log(
  `${cibles.length} fichier(s) contrôlé(s) — limite ${LIMITE_FICHIER} lignes/fichier, ${LIMITE_FONCTION} lignes/fonction`,
)
for (const fichier of tropGros) {
  console.log(`::error::${fichier.relatif} : ${fichier.taille} lignes (> ${LIMITE_FICHIER}) — à découper`)
}
for (const fonction of longues) {
  const marqueur = strict ? '::error::' : '::warning::'
  console.log(`${marqueur}${fonction.relatif}:${fonction.ligne} function ${fonction.nom} : ${fonction.taille} lignes`)
}

const echec = tropGros.length > 0 || (strict && longues.length > 0)
console.log(
  echec
    ? `REFUS : ${tropGros.length} fichier(s) et ${longues.length} fonction(s) hors limite`
    : `OK : ${longues.length} fonction(s) signalée(s), aucun fichier hors limite`,
)
process.exit(echec ? 1 : 0)
