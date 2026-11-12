/** Fiche d'une étape du pipeline : ce qui entre, ce qui sort, ce que ça coûte. */
export type FicheEtape = {
  entree: string
  sortie: string
  /** Latence réellement mesurée (corpus + démo publique), pas une promesse. */
  latence: string
  note?: string
}

type Props = { ordre: number; libelle: string; fiche: FicheEtape }

/**
 * Une ligne du pipeline. Le libellé vient de `ETAPES` (source unique), la fiche
 * est la part documentaire : contrat d'entrée/sortie et temps mesuré.
 */
export function LignePipeline({ ordre, libelle, fiche }: Props) {
  return (
    <li className="rounded-xl border border-bord bg-surface-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-texte">
          <span className="mr-2 font-mono text-jaune" aria-hidden="true">
            {ordre}
          </span>
          {libelle}
        </h3>
        <span className="rounded-full border border-vert/50 px-2 py-0.5 font-mono text-xs text-vert">
          {fiche.latence}
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muet">Entrée</dt>
          <dd className="text-texte/90">{fiche.entree}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muet">Sortie</dt>
          <dd className="text-texte/90">{fiche.sortie}</dd>
        </div>
      </dl>
      {fiche.note ? <p className="mt-2 text-xs text-muet">{fiche.note}</p> : null}
    </li>
  )
}
