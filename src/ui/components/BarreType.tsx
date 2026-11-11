import { libelleDe } from '../../domain/taxonomy'
import type { CodeErreur } from '../../domain/taxonomy'

type Props = { code: CodeErreur; occurrences: number; part: number }

/** Barre de récurrence : vert = progression, jamais de rouge (§10). */
export function BarreType({ code, occurrences, part }: Props) {
  const pourcentage = Math.round(part * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-texte">
          <span className="font-mono text-xs text-muet">{code}</span> {libelleDe(code)}
        </span>
        <span className="font-mono text-xs text-muet">
          {occurrences} · {pourcentage} %
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${libelleDe(code)} : ${pourcentage} % de tes erreurs`}
      >
        <div className="h-full rounded-full bg-vert" style={{ width: `${Math.max(pourcentage, 2)}%` }} />
      </div>
    </div>
  )
}
