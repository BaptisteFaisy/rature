import type { Erreur } from '../../domain/types'
import { BadgeCode } from '../components/BadgeCode'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { origineDemo } from '../../pipeline/demo'
import { useRature } from '../../etat/useRature'

/** Un rectangle jaune par faute, positionné en coordonnées relatives. */
function SurimageErreur({ erreur, index }: { erreur: Erreur; index: number }) {
  if (!erreur.zone) return null
  return (
    <span
      key={erreur.zone.x + erreur.zone.y}
      className="absolute rounded border-2 border-jaune bg-jaune/10"
      style={{
        left: `${erreur.zone.x * 100}%`,
        top: `${erreur.zone.y * 100}%`,
        width: `${erreur.zone.largeur * 100}%`,
        height: `${erreur.zone.hauteur * 100}%`,
      }}
      aria-hidden="true"
    >
      <span className="absolute -top-3 left-0 rounded bg-jaune px-1 font-mono text-[11px] text-fond">
        {index + 1}
      </span>
    </span>
  )
}

function LigneErreur({ erreur, index }: { erreur: Erreur; index: number }) {
  return (
    <li className="rounded-xl border border-bord bg-surface p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muet">{index + 1}</span>
        <BadgeCode code={erreur.code} confiance={erreur.confiance} />
        {erreur.ponderee ? null : (
          <span className="text-xs text-muet">signalée, non comptée dans le profil</span>
        )}
      </div>
      <p className="font-mono text-sm text-texte/90">{erreur.ligne}</p>
      <p className="mt-1 text-sm text-muet">{erreur.explication}</p>
    </li>
  )
}

/** Écran 4 : le diagnostic — où travailler, sans jugement. */
export function Diagnostic() {
  const { resultat, aller, demo } = useRature()
  if (!resultat) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Diagnostic</h1>
        <p className="text-sm text-muet">Aucune analyse en cours. Commence par photographier une copie.</p>
        <Bouton onClick={() => aller('cadrage')}>Photographier une copie</Bouton>
      </div>
    )
  }

  const { diagnostic, imageAnonymisee, exercice, messageExercice } = resultat
  const copiePropre = diagnostic.nbFautes === 0

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">
        {copiePropre ? 'Aucune erreur détectée' : `${diagnostic.nbFautes} point(s) à travailler`}
      </h1>

      {demo ? (
        <p className="rounded-lg border border-bord bg-surface-2 px-3 py-2 text-xs text-muet">
          Démonstration : réponses du modèle ({origineDemo().modele}) enregistrées le{' '}
          {origineDemo().enregistreLe.slice(0, 10)} sur une copie d’exemple. Aucun appel réseau.
        </p>
      ) : null}

      <Carte>
        <div className="relative">
          <img
            src={imageAnonymisee}
            alt="Ta copie, nom masqué"
            className="max-h-[50vh] w-full rounded-lg object-contain"
          />
          {diagnostic.erreurs.map((erreur, index) => (
            <SurimageErreur key={index} erreur={erreur} index={index} />
          ))}
        </div>
      </Carte>

      {copiePropre ? (
        <Carte titre="C'est propre" ton="vert">
          <p className="text-sm text-muet">
            Le professeur n’a annoté aucune faute. Rien à travailler aujourd’hui : ajoute une
            autre copie pour affiner ton profil.
          </p>
        </Carte>
      ) : (
        <ul className="space-y-3">
          {diagnostic.erreurs.map((erreur, index) => (
            <LigneErreur key={index} erreur={erreur} index={index} />
          ))}
        </ul>
      )}

      {exercice ? (
        <Bouton onClick={() => aller('exercice')} pleineLargeur>
          Faire l’exercice ciblé sur {exercice.exercice.typeTravaille}
        </Bouton>
      ) : null}
      {messageExercice ? <p className="text-sm text-muet">{messageExercice}</p> : null}
    </div>
  )
}
