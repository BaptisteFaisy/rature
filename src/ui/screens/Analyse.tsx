import { BUDGET_PIPELINE_MS } from '../../domain/config'
import { EtapesPipeline } from '../components/EtapesPipeline'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

/**
 * Écran 3 : la progression nominale des six étapes. On ne montre pas un
 * spinner muet : l'attente devient une démonstration du pipeline (critère
 * Presentation), et le budget annoncé est celui du cahier des charges.
 */
export function Analyse() {
  const { progression, erreur, occupe } = useRature()
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Analyse en cours</h1>
      <p className="text-sm text-muet">
        Budget annoncé : moins de {(BUDGET_PIPELINE_MS / 1000).toFixed(0)} s de la photo au diagnostic.
        La copie n’est envoyée qu’à ce traitement, puis oubliée.
      </p>

      <Carte>
        <EtapesPipeline progression={progression} />
      </Carte>

      {erreur ? <p role="alert" className="text-sm text-jaune">{erreur}</p> : null}
      {!occupe && !erreur ? <p className="text-sm text-muet">Chargement du résultat…</p> : null}
    </div>
  )
}
