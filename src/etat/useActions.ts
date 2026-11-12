/**
 * Actions de l'application. Toute analyse passe par `executerAnalyse` : le mode
 * démo n'est qu'un client différent (`clientDemoPour`), jamais un chemin
 * parallèle — c'est ce qui garantit que la démo montre le vrai pipeline.
 */
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { Diagnostic, ResultatAnalyse } from '../domain/types'
import { clientDemoPour, fichierDemoPour } from '../pipeline/demo'
import { ID_COPIES_DEMO } from '../pipeline/demo'
import { obtenirExercice } from '../pipeline/exercise'
import { analyserCopie } from '../pipeline/orchestrate'
import type { Transport } from '../pipeline/llm'
import { enregistrerDiagnostic, effacerHistorique, sauverReglages } from '../storage/local'
import type { Etat, Modificateur } from './useEtatRature'
import type { Ecran } from './useEtatRature'
import { amontMort, fusionner, messageErreur, transportDe } from './useEtatRature'
import type { Reglages } from '../domain/types'

export type { Reglages }

type Ctx = { etat: Etat; setEtat: Dispatch<SetStateAction<Etat>>; aller: (ecran: Ecran) => void }

/** Transport commun à tous les appels : chaîne optimisée + modèle répondu. */
function transportPour({ etat, setEtat }: Ctx) {
  return transportDe(etat.reglages, {
    chaine: etat.chaineModeles,
    surModele: (modele) => setEtat((precedent) => ({ ...precedent, modeleRepondu: modele })),
    surProgres: (message) => setEtat((precedent) => ({ ...precedent, messageProgres: message })),
  })
}

/** Une analyse, avec publication de la progression. Rend null si échec. */
async function executerAnalyse(
  fichier: File,
  options: { transport: Transport; demoId?: string; setEtat: Ctx['setEtat'] },
): Promise<ResultatAnalyse | null> {
  const { demoId, setEtat } = options
  try {
    return await analyserCopie(fichier, {
      transport: options.transport,
      ...(demoId ? { client: clientDemoPour(demoId) } : {}),
      onProgression: (p) => setEtat((precedent) => ({ ...precedent, progression: fusionner(precedent.progression, p) })),
    })
  } catch (erreur) {
    setEtat((precedent) => ({
      ...precedent,
      erreur: messageErreur(erreur),
      ...(amontMort(erreur) ? { santeProxy: 'ko' as const } : {}),
    }))
    return null
  }
}

/** Affiche le diagnostic dès la fin de l'étape 5, puis persiste en arrière-plan. */
/**
 * Affiche le diagnostic dès la fin de l'étape 5 — sauf si l'utilisateur a
 * quitté l'écran Analyse (mode asynchrone, idée 8) : dans ce cas on ne le
 * rapatrie pas de force, on allume un badge « diagnostic prêt ».
 */
function publierPartiel(
  setEtat: Ctx['setEtat'],
  partiel: ResultatAnalyse,
  demoId: string | null,
): void {
  setEtat((precedent) => ({
    ...precedent,
    occupe: false,
    resultat: partiel,
    demoId,
    ecran: precedent.ecran === 'analyse' ? 'diagnostic' : precedent.ecran,
    diagnosticPret: precedent.ecran !== 'analyse' && precedent.ecran !== 'diagnostic',
  }))
  void enregistrerDiagnostic(partiel.diagnostic).then((profil) => {
    setEtat((precedent) => ({
      ...precedent,
      profil,
      diagnostics: [...precedent.diagnostics, partiel.diagnostic],
    }))
  })
}

