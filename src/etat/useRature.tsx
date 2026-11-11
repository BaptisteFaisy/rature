import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MODELE_PAR_DEFAUT, PROXY_PAR_DEFAUT } from '../domain/config'
import { profilVide } from '../domain/profil'
import type { Diagnostic, Profil, Progression, Reglages, ResultatAnalyse } from '../domain/types'
import { clientDemo, fichierDemo } from '../pipeline/demo'
import { sonderProxy } from '../pipeline/sante'
import type { SanteProxy } from '../pipeline/sante'
import { genererExerciceVerifie } from '../pipeline/exercise'
import { analyserCopie } from '../pipeline/orchestrate'
import type { Transport } from '../pipeline/llm'
import {
  REGLAGES_VIDES,
  chargerDiagnostics,
  chargerProfil,
  chargerReglages,
  effacerHistorique,
  enregistrerDiagnostic,
  sauverReglages,
} from '../storage/local'

export type Ecran =
  | 'accueil'
  | 'cadrage'
  | 'analyse'
  | 'diagnostic'
  | 'profil'
  | 'exercice'
  | 'prof'
  | 'reglages'

const ECRANS: Ecran[] = ['accueil', 'cadrage', 'analyse', 'diagnostic', 'profil', 'exercice', 'prof', 'reglages']

type Etat = {
  ecran: Ecran
  diagnostics: Diagnostic[]
  profil: Profil
  reglages: Reglages
  resultat: ResultatAnalyse | null
  progression: Progression[]
  erreur: string | null
  occupe: boolean
  /** true quand le résultat affiché vient du mode démonstration. */
  demo: boolean
  /** Santé du proxy : ok / ko (bascule vers la démo) / inconnue. */
  santeProxy: SanteProxy
}

type Actions = {
  aller: (ecran: Ecran) => void
  analyser: (fichier: File, options?: { demo?: boolean }) => Promise<void>
  /** Parcours complet sur la copie de démo, réponses du modèle enregistrées. */
  analyserDemo: () => Promise<void>
  enregistrerReglages: (reglages: Reglages) => Promise<void>
  viderHistorique: () => Promise<void>
  reinitialiserErreur: () => void
  /** Un autre exercice sur le même type d'erreur. */
  nouvelExercice: () => Promise<void>
  /** Mode prof : analyse une série de copies et rend la statistique. */
  analyserLot: (fichiers: File[]) => Promise<Diagnostic[]>
}

const Contexte = createContext<(Etat & Actions) | null>(null)

function ecranDepuisUrl(): Ecran {
  const demande = new URLSearchParams(window.location.search).get('ecran')
  return ECRANS.includes(demande as Ecran) ? (demande as Ecran) : 'accueil'
}

/** Transport effectif : proxy edge, ou clé personnelle si elle est fournie. */
export function transportDe(reglages: Reglages): Transport {
  return {
    proxy: reglages.proxy.trim() || PROXY_PAR_DEFAUT,
    modele: reglages.modele.trim() || MODELE_PAR_DEFAUT,
    ...(reglages.clePersonnelle.trim() ? { cle: reglages.clePersonnelle.trim() } : {}),
  }
}

function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : 'Analyse impossible. Réessaie dans un instant.'
}

/** Réseau ou amont épuisé : c'est le signal qui allume la pastille « ko ». */
function amontMort(erreur: unknown): boolean {
  const statut = erreur instanceof Error && 'statut' in erreur ? (erreur as { statut: number }).statut : 0
  return [0, 502, 503, 504].includes(statut)
}

