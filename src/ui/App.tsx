import { Accueil } from './screens/Accueil'
import { Analyse } from './screens/Analyse'
import { Cadrage } from './screens/Cadrage'
import { Diagnostic } from './screens/Diagnostic'
import { Exercice } from './screens/Exercice'
import { Prof } from './screens/Prof'
import { Profil } from './screens/Profil'
import { Reglages } from './screens/Reglages'
import { Entete } from './components/Entete'
import { useRature } from '../etat/useRature'
import type { Ecran } from '../etat/useRature'
import type { JSX } from 'react'

const ECRANS: Record<Ecran, () => JSX.Element> = {
  accueil: Accueil,
  cadrage: Cadrage,
  analyse: Analyse,
  diagnostic: Diagnostic,
  profil: Profil,
  exercice: Exercice,
  prof: Prof,
  reglages: Reglages,
}

/** Routeur maison : un état, huit écrans, aucune dépendance externe. */
const ETIQUETTES_SANTE = {
  ok: 'modèle en ligne',
  ko: 'modèle indisponible',
  inconnue: 'modèle non sondé',
} as const

export function Application() {
  const { ecran, santeProxy } = useRature()
  const EcranActif = ECRANS[ecran]
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6 sm:px-6">
      <Entete />
      <main className="flex-1">
        <EcranActif />
      </main>
      <footer className="mt-8 border-t border-bord pt-4 text-xs text-muet">
        Aucune copie n’est conservée · historique local ·{' '}
        <span
          aria-label={ETIQUETTES_SANTE[santeProxy]}
          title={ETIQUETTES_SANTE[santeProxy]}
          className={
            santeProxy === 'ko'
              ? 'text-jaune'
              : santeProxy === 'ok'
                ? 'text-vert'
                : 'text-muet'
          }
        >
          ● {ETIQUETTES_SANTE[santeProxy]}
        </span>
      </footer>
    </div>
  )
}
