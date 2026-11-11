import { Bouton } from './Bouton'
import { useRature } from '../../etat/useRature'

/**
 * Bandeau « amont indisponible » — lot 2. On n'échoue pas devant un juge : on
 * annonce la panne et on propose la démonstration, qui ne dépend ni du réseau
 * ni de la place de marché du modèle. Honnêteté : on ne remplace JAMAIS la
 * photo de l'utilisateur par la démo — le clic reste explicite.
 */
export function BandeauSante() {
  const { santeProxy, analyserDemo, occupe, aller } = useRature()
  if (santeProxy !== 'ko') return null
  return (
    <div role="alert" className="rounded-xl border border-jaune/50 bg-surface-2 p-3">
      <p className="font-medium text-jaune">Le modèle est momentanément indisponible.</p>
      <p className="mt-1 text-sm text-muet">
        Pas d'inquiétude : tu peux voir le produit quand même, et vérifier ta connexion. La
        démonstration rejoue des réponses réellement enregistrées, sans aucun appel réseau.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Bouton variante="secondaire" onClick={() => void analyserDemo()} disabled={occupe}>
          Lancer la démonstration
        </Bouton>
        <Bouton variante="discret" onClick={() => aller('reglages')}>
          Coller ma propre clé (BYOK)
        </Bouton>
      </div>
    </div>
  )
}