import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

/** Écran 1 : un seul bouton. Pas d'explication avant l'action (§21). */
export function Accueil() {
  const { aller, profil } = useRature()
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Ta copie corrigée sait ce que tu répètes.
        </h1>
        <p className="text-muet">
          Photographie-la. On lit les annotations du professeur, on les range par type d’erreur,
          et on fabrique l’exercice qui travaille <em>ta</em> faille.
        </p>
      </div>

      <Bouton onClick={() => aller('cadrage')} pleineLargeur>
        Photographier ma copie
      </Bouton>

      <p className="text-center text-sm text-muet">
        Aucune copie n’est conservée. Ton historique reste sur ton appareil.
      </p>

      {profil.totalAnalyses > 0 ? (
        <Carte titre="Reprendre" ton="vert">
          <p className="text-sm text-muet">
            {profil.totalAnalyses} copie(s) analysée(s) sur cet appareil.
          </p>
          <div className="mt-3">
            <Bouton variante="secondaire" onClick={() => aller('profil')}>
              Voir mon profil d’erreur
            </Bouton>
          </div>
        </Carte>
      ) : null}
    </div>
  )
}
