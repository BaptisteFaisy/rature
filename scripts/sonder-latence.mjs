#!/usr/bin/env node
/**
 * Banc de latence horaire — idée 10 du brassage « rester sur InferHub ».
 *
 * Mesure la disponibilité et la latence de chaque modèle de la chaîne, et met
 * à jour `docs/LATENCE.md` (tableau horodaté + synthèse sur 24 h).
 *
 * Pourquoi : l'amont est une place de marché. La latence varie d'un facteur 3
 * entre le soir et 13 h, et 5 modèles sur 6 peuvent être en 503 au même
 * instant. Sans relevé automatique, on choisirait l'heure du tournage à
 * l'intuition — et on ne pourrait pas prouver la disponibilité pendant le
 * jugement (RNF-08).
 *
 * Usage :
 *   INFERHUB_API_KEY=… node scripts/sonder-latence.mjs
 *   node scripts/sonder-latence.mjs --modeles a,b --timeout-ms 90000 --sortie docs/LATENCE.md
 *   node scripts/sonder-latence.mjs --seche     # n'écrit rien (utile sans clé)
 *
 * Sans clé, le script avertit et sort en 0 : il ne doit jamais casser une CI.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { argv, env, exit } from 'node:process'

const CHAINE = [
  'ag/gemini-4-carbon',
  'ag/claude-sonnet-4-6',
  'ag/gemini-4-argon',
  'ag/claude-sonnet-5-5',
  'ag/gemini-3.8-flash-high',
  'zai/glm-4.6v',
  'ag/claude-opus-4-6-thinking',
]

const AMONT = 'https://api.inferhub.dev/v1'
const LIGNES_MAX = 300

function argument(nom, defaut) {
  const index = argv.indexOf(`--${nom}`)
  return index >= 0 && argv[index + 1] ? argv[index + 1] : defaut
}

function drapeaux() {
  return {
    seche: argv.includes('--seche'),
    modeles: String(argument('modeles', '')).split(',').filter(Boolean),
    timeoutMs: Number(argument('timeout-ms', '90000')),
    sortie: String(argument('sortie', 'docs/LATENCE.md')),
  }
}

/** Un appel texte minimal : 5 tokens suffisent pour mesurer la disponibilité. */
async function sonder(modele, cle, timeoutMs) {
  const debut = Date.now()
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs)
  try {
    const reponse = await fetch(`${AMONT}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: modele,
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 5,
      }),
      signal: controleur.signal,
    })
    const secondes = ((Date.now() - debut) / 1000).toFixed(1)
    if (reponse.ok) {
      const data = await reponse.json().catch(() => ({}))
      const texte = data?.choices?.[0]?.message?.content ?? ''
      return { statut: reponse.status, secondes, dispo: texte.trim().length > 0 }
    }
    const corps = (await reponse.text().catch(() => '')).slice(0, 120)
    return { statut: reponse.status, secondes, dispo: false, note: corps }
  } catch (erreur) {
    const secondes = ((Date.now() - debut) / 1000).toFixed(1)
    const timeout = erreur?.name === 'AbortError'
    return { statut: timeout ? 'timeout' : 'reseau', secondes, dispo: false }
  } finally {
    clearTimeout(minuteur)
  }
}

/** Médiane sur une liste de nombres. */
function mediane(valeurs) {
  if (valeurs.length === 0) return null
  const triees = [...valeurs].sort((a, b) => a - b)
  const milieu = Math.floor(triees.length / 2)
  return triees.length % 2 === 0 ? (triees[milieu - 1] + triees[milieu]) / 2 : triees[milieu]
}

function analyserLignes(lignes) {
  const vingtQuatreHeures = Date.now() - 24 * 3600 * 1000
  const recentes = lignes.filter((ligne) => Date.parse(ligne.horodatage) >= vingtQuatreHeures)
  const succes = recentes.filter((ligne) => ligne.dispo)
  const latences = succes.map((ligne) => Number(ligne.secondes)).filter((n) => Number.isFinite(n))
  const parModele = new Map()
  for (const ligne of recentes) {
    const total = parModele.get(ligne.modele) ?? { ok: 0, total: 0 }
    total.total += 1
    if (ligne.dispo) total.ok += 1
    parModele.set(ligne.modele, total)
  }
  const classement = [...parModele.entries()]
    .filter(([, stats]) => stats.total > 0)
    .sort((a, b) => b[1].ok / b[1].total - a[1].ok / a[1].total)
  const meilleur = classement[0]
  return {
    total: recentes.length,
    taux: recentes.length === 0 ? 0 : (succes.length / recentes.length) * 100,
    mediane: mediane(latences),
    meilleur: meilleur ? `${meilleur[0]} (${Math.round((meilleur[1].ok / meilleur[1].total) * 100)} % de réussite sur 24 h)` : '—',
  }
}

function rendreFichier(lignes, synthese) {
  const entete = [
    '# Latence de l’amont (relevé automatique)',
    '',
    'Mesuré par `scripts/sonder-latence.mjs`, lancé chaque heure par `.github/workflows/latence.yml`.',
    'Un **seconde** par appel, en série : on ne lance pas de rafale, qui fausserait la mesure et',
    'saturerait l’amont.',
    '',
    'Ce relevé sert à trois choses : choisir l’heure du tournage de la vidéo sur des données, prouver',
    'la disponibilité pendant le jugement (RNF-08), et documenter honnêtement la contrainte',
    '(l’amont est une place de marché : la latence varie d’un facteur 3 selon l’heure).',
    '',
    '> Le fichier est versionné sur la branche `donnees/latence` : `main` est protégé par un',
    '> ruleset (PR obligatoire), un push automatique y serait refusé.',
    '',
    '## Synthèse sur 24 h',
    '',
    `- Mesures : **${synthese.total}**`,
    `- Taux de disponibilité : **${synthese.taux.toFixed(0)} %**`,
    `- Latence médiane des appels réussis : **${synthese.mediane === null ? '—' : `${synthese.mediane.toFixed(1)} s`}**`,
    `- Modèle le plus fiable : **${synthese.meilleur}**`,
    '',
    '## Historique',
    '',
    '| Horodatage (UTC) | Modèle | HTTP | Latence | Disponible |',
    '| --- | --- | --- | --- | --- |',
  ]
  const corps = lignes.map(
    (ligne) =>
      `| ${ligne.horodatage} | \`${ligne.modele}\` | ${ligne.statut} | ${ligne.secondes} s | ${ligne.dispo ? 'oui' : 'non'} |`,
  )
  const annexe = [
    '',
    '## Relevés manuels antérieurs au banc automatique',
    '',
    '| Date | Modèle | Résultat |',
    '| --- | --- | --- |',
    '| 11/11 21 h | `ag/gemini-4-carbon` | 200 en 16 s |',
    '| 11/11 21 h | `ag/claude-sonnet-4-6` | 200 en 16 s, puis 503 cinq minutes plus tard |',
    '| 11/11 21 h | `ag/gemini-3.8-flash-high` | 200 en 45-52 s |',
    '| 11/11 21 h | `ag/gemini-4-argon`, `ag/claude-sonnet-5-5`, `ag/claude-opus-4-6-thinking` | 503 |',
    '| 11/11 21 h | `oai/gpt-5.4-mini`, `ali/deepseek-v4.1-flash` | 402 hors enchère |',
    '| 11/11 21 h | `cbcn/glm-5.3-flash` | 403 désactivé dans les préférences du compte |',
    '| 12/11 13 h | `ag/gemini-3.8-flash-high` | 200 en 56,7 s (5 tokens) |',
    '| 12/11 13 h | `ag/gemini-4-carbon` | 503 |',
    '',
  ]
  return `${[...entete, ...corps, ...annexe].join('\n')}\n`
}