export function useActionsRature({ etat, setEtat, aller }: Ctx) {
  const analyser = useCallback(
    async (fichier: File, options: { demoId?: string } = {}) => {
      aller('analyse')
      setEtat((precedent) => ({
        ...precedent,
        occupe: true,
        erreur: null,
        progression: [],
        demoId: null,
      }))
      const demoId = options.demoId ?? null
      const resultat = await analyserCopie(fichier, {
        transport: transportPour({ etat, setEtat, aller }),
        ...(demoId ? { client: clientDemoPour(demoId) } : {}),
        onProgression: (p) =>
          setEtat((precedent) => ({ ...precedent, progression: fusionner(precedent.progression, p) })),
        onResultatPartiel: (partiel) => publierPartiel(setEtat, partiel, demoId),
      }).catch((erreur: unknown) => {
        setEtat((precedent) => ({
          ...precedent,
          occupe: false,
          erreur: messageErreur(erreur),
          ecran: 'cadrage',
          ...(amontMort(erreur) ? { santeProxy: 'ko' as const } : {}),
        }))
        return null
      })
      if (resultat) setEtat((precedent) => ({ ...precedent, occupe: false, resultat, demoId }))
    },
    [aller, etat.reglages, setEtat],
  )

  /** Démo : une copie seule, ou plusieurs d'affilée (trajectoire du profil). */
  const analyserDemo = useCallback(
    async (ids?: string[]) => {
      const cibles = ids && ids.length > 0 ? ids : ID_COPIES_DEMO.slice(0, 1)
      for (const id of cibles) {
        await analyser(await fichierDemoPour(id), { demoId: id })
      }
      // Plusieurs copies : c'est la trajectoire qui intéresse, pas la dernière copie.
      if (cibles.length > 1) aller('profil')
    },
    [analyser, aller],
  )

  /**
   * Mode prof : les copies analysées ici ne rejoignent PAS l'historique
   * personnel — le profil d'un élève et la statistique d'une classe ne se
   * mélangent pas.
   */
  const analyserLot = useCallback(
    async (fichiers: File[], demoIds?: string[]) => {
      const collectes: Diagnostic[] = []
      setEtat((precedent) => ({ ...precedent, occupe: true, erreur: null, progression: [] }))
      for (const [index, fichier] of fichiers.entries()) {
        const resultat = await executerAnalyse(fichier, {
          transport: transportPour({ etat, setEtat, aller }),
          ...(demoIds?.[index] ? { demoId: demoIds[index] } : {}),
          setEtat,
        })
        if (resultat) collectes.push(resultat.diagnostic)
      }
      setEtat((precedent) => ({ ...precedent, occupe: false, demoId: demoIds ? 'lot' : null }))
      return collectes
    },
    [etat.reglages, setEtat],
  )

  /** Mode prof hors ligne : le lot de démonstration, réponses enregistrées. */
  const analyserLotDemo = useCallback(async () => {
    const fichiers: File[] = []
    for (const id of ID_COPIES_DEMO) fichiers.push(await fichierDemoPour(id))
    return analyserLot(fichiers, ID_COPIES_DEMO)
  }, [analyserLot])

  const enregistrerReglages = useCallback(
    async (reglages: Reglages) => {
      await sauverReglages(reglages)
      setEtat((precedent) => ({ ...precedent, reglages }))
    },
    [setEtat],
  )

  const viderHistorique = useCallback(async () => {
    await effacerHistorique()
    setEtat((precedent) => ({
      ...precedent,
      diagnostics: [],
      profil: precedent.profil && { ...precedent.profil, parType: precedent.profil.parType, totalAnalyses: 0, evolution: [], signalees: {} },
      resultat: null,
    }))
  }, [setEtat])

  const reinitialiserErreur = useCallback(() => {
    setEtat((precedent) => ({ ...precedent, erreur: null }))
  }, [setEtat])

  /**
   * Un autre exercice. Par défaut : **banque locale**, donc aucun appel réseau
   * (idée 1). `inedit: true` demande au modèle un exercice inédit — deux
   * appels, donc 30 à 110 s sur l'amont : c'est un choix, pas un défaut.
   */
  const nouvelExercice = useCallback(
    async (options: { inedit?: boolean } = {}) => {
      const resultat = etat.resultat
      const type = resultat?.diagnostic.typeDominant
      if (!resultat || !type) return
      setEtat((precedent) => ({ ...precedent, occupe: true }))
      try {
        const extrait = resultat.extraction.annotations.map((a) => a.ligne).slice(0, 6).join('\n')
        const obtenu = await obtenirExercice({
          typeDominant: type,
          extraitCopie: extrait,
          transport: transportPour({ etat, setEtat, aller }),
          inedit: options.inedit ?? false,
          dejaVus: etat.exercicesVus,
          graine: Date.now() % 1000,
          ...(etat.demoId ? { client: clientDemoPour(etat.demoId) } : {}),
        })
        setEtat((precedent) => ({
          ...precedent,
          occupe: false,
          exercicesVus: obtenu.exercice?.exercice.id
            ? [...precedent.exercicesVus, obtenu.exercice.exercice.id]
            : precedent.exercicesVus,
          resultat: precedent.resultat
            ? {
                ...precedent.resultat,
                exercice: obtenu.exercice,
                ...(obtenu.message ? { messageExercice: obtenu.message } : {}),
              }
            : precedent.resultat,
        }))
      } catch (erreur) {
        setEtat((precedent) => ({ ...precedent, occupe: false, erreur: messageErreur(erreur) }))
      }
    },
    [etat.resultat, etat.reglages, etat.demoId, etat.exercicesVus, setEtat, aller],
  )

  return {
    analyser,
    analyserDemo,
    analyserLot,
    analyserLotDemo,
    enregistrerReglages,
    viderHistorique,
    reinitialiserErreur,
    nouvelExercice,
  }
}

export type ModificateurEtat = Modificateur
