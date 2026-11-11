/**
 * Contrat de données du produit (RATURE.md §19) — aucune image, aucun nom,
 * aucune donnée personnelle : uniquement du diagnostic structuré, stocké en
 * local (IndexedDB).
 */
import type { CodeErreur } from './taxonomy'

export type Erreur = {
  code: CodeErreur
  libelle: string
  /** Extrait textuel de la ligne fautive — jamais l'image. */
  ligne: string
  /** ≤ 25 mots, ton bienveillant (jamais « tu as fait 4 fautes »). */
  explication: string
  /** 0..1 */
  confiance: number
  /** false pour E11 (recopie) : signalée mais poids nul dans le profil. */
  ponderee: boolean
  /** Zone de la faute dans l'image, en coordonnées relatives (0..1). */
  zone?: Zone
}

export type Zone = { x: number; y: number; largeur: number; hauteur: number }

export type Diagnostic = {
  id: string
  createdAt: string
  matiere: 'maths'
  nbFautes: number
  erreurs: Erreur[]
  /** null si aucune erreur pondérée (copie propre ou uniquement E11/E99). */
  typeDominant: CodeErreur | null
}

export type Profil = {
  /** Occurrences pondérées par type (E99 exclue, E11 poids 0). */
  parType: Record<CodeErreur, number>
  totalAnalyses: number
  evolution: { date: string; typeDominant: CodeErreur | null }[]
  /** Extension : occurrences signalées mais non pondérées (E11, E99). */
  signalees: Partial<Record<CodeErreur, number>>
}

export type Exercice = {
  enonce: string
  indices: string[]
  solution: string
  /** Type d'erreur travaillé — vérifié par le garde-fou (§18.3). */
  typeTravaille: CodeErreur
  niveau: string
  tentative: number
}

export type VerdictGardeFou = {
  travailleLeBonType: boolean
  neDonneLaSolutionOrigine: boolean
  memeNiveau: boolean
  motifs: string[]
}

export type ExerciceVerifie = {
  exercice: Exercice
  verdict: VerdictGardeFou
}

/** Étapes du pipeline (§18.2) — l'attente devient une démonstration. */
export type EtapeId = 'ingest' | 'anonymise' | 'extrait' | 'classifie' | 'agrege' | 'genere'

export type EtatEtape = 'attente' | 'en-cours' | 'fait' | 'echec' | 'sautee'

export type Progression = {
  etape: EtapeId
  etat: EtatEtape
  message?: string
  ms?: number
}

export type Annotation = {
  /** Ligne (ou formule) telle que lue sur la copie. */
  ligne: string
  /** Annotation du professeur (surlignage, « faux », « signe ! », note…). */
  annotation: string
  /** Ce que l'élève a écrit, si lisible. */
  eleve?: string
  /** Ce qu'il fallait écrire, si identifiable. */
  attendu?: string
  zone?: Zone
}

export type Extraction = {
  annotations: Annotation[]
  /** Copie sans aucune annotation : cas « copie propre » (RNF-04). */
  copiePropre: boolean
  /** Nom détecté (masqué côté client, jamais persisté ni transmis au profil). */
  nomDetecte?: string
}

export type ResultatAnalyse = {
  diagnostic: Diagnostic
  extraction: Extraction
  exercice: ExerciceVerifie | null
  /** Message honnête quand aucun exercice pertinent n'a pu être produit. */
  messageExercice?: string
}

export type Reglages = {
  /** Clé personnelle (BYOK) : filet de sécurité si le quota du proxy est épuisé. */
  clePersonnelle: string
  modele: string
  /** URL du proxy edge ; vide = proxy same-origin /api/analyze. */
  proxy: string
}

export type EtapeDiagnostic = { profil: Profil; diagnostic: Diagnostic }

/** Statistique de classe (mode prof, RF-20). */
export type StatsClasse = {
  nbCopies: number
  parType: Record<CodeErreur, number>
  typeLePlusFrequent: CodeErreur | null
  pourcentageTypeFrequent: number
  copiesParType: { id: string; typeDominant: CodeErreur | null }[]
}
