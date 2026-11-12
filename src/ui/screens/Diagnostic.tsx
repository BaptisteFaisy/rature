import { useRef, useState } from 'react'
import type { Erreur } from '../../domain/types'
import { BadgeCode } from '../components/BadgeCode'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { CopieAnnotee } from '../components/CopieAnnotee'
import { ExplicationType } from '../components/ExplicationType'
import { origineDemo } from '../../pipeline/demo'
import { useRature } from '../../etat/useRature'

function LigneErreur({
  erreur,
  index,
  selectionne,
  onSelect,
  refItem,
}: {
  erreur: Erreur
  index: number
  selectionne: boolean
  onSelect: (index: number) => void
  refItem: (element: HTMLLIElement | null) => void
}) {
  return (
    <li
      ref={refItem}
      className={[
        'cursor-pointer rounded-xl border p-3 transition',
        selectionne ? 'border-jaune bg-surface-2' : 'border-bord bg-surface hover:border-jaune/50',
      ].join(' ')}
      onClick={() => onSelect(index)}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muet">{index + 1}</span>
        <BadgeCode code={erreur.code} confiance={erreur.confiance} />
        {erreur.ponderee ? null : (
          <span className="text-xs text-muet">signalée, non comptée dans le profil</span>
        )}
      </div>
      <p className="font-mono text-sm text-texte/90">{erreur.ligne}</p>
      <p className="mt-1 text-sm text-muet">{erreur.explication}</p>
      {selectionne ? (
        <div className="mt-3 border-t border-bord pt-3">
          <ExplicationType code={erreur.code} />
        </div>
      ) : null}
    </li>
  )
}

/** Écran 4 : le diagnostic — où travailler, sans jugement. */
export function Diagnostic() {
  const { resultat, aller, demoId, progression } = useRature()
  const [selection, setSelection] = useState<number | null>(null)
  const refs = useRef<(HTMLLIElement | null)[]>([])

  if (!resultat) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Diagnostic</h1>
        <p className="text-sm text-muet">Aucune analyse en cours. Commence par photographier une copie.</p>
        <Bouton onClick={() => aller('cadrage')}>Photographier une copie</Bouton>
      </div>
    )
  }

  const { diagnostic, imageAnonymisee, exercice, messageExercice, revue } = resultat
  const copiePropre = diagnostic.nbFautes === 0
  const demo = demoId ? origineDemo(demoId) : null
  const msTotal = progression.reduce((somme, etape) => somme + (etape.ms ?? 0), 0)

  /** Clic sur une faute de la liste : sélection + zoom sur sa zone. */
  const choisir = (index: number) => {
    setSelection(index)
    const zone = diagnostic.erreurs[index]?.zone
    if (zone) refs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">
        {copiePropre ? 'Aucune erreur détectée' : `${diagnostic.nbFautes} point(s) à travailler`}
      </h1>

      {demo ? (
        <p className="rounded-lg border border-bord bg-surface-2 px-3 py-2 text-xs text-muet">
          Démonstration — {demo.titre} : réponses du modèle ({demo.modele}) enregistrées le{' '}
          {demo.enregistreLe.slice(0, 10)}. Aucun appel réseau.
        </p>
      ) : null}

      <p className="text-xs text-muet">
        {msTotal > 0 ? `Analyse en ${(msTotal / 1000).toFixed(1)} s · ` : ''}
        {revue && revue.revues > 0
          ? `${revue.revues} faute(s) peu sûre(s) revérifiée(s), ${revue.modifiees} corrigée(s)`
          : 'aucune faute n’a eu besoin d’une seconde vérification'}
      </p>

      <CopieAnnotee
        src={imageAnonymisee}
        alt="Ta copie, nom masqué"
        erreurs={diagnostic.erreurs}
        selection={selection}
        onSelect={(index) => setSelection(index === selection ? null : index)}
      />

      {copiePropre ? (
        <Carte titre="C'est propre" ton="vert">
          <p className="text-sm text-muet">
            Le professeur n’a annoté aucune faute. Rien à travailler aujourd’hui : ajoute une autre
            copie pour affiner ton profil.
          </p>
        </Carte>
      ) : (
        <ul className="space-y-3">
          {diagnostic.erreurs.map((erreur, index) => (
            <LigneErreur
              key={index}
              erreur={erreur}
              index={index}
              selectionne={selection === index}
              onSelect={choisir}
              refItem={(element) => {
                refs.current[index] = element
              }}
            />
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
