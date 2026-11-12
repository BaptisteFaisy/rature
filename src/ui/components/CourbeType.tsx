import { libelleDe } from '../../domain/taxonomy'
import type { CodeErreur } from '../../domain/taxonomy'
import type { Tendance } from '../../domain/progression'

type Props = { code: CodeErreur; serie: number[]; tendance: Tendance }

const COULEURS: Record<Tendance, string> = {
  baisse: 'var(--color-vert)',
  stable: 'var(--color-jaune)',
  hausse: 'var(--color-jaune)',
  inconnue: 'var(--color-muet)',
}

const ETIQUETTES: Record<Tendance, string> = {
  baisse: 'en baisse',
  stable: 'stable',
  hausse: 'en hausse',
  inconnue: 'pas encore assez de copies',
}

/**
 * Sparkline SVG inline (aucune dépendance) : une ligne par type, verte si la
 * faille baisse, jaune sinon. Jamais de rouge — la charte l'interdit.
 */
export function CourbeType({ code, serie, tendance }: Props) {
  const largeur = 120
  const hauteur = 32
  const max = Math.max(1, ...serie)
  const pas = serie.length > 1 ? largeur / (serie.length - 1) : 0
  const points = serie
    .map((valeur, index) => `${index * pas},${hauteur - (valeur / max) * (hauteur - 4) - 2}`)
    .join(' ')
  const couleur = COULEURS[tendance]
  const description = `${libelleDe(code)} : ${serie.length} copie(s), ${ETIQUETTES[tendance]}`

  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-texte">
        <span className="font-mono text-xs text-muet">{code}</span> {libelleDe(code)}
      </span>
      <svg
        width={largeur}
        height={hauteur}
        role="img"
        aria-label={description}
        className="shrink-0 overflow-visible"
      >
        <polyline points={points} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" />
        {serie.map((valeur, index) => (
          <circle
            key={index}
            cx={index * pas}
            cy={hauteur - (valeur / max) * (hauteur - 4) - 2}
            r="2.5"
            fill={couleur}
          />
        ))}
      </svg>
      <span className="text-xs" style={{ color: couleur }}>
        {ETIQUETTES[tendance]}
      </span>
    </div>
  )
}
