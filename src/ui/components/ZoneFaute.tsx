import { libelleDe } from '../../domain/taxonomy'
import type { CodeErreur } from '../../domain/taxonomy'
import type { Zone } from '../../domain/types'

type Props = {
  index: number
  code: CodeErreur
  zone: Zone
  selectionne: boolean
  onSelect: (index: number) => void
}

/**
 * Rectangle cliquable d'une faute. C'est un vrai <button> : accessible au
 * clavier, avec un aria-label parlant. Jaune uniquement — jamais de rouge.
 */
export function ZoneFaute({ index, code, zone, selectionne, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-label={`Faute ${index + 1} : ${libelleDe(code)} — agrandir`}
      aria-pressed={selectionne}
      className={[
        'absolute rounded border-2 transition',
        selectionne ? 'border-jaune bg-jaune/25 ring-2 ring-jaune/60' : 'border-jaune/70 bg-jaune/10 hover:bg-jaune/20',
      ].join(' ')}
      style={{
        left: `${zone.x * 100}%`,
        top: `${zone.y * 100}%`,
        width: `${zone.largeur * 100}%`,
        height: `${zone.hauteur * 100}%`,
      }}
    >
      <span className="absolute -top-3 left-0 rounded bg-jaune px-1 font-mono text-[11px] text-fond">
        {index + 1}
      </span>
    </button>
  )
}
