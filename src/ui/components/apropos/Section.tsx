import type { ReactNode } from 'react'

type Props = { id: string; titre: string; children: ReactNode }

/**
 * Une section de l'écran « Comment ça marche » : ancre de sommaire + titre +
 * contenu. `scroll-mt` évite que le titre passe sous l'en-tête au clic.
 */
export function Section({ id, titre, children }: Props) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-2xl border border-bord bg-surface p-4 sm:p-5"
    >
      <h2 className="mb-3 text-2xl font-semibold text-texte">{titre}</h2>
      <div className="space-y-3 text-texte/90">{children}</div>
    </section>
  )
}
