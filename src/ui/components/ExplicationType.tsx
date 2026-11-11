import { explicationDe } from '../../domain/pedagogie'
import type { CodeErreur } from '../../domain/taxonomy'
import { BadgeCode } from './BadgeCode'

type Props = { code: CodeErreur; compact?: boolean }

/** Bloc pédagogique d'un type : pourquoi, geste, exemple faux/juste, piège. */
export function ExplicationType({ code, compact = false }: Props) {
  const explication = explicationDe(code)
  if (!explication) {
    return (
      <p className="text-sm text-muet">
        Cette faute n’a pas pu être rangée dans un type précis : elle ne compte pas dans ton profil.
      </p>
    )
  }
  return (
    <div className="space-y-2 text-sm">
      <BadgeCode code={explication.code} />
      <p className="text-texte/90">{explication.pourquoi}</p>
      <p className="text-vert">
        <span className="font-medium">Le geste : </span>
        {explication.geste}
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        <p className="rounded bg-surface-2 px-2 py-1 font-mono text-xs text-jaune line-through decoration-jaune/60">
          {explication.exemple}
        </p>
        <p className="rounded bg-surface-2 px-2 py-1 font-mono text-xs text-vert">{explication.contreExemple}</p>
      </div>
      {!compact ? <p className="text-xs text-muet">{explication.piege}</p> : null}
    </div>
  )
}
