import { libelleDe } from '../../domain/taxonomy'
import type { CodeErreur } from '../../domain/taxonomy'

type Props = { code: CodeErreur; confiance?: number }

/** Étiquette d'un type d'erreur : code + libellé + confiance affichée (§17). */
export function BadgeCode({ code, confiance }: Props) {
  const estNonTypee = code === 'E99'
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        estNonTypee ? 'border-bord text-muet' : 'border-jaune/50 bg-jaune/10 text-jaune',
      ].join(' ')}
    >
      <span className="font-mono">{code}</span>
      <span>{libelleDe(code)}</span>
      {confiance !== undefined ? (
        <span className="font-mono text-[11px] opacity-70">{Math.round(confiance * 100)} %</span>
      ) : null}
    </span>
  )
}
