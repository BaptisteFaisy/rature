import { useRature } from '../../etat/useRature'
import type { Ecran } from '../../etat/useRature'

const LIENS: { ecran: Ecran; libelle: string }[] = [
  { ecran: 'accueil', libelle: 'Copie' },
  // Entrée directe : sans elle, le diagnostic et l'exercice n'étaient atteignables
  // qu'en sortant d'une analyse — invisibles après la démonstration complète.
  { ecran: 'diagnostic', libelle: 'Diagnostic' },
  { ecran: 'profil', libelle: 'Profil' },
  { ecran: 'prof', libelle: 'Prof' },
  { ecran: 'apropos', libelle: 'Comment ça marche' },
  { ecran: 'reglages', libelle: 'Réglages' },
]

/** Badge discret : l'analyse continue pendant que l'utilisateur navigue. */
function BadgeAnalyse() {
  const { occupe, diagnosticPret, aller, ecran } = useRature()
  if (ecran === 'analyse') return null
  if (occupe) {
    return (
      <button
        type="button"
        onClick={() => aller('analyse')}
        className="etape-en-cours rounded-full border border-jaune/60 px-3 py-1 text-xs text-jaune"
      >
        Analyse en cours…
      </button>
    )
  }
  if (diagnosticPret) {
    return (
      <button
        type="button"
        onClick={() => aller('diagnostic')}
        className="rounded-full border border-vert/60 px-3 py-1 text-xs text-vert"
      >
        Diagnostic prêt
      </button>
    )
  }
  return null
}

export function Entete() {
  const { ecran, aller } = useRature()
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => aller('accueil')}
        className="text-xl font-semibold tracking-tight text-texte"
      >
        Raturé <span aria-hidden="true">🖊️</span>
      </button>
      <BadgeAnalyse />
      <nav aria-label="Navigation principale" className="flex gap-1">
        {LIENS.map((lien) => (
          <button
            key={lien.ecran}
            type="button"
            onClick={() => aller(lien.ecran)}
            aria-current={ecran === lien.ecran ? 'page' : undefined}
            className={[
              'rounded-lg px-3 py-2 text-sm transition',
              ecran === lien.ecran ? 'bg-surface-2 text-texte' : 'text-muet hover:text-texte',
            ].join(' ')}
          >
            {lien.libelle}
          </button>
        ))}
      </nav>
    </header>
  )
}