async function main() {
  const options = drapeaux()
  const cle = env.INFERHUB_API_KEY ?? ''
  const modeles = options.modeles.length > 0 ? options.modeles : CHAINE

  if (!cle) {
    console.warn('INFERHUB_API_KEY absente : relevé ignoré (rien n’est écrit).')
    return
  }

  const horodatage = new Date().toISOString()
  const lignes = []
  for (const modele of modeles) {
    const mesure = await sonder(modele, cle, options.timeoutMs)
    lignes.push({ horodatage, modele, ...mesure })
    console.log(`${modele} → ${mesure.statut} en ${mesure.secondes}s ${mesure.dispo ? '(dispo)' : '(indispo)'}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (options.seche) return

  let existant = ''
  try {
    existant = await readFile(options.sortie, 'utf8')
  } catch {
    existant = ''
  }
  const dejaParsees = [...existant.matchAll(/^\| (\d{4}-\d\d-\d\dT[^ |]+) \| `([^`]+)` \| ([^|]+) \| ([^|]+) \| (oui|non) \|$/gm)].map((m) => ({
    horodatage: m[1],
    modele: m[2],
    statut: m[3].trim(),
    secondes: m[4].trim(),
    dispo: m[5] === 'oui',
  }))
  const toutes = [...dejaParsees, ...lignes].slice(-LIGNES_MAX)
  const synthese = analyserLignes(toutes)
  await writeFile(options.sortie, rendreFichier(toutes, synthese), 'utf8')
  console.log(`${options.sortie} mis à jour (${toutes.length} lignes, ${synthese.total} sur 24 h)`)
}

main().catch((erreur) => {
  console.error('sonde de latence :', erreur?.message ?? erreur)
  exit(0)
})
