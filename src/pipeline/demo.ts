/**
 * Mode démonstration — rejoue des réponses **réellement enregistrées** par le
 * modèle sur les copies du corpus (`corpus/reponses/*.json`, captées par
 * `tests/live/enregistrer-demo.test.ts`).
 *
 * À quoi ça sert : la démo publique n'a pas de clé, et l'amont peut être lent ou
 * sans capacité le jour du jugement. Tout le produit reste démontrable hors
 * ligne — y compris le mode professeur et la trajectoire du profil, qui demandent
 * plusieurs copies. Les parseurs zod travaillent sur du vrai JSON de modèle,
 * rien n'est court-circuité.
 *
 * Les copies disponibles sont découvertes au build (`import.meta.glob`) : ajouter
 * un enregistrement dans `corpus/reponses/` étend la démo sans toucher au code.
 *
 * Honnêteté : l'UI affiche « réponses enregistrées » quand ce mode tourne.
 */
import { libelleDe } from '../domain/taxonomy'
import type { CodeErreur } from '../domain/taxonomy'
import type { ClientBrut } from './client'
import type { RequeteLLM } from './llm'

export type EtapeDemo = 'analyse' | 'revue' | 'exercice' | 'verdict'

type Enregistrement = {
  source: string
  modele: string
  enregistreLe: string
  dominant: string
  /** Absent des enregistrements antérieurs au 12/11 : toléré. */
  nbFautes?: number
  revues?: number
  /** Durées réelles mesurées lors de l'enregistrement, rejouées par la démo. */
  durees?: Record<string, number>
  reponses: Record<string, string>
}

export type CopieDemo = {
  id: string
  titre: string
  image: string
  enregistrement: Enregistrement
}

/**
 * `eager` + `import: 'default'` : sans l'option `import`, Vite rend le MODULE
 * (objet) et non la valeur — en dev, `fetch(module)` lève « Cannot convert
 * object to primitive value ». Bug payé le 12/11.
 */
const REPONSES = import.meta.glob<Enregistrement>('../../corpus/reponses/*.json', {
  eager: true,
  import: 'default',
})
const IMAGES = import.meta.glob<string>('../../corpus/demo/*.{png,jpg}', { eager: true, import: 'default' })

function idDepuisChemin(chemin: string): string {
  const base = chemin.slice(chemin.lastIndexOf('/') + 1)
  return base.slice(0, base.lastIndexOf('.'))
}

/** Titre lisible : le type dominant, et le nombre de fautes quand il est connu. */
function titreCopie(id: string, enregistrement: Enregistrement): string {
  const libelle = libelleDe(enregistrement.dominant as CodeErreur)
  const fautes = enregistrement.nbFautes
  return fautes === undefined ? `${id} — ${libelle}` : `${libelle} — ${fautes} faute(s)`
}

function construireCopies(): CopieDemo[] {
  const copies: CopieDemo[] = []
  for (const [chemin, enregistrementBrut] of Object.entries(REPONSES)) {
    const id = idDepuisChemin(chemin)
    const image = Object.entries(IMAGES).find(([cle]) => idDepuisChemin(cle) === id)?.[1]
    if (!image) continue
    const enregistrement = enregistrementBrut
    copies.push({
      id,
      titre: titreCopie(id, enregistrement),
      image,
      enregistrement,
    })
  }
  // Ordre stable : le rejeu d'une « démonstration complète » doit être reproductible.
  return copies.sort((a, b) => a.id.localeCompare(b.id))
}

export const COPIES_DEMO: CopieDemo[] = construireCopies()

export const ID_COPIES_DEMO = COPIES_DEMO.map((copie) => copie.id)

export function copieDemo(id?: string): CopieDemo | undefined {
  if (!id) return COPIES_DEMO[0]
  return COPIES_DEMO.find((copie) => copie.id === id)
}

/** Quelle étape le prompt en cours correspond-il ? (marqueurs de titres) */
export function etapeDe(requete: RequeteLLM): EtapeDemo {
  const system = requete.system
  if (system.includes('Garde-fou')) return 'verdict'
  if (system.includes('Génération')) return 'exercice'
  if (system.includes('Seconde passe')) return 'revue'
  return 'analyse'
}

/** Pause courte : la démo rejoue le rythme réel de l'enregistrement. */
function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms))
}

/**
 * Client de rejeu pour une copie donnée. La réponse est instantaneous, mais on
 * **attend la durée réellement mesurée** lors de l'enregistrement : sans cela,
 * la démo serait instantanée et donc peu crédible (« 0,1 s » pour une analyse
 * complète est un signal d'alerte pour un juge technique).
 */
export function clientDemoPour(id?: string, options: { attente?: boolean } = {}): ClientBrut {
  const copie = copieDemo(id)
  if (!copie) throw new Error('Mode démo : aucune réponse enregistrée dans corpus/reponses/.')
  const reponses = copie.enregistrement.reponses
  const durees = copie.enregistrement.durees ?? {}
  const attendu = options.attente ?? true
  return async (requete: RequeteLLM) => {
    const etape = etapeDe(requete)
    const texte = reponses[etape]
    if (!texte) {
      throw new Error(
        `Mode démo : pas de réponse enregistrée pour l'étape « ${etape} » — recapturer le corpus.`,
      )
    }
    // Les durées sont enregistrées par ÉTAPE du pipeline (extrait, classifie,
    // genere), alors que l'appel est identifié par son prompt. Correspondance :
    const etapePipeline = {
      analyse: 'extrait',
      revue: 'classifie',
      exercice: 'genere',
      verdict: 'genere',
    }[etape]
    const duree = durees[etapePipeline]
    if (attendu && typeof duree === 'number' && duree > 0 && duree < 60_000) await attendre(duree)
    return texte
  }
}

export function clientDemo(): ClientBrut {
  return clientDemoPour()
}

/** Métadonnées de l'enregistrement, affichées dans l'UI. */
export function origineDemo(id?: string) {
  const copie = copieDemo(id)
  if (!copie) return null
  return {
    titre: copie.titre,
    modele: copie.enregistrement.modele,
    enregistreLe: copie.enregistrement.enregistreLe,
    dominant: copie.enregistrement.dominant,
    nbFautes: copie.enregistrement.nbFautes ?? null,
    revues: copie.enregistrement.revues ?? 0,
  }
}

/** Une copie de démo, en `File` : le pipeline tourne exactement comme en vrai. */
export async function fichierDemoPour(id?: string): Promise<File> {
  const copie = copieDemo(id)
  if (!copie) throw new Error('Mode démo : aucune copie enregistrée disponible.')
  const reponse = await fetch(copie.image)
  const blob = await reponse.blob()
  return new File([blob], `${copie.id}.png`, { type: blob.type || 'image/png' })
}

export async function fichierDemo(): Promise<File> {
  return fichierDemoPour()
}
