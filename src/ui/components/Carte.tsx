import type { ReactNode } from 'react'

type Props = { titre?: string; children: ReactNode; ton?: 'neutre' | 'jaune' | 'vert' }

const TONS: Record<NonNullable<Props['ton']>, string> = {
  neutre: 'border-bord',
  jaune: 'border-jaune/60',
  vert: 'border-vert/60',
}

/** Surface d'information : une idée par carte, jamais plus. */
export function Carte({ titre, children, ton = 'neutre' }: Props) {
  return (
    <section className={`rounded-2xl border ${TONS[ton]} bg-surface p-4 sm:p-5`}>
      {titre ? <h2 className="mb-2 text-lg font-semibold text-texte">{titre}</h2> : null}
      <div className="text-texte/90">{children}</div>
    </section>
  )
}
