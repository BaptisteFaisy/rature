import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { profilVide } from '../domain/profil'
import { effacerHistorique } from '../storage/local'
import { useActionsRature } from './useActions'
import { useEtatRature } from './useEtatRature'

export type { Ecran, Etat } from './useEtatRature'
export { ECRANS, transportDe } from './useEtatRature'

/**
 * Fournisseur unique : l'état vient de `useEtatRature`, les actions de
 * `useActionsRature`. Les écrans ne consomment que `useRature()`.
 */
export function RatureProvider({ children }: { children: ReactNode }) {
  const { etat, setEtat, aller } = useEtatRature()
  const actions = useActionsRature({ etat, setEtat, aller })

  const valeur = useMemo(() => ({ ...etat, aller, ...actions }), [etat, aller, actions])
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

type Valeur = ReturnType<typeof useEtatRature>['etat'] & {
  aller: (ecran: import('./useEtatRature').Ecran) => void
} & ReturnType<typeof useActionsRature>

const Contexte = createContext<Valeur | null>(null)

export function useRature(): Valeur {
  const valeur = useContext(Contexte)
  if (!valeur) throw new Error('useRature doit être utilisé dans <RatureProvider>.')
  return valeur
}

/** Réutilisé par les écrans : remise à zéro complète de l'historique local. */
export { effacerHistorique, profilVide }