export function RatureProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({
    ecran: ecranDepuisUrl(),
    diagnostics: [],
    profil: profilVide(),
    reglages: REGLAGES_VIDES,
    resultat: null,
    progression: [],
    erreur: null,
    occupe: false,
    demo: false,
    santeProxy: 'inconnue',
  })

  useEffect(() => {
    void (async () => {
      const [diagnostics, profil, reglages] = await Promise.all([
        chargerDiagnostics(),
        chargerProfil(),
        chargerReglages(),
      ])
      setEtat((precedent) => ({ ...precedent, diagnostics, profil, reglages }))
    })()
  }, [])

  // Sonde du proxy au chargement, puis à chaque changement d'adresse.
  const proxyActif = etat.reglages.proxy
  useEffect(() => {
    void sonderProxy(proxyActif).then((santeProxy) => {
      setEtat((precedent) => ({ ...precedent, santeProxy }))
    })
  }, [proxyActif])

  const aller = useCallback((ecran: Ecran) => {
    setEtat((precedent) => ({ ...precedent, ecran }))
    const url = new URL(window.location.href)
    url.searchParams.set('ecran', ecran)
    window.history.replaceState({}, '', url)
  }, [])

  const analyser = useCallback(
    async (fichier: File, options: { demo?: boolean } = {}) => {
      aller('analyse')
      setEtat((precedent) => ({ ...precedent, occupe: true, erreur: null, progression: [], demo: false }))
      try {
        const resultat = await analyserCopie(fichier, {
          transport: transportDe(etat.reglages),
          ...(options.demo ? { client: clientDemo() } : {}),
          onProgression: (p) =>
            setEtat((precedent) => ({ ...precedent, progression: fusionner(precedent.progression, p) })),
          // Dès la fin de l'étape 5 : le diagnostic s'affiche, l'exercice
          // continue de se préparer (RNF-01 porte sur photo → diagnostic).
          onResultatPartiel: (partiel) => {
            // Affichage SYNCHRONE : le résultat complet (avec exercice) est
            // posé après, il ne doit pas être écrasé par la persistance.
            setEtat((precedent) => ({
              ...precedent,
              occupe: false,
              resultat: partiel,
              demo: Boolean(options.demo),
              ecran: 'diagnostic',
            }))
            void enregistrerDiagnostic(partiel.diagnostic).then((profil) => {
              setEtat((precedent) => ({
                ...precedent,
                profil,
                diagnostics: [...precedent.diagnostics, partiel.diagnostic],
              }))
            })
          },
        })
        // L'exercice est prêt : on complète le résultat déjà affiché, sans
        // repersister le diagnostic (déjà fait dans onResultatPartiel).
        setEtat((precedent) => ({ ...precedent, occupe: false, resultat, demo: Boolean(options.demo) }))
      } catch (erreur) {
        setEtat((precedent) => ({
          ...precedent,
          occupe: false,
          erreur: messageErreur(erreur),
          ecran: 'cadrage',
          ...(amontMort(erreur) ? { santeProxy: 'ko' } : {}),
        }))
      }
    },
    [aller, etat.reglages],
  )

  const analyserDemo = useCallback(async () => {
    await analyser(await fichierDemo(), { demo: true })
  }, [analyser])

  /**
   * Mode prof : les copies analysées ici ne rejoignent PAS l'historique
   * personnel — le profil d'un élève et la statistique d'une classe ne se
   * mélangent pas.
   */
  const analyserLot = useCallback(async (fichiers: File[]) => {
    const collectes: Diagnostic[] = []
    setEtat((precedent) => ({ ...precedent, occupe: true, erreur: null, progression: [] }))
    for (const fichier of fichiers) {
      try {
        const resultat = await analyserCopie(fichier, {
          transport: transportDe(etat.reglages),
          onProgression: (p) =>
            setEtat((precedent) => ({ ...precedent, progression: fusionner(precedent.progression, p) })),
        })
        collectes.push(resultat.diagnostic)
      } catch (erreur) {
        setEtat((precedent) => ({ ...precedent, erreur: messageErreur(erreur) }))
      }
    }
    setEtat((precedent) => ({ ...precedent, occupe: false }))
    return collectes
  }, [etat.reglages])

  const enregistrerReglages = useCallback(async (reglages: Reglages) => {
    await sauverReglages(reglages)
    setEtat((precedent) => ({ ...precedent, reglages }))
  }, [])

  const viderHistorique = useCallback(async () => {
    await effacerHistorique()
    setEtat((precedent) => ({ ...precedent, diagnostics: [], profil: profilVide(), resultat: null }))
  }, [])

  const nouvelExercice = useCallback(async () => {
    const resultat = etat.resultat
    const type = resultat?.diagnostic.typeDominant
    if (!resultat || !type) return
    setEtat((precedent) => ({ ...precedent, occupe: true }))
    try {
      const extrait = resultat.extraction.annotations.map((a) => a.ligne).slice(0, 6).join('\n')
      const exercice = await genererExerciceVerifie({
        typeDominant: type,
        extraitCopie: extrait,
        transport: transportDe(etat.reglages),
      })
      setEtat((precedent) => ({
        ...precedent,
        occupe: false,
        resultat: precedent.resultat
          ? { ...precedent.resultat, exercice: exercice.exercice, ...(exercice.message ? { messageExercice: exercice.message } : {}) }
          : precedent.resultat,
      }))
    } catch (erreur) {
      setEtat((precedent) => ({ ...precedent, occupe: false, erreur: messageErreur(erreur) }))
    }
  }, [etat.resultat, etat.reglages])

  const reinitialiserErreur = useCallback(() => {
    setEtat((precedent) => ({ ...precedent, erreur: null }))
  }, [])

  const valeur = useMemo(
    () => ({
      ...etat,
      aller,
      analyser,
      analyserDemo,
      analyserLot,
      enregistrerReglages,
      viderHistorique,
      reinitialiserErreur,
      nouvelExercice,
    }),
    [etat, aller, analyser, analyserDemo, analyserLot, enregistrerReglages, viderHistorique, reinitialiserErreur, nouvelExercice],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useRature() {
  const valeur = useContext(Contexte)
  if (!valeur) throw new Error('useRature doit être utilisé dans <RatureProvider>.')
  return valeur
}

/** Remplace l'état de l'étape dans la liste (une ligne par étape, pas un journal). */
function fusionner(liste: Progression[], nouvelle: Progression): Progression[] {
  const autres = liste.filter((p) => p.etape !== nouvelle.etape)
  return [...autres, nouvelle]
}
