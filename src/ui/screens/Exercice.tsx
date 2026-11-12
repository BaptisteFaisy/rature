import { useState } from 'react'
import { origineExercice } from '../../domain/banque'
import { libelleDe } from '../../domain/taxonomy'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

/**
 * Écran 6 : l'exercice ciblé. La solution est masquée par défaut — l'app
 * entraîne, elle ne donne jamais la réponse (§10).
 */
export function Exercice() {
  const { resultat, nouvelExercice, occupe, aller } = useRature()
  const [reponse, setReponse] = useState('')
  const [solutionVue, setSolutionVue] = useState(false)
  const [indicesVus, setIndicesVus] = useState(false)

  const verifie = resultat?.exercice
  if (!verifie) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Exercice ciblé</h1>
        <p className="text-sm text-muet">
          {resultat?.messageExercice ?? 'Aucun exercice en cours : analyse d’abord une copie.'}
        </p>
        <Bouton onClick={() => aller('cadrage')}>Photographier une copie</Bouton>
      </div>
    )
  }

  const { exercice, verdict } = verifie
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Travaille : {libelleDe(exercice.typeTravaille)}</h1>
      <p className="text-sm text-muet">
        Un seul objectif, pas un chapitre entier. Niveau : {exercice.niveau}.
      </p>

      <Carte titre="Énoncé" ton="jaune">
        <p className="whitespace-pre-wrap text-base text-texte">{exercice.enonce}</p>
      </Carte>

      <div className="flex flex-wrap gap-3">
        <Bouton variante="secondaire" onClick={() => setIndicesVus((vu) => !vu)}>
          {indicesVus ? 'Masquer les indices' : 'Voir un indice'}
        </Bouton>
        <Bouton variante="discret" onClick={() => setSolutionVue((vue) => !vue)}>
          {solutionVue ? 'Masquer la solution' : 'Voir la solution'}
        </Bouton>
      </div>

      {indicesVus && exercice.indices.length > 0 ? (
        <Carte>
          <ul className="list-inside list-disc space-y-1 text-sm text-muet">
            {exercice.indices.map((indice) => (
              <li key={indice}>{indice}</li>
            ))}
          </ul>
        </Carte>
      ) : null}

      <Carte titre="Ta réponse">
        <textarea
          value={reponse}
          onChange={(event) => setReponse(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-bord bg-surface-2 p-3 text-texte"
          placeholder="Écris ton calcul ici. Rien n'est enregistré sur un serveur."
        />
      </Carte>

      {solutionVue ? (
        <Carte titre="Solution" ton="vert">
          <p className="whitespace-pre-wrap text-sm text-texte">{exercice.solution}</p>
        </Carte>
      ) : null}

      <p className="text-xs text-muet">{origineExercice(exercice)}</p>

      <Carte>
        <p className="text-xs text-muet">
          Garde-fou : cet exercice a été vérifié sur trois points — il travaille bien
          « {libelleDe(exercice.typeTravaille)} », il ne donne pas la solution de ton exercice
          d’origine, et il est à ton niveau ({verdict.motifs.length > 0 ? `motif : ${verdict.motifs[0]}` : 'les trois vérifiés'}).
        </p>
      </Carte>

      <div className="space-y-2">
        <Bouton onClick={() => void nouvelExercice()} disabled={occupe} pleineLargeur>
          {occupe ? 'Préparation…' : 'Un autre exercice (banque locale, instantané)'}
        </Bouton>
        <div className="text-center">
          <Bouton variante="discret" onClick={() => void nouvelExercice({ inedit: true })} disabled={occupe}>
            Exercice inédit, généré par le modèle (lent)
          </Bouton>
        </div>
      </div>
    </div>
  )
}
