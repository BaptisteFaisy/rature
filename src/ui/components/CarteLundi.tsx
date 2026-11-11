import { CODES_ERREUR, estPonderee, libelleDe } from '../../domain/taxonomy'
import { quoiReprendreLundi } from '../../domain/lundi'
import type { CodeErreur } from '../../domain/taxonomy'
import type { StatsClasse } from '../../domain/types'
import { Carte } from './Carte'

type Props = { stats: StatsClasse }

/** Carte « quoi reprendre lundi » : la décision, pas seulement les compteurs. */
export function CarteLundi({ stats }: Props) {
  const plan = quoiReprendreLundi(stats)
  const total = CODES_ERREUR.reduce((s, c) => s + (estPonderee(c) ? stats.parType[c] ?? 0 : 0), 0)
  const consignes: Partial<Record<CodeErreur, string>> = Object.fromEntries(
    plan.exercices.map((e) => [e.code, e.consigne]),
  )
  const partDe = (code: CodeErreur) =>
    total === 0 ? 0 : Math.round(((stats.parType[code] ?? 0) / total) * 100)

  return (
    <Carte titre="Quoi reprendre lundi" ton="jaune">
      <p className="text-sm text-texte">{plan.phrase}</p>

      {plan.types.length > 0 ? (
        <ul className="mt-3 space-y-3 text-sm">
          {plan.types.map((code) => (
            <li key={code}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-texte">
                  <span className="font-mono text-xs text-muet">{code}</span> {libelleDe(code)}
                </span>
                <span className="font-mono text-xs text-muet">{partDe(code)} %</span>
              </div>
              <p className="mt-1 text-muet">{consignes[code]}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {stats.nbCopies < 5 ? (
        <p className="mt-3 text-xs text-muet">Échantillon faible (moins de 5 copies) : à confirmer.</p>
      ) : null}
    </Carte>
  )
}