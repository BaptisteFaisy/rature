import type { Progression } from '../../domain/types'
import { ETAPES } from '../../domain/etapes'

type Props = { progression: Progression[] }

const SYMBOLES: Record<string, string> = {
  attente: '·',
  'en-cours': '…',
  fait: '✓',
  echec: '×',
  sautee: '–',
}

/** Les six étapes du pipeline, visibles : l'attente devient une démonstration. */
export function EtapesPipeline({ progression }: Props) {
  const parEtape = new Map(progression.map((p) => [p.etape, p]))
  return (
    <ol className="space-y-2" aria-live="polite">
      {ETAPES.map(({ id, libelle }) => {
        const etat = parEtape.get(id)
        const statut = etat?.etat ?? 'attente'
        return (
          <>
            <li
              key={id}
              className={[
                'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
                statut === 'fait' ? 'border-vert/50 text-vert' : 'border-bord text-muet',
                statut === 'en-cours' ? 'etape-en-cours border-jaune/60 text-jaune' : '',
                statut === 'echec' ? 'border-jaune/60 text-jaune' : '',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="w-4 text-center font-mono">
                  {SYMBOLES[statut]}
                </span>
                {libelle}
              </span>
              <span className="font-mono text-xs">{etat?.ms !== undefined ? `${etat.ms} ms` : ''}</span>
            </li>
            {etat?.preuve ? (
              <li className="-mt-1 ml-6 rounded-lg border border-bord bg-surface-2 px-3 py-2 text-xs text-muet">
                <span className="text-vert">preuve : </span>
                {etat.preuve}
              </li>
            ) : null}
          </>
        )
      })}
    </ol>
  )
}
