import { useRature } from '../../etat/useRature'
import type { Ecran } from '../../etat/useRature'

const LIENS: { ecran: Ecran; libelle: string }[] = [
  { ecran: 'accueil', libelle: 'Copie' },
  { ecran: 'profil', libelle: 'Profil' },
  { ecran: 'prof', libelle: 'Prof' },
  { ecran: 'reglages', libelle: 'Réglages' },
]

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
