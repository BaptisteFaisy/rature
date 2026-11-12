import type { ExplicationType as FichePedagogique } from '../../../domain/pedagogie'
import { ExplicationType } from '../ExplicationType'

type Props = { explication: FichePedagogique }

/**
 * Un type d'erreur replié sur lui-même : `<details>` natif, aucune dépendance.
 * À douze entrées, l'écran reste lisible — on déplie ce qu'on veut comprendre.
 * Le contenu pédagogique est celui du produit (`ExplicationType`), pas une copie.
 */
export function TypeReplie({ explication }: Props) {
  return (
    <details className="rounded-xl border border-bord bg-surface-2 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-texte">
        <span className="mr-2 font-mono text-jaune">{explication.code}</span>
        {explication.titre}
      </summary>
      <div className="mt-3 border-t border-bord pt-3">
        <ExplicationType code={explication.code} />
      </div>
    </details>
  )
}
