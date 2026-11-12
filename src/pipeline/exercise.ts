/**
 * Étape 6 — Exercice ciblé + garde-fou de pertinence (§18.3).
 *
 * Le générateur propose, un second passage juge. Si le juge refuse, on
 * régénère — deux tentatives maximum — puis on l'annonce honnêtement. On ne
 * sert JAMAIS un exercice hors sujet : mieux vaut dire « non disponible ».
 */
import generationMd from '../../prompts/generation.md?raw'
import gardeFouMd from '../../prompts/garde-fou.md?raw'
import { MAX_TENTATIVES_EXERCICE } from '../domain/config'
import { exercicePour, exerciceVerifie } from '../domain/banque'
import { libelleDe, signatureDe } from '../domain/taxonomy'
import type { CodeErreur } from '../domain/taxonomy'
import type { Exercice, ExerciceVerifie, VerdictGardeFou } from '../domain/types'
import { clientParDefaut } from './client'
import type { ClientBrut } from './client'
import type { Transport } from './llm'
import { parserExercice, parserVerdict } from './schemas'

export const PROMPT_GENERATION = generationMd
export const PROMPT_GARDE_FOU = gardeFouMd

export type ArgsExercice = {
  typeDominant: CodeErreur
  extraitCopie: string
  niveau?: string
  transport: Transport
  client?: ClientBrut
  /**
   * false (défaut) : exercice tiré de la **banque locale** — aucun appel réseau,
   * donc l'étape 6 est instantanée (idée 1). true : exercice inédit, généré et
   * vérifié par le modèle (2 appels, 30 à 110 s sur l'amont).
   */
  inedit?: boolean
  /** Identifiants d'exercices déjà proposés, pour en servir un autre. */
  dejaVus?: string[]
  /** Graine de tirage : la banque reste déterministe à options égales. */
  graine?: number
}

export function messageGeneration(typeDominant: CodeErreur, extraitCopie: string, niveau: string): string {
  return [
    `Type d'erreur à travailler : ${typeDominant} — ${libelleDe(typeDominant)}.`,
    `Signature recherchée : ${signatureDe(typeDominant)}.`,
    `Niveau : ${niveau}.`,
    '',
    "Extrait de la copie analysée (ne le recopie pas, prends-en seulement le niveau) :",
    extraitCopie.slice(0, 600),
  ].join('\n')
}

export function messageGardeFou(
  exercice: { enonce: string; indices: string[]; solution: string },
  typeDominant: CodeErreur,
  extraitCopie: string,
): string {
  return [
    `Type visé : ${typeDominant} — ${libelleDe(typeDominant)} (${signatureDe(typeDominant)}).`,
    '',
    'Exercice d’origine (à ne pas recopier) :',
    extraitCopie.slice(0, 400),
    '',
    'Exercice proposé :',
    `Énoncé : ${exercice.enonce}`,
    `Indices : ${exercice.indices.join(' | ') || 'aucun'}`,
    `Solution : ${exercice.solution}`,
  ].join('\n')
}

export function verdictAccepte(verdict: VerdictGardeFou): boolean {
  return verdict.travailleLeBonType && verdict.neDonneLaSolutionOrigine && verdict.memeNiveau
}

async function proposer(args: ArgsExercice, client: ClientBrut, tentative: number): Promise<Exercice> {
  const niveau = args.niveau ?? 'lycée'
  const texte = await client({
    system: PROMPT_GENERATION,
    user: messageGeneration(args.typeDominant, args.extraitCopie, niveau),
    json: true,
    temperature: 0.5,
    maxTokens: 800,
  })
  const brut = parserExercice(texte)
  return {
    enonce: brut.enonce,
    indices: brut.indices,
    solution: brut.solution,
    typeTravaille: args.typeDominant,
    niveau: brut.niveau || niveau,
    tentative,
    id: `modele-${tentative}`,
    source: 'modele',
  }
}

async function juger(
  exercice: Exercice,
  args: ArgsExercice,
  client: ClientBrut,
): Promise<VerdictGardeFou> {
  const texte = await client({
    system: PROMPT_GARDE_FOU,
    user: messageGardeFou(exercice, args.typeDominant, args.extraitCopie),
    json: true,
    temperature: 0,
    maxTokens: 400,
  })
  return parserVerdict(texte)
}

/**
 * Point d'entrée de l'étape 6 : banque locale par défaut, modèle uniquement
 * pour un « exercice inédit » demandé explicitement.
 */
export async function obtenirExercice(
  args: ArgsExercice,
): Promise<{ exercice: ExerciceVerifie | null; message?: string }> {
  if (!args.inedit) {
    const tirage = exercicePour(args.typeDominant, {
      ...(args.dejaVus ? { exclure: args.dejaVus } : {}),
      ...(args.graine !== undefined ? { graine: args.graine } : {}),
    })
    if (!tirage) {
      return {
        exercice: null,
        message: `Pas d'exercice dans la banque pour ce type (${libelleDe(args.typeDominant)}).`,
      }
    }
    return { exercice: exerciceVerifie(tirage) }
  }
  return genererExerciceVerifie(args)
}

export async function genererExerciceVerifie(
  args: ArgsExercice,
): Promise<{ exercice: ExerciceVerifie | null; message?: string }> {
  const client = args.client ?? clientParDefaut(args.transport)
  for (let tentative = 1; tentative <= MAX_TENTATIVES_EXERCICE; tentative += 1) {
    const exercice = await proposer(args, client, tentative)
    const verdict = await juger(exercice, args, client)
    if (verdictAccepte(verdict)) return { exercice: { exercice, verdict } }
  }
  return {
    exercice: null,
    message: `Exercice non disponible pour ce type (${libelleDe(args.typeDominant)}) : mieux vaut rien qu'un exercice à côté du sujet.`,
  }
}
