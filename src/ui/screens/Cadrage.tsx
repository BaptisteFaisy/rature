import { useEffect, useState } from 'react'
import { TAILLE_MAX_IMAGE_OCTETS } from '../../domain/config'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

/** Écran 2 : cadrage — aperçu avant analyse, refus poli si trop lourd. */
export function Cadrage() {
  const { analyser, analyserDemo, erreur, reinitialiserErreur, occupe } = useRature()
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    if (!fichier) {
      setApercu(null)
      return
    }
    const url = URL.createObjectURL(fichier)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])

  const choisir = (entrees: FileList | null) => {
    setRefus(null)
    reinitialiserErreur()
    const premier = entrees?.[0]
    if (!premier) return
    if (premier.size > TAILLE_MAX_IMAGE_OCTETS) {
      setRefus('Photo trop lourde (10 Mo max). Reprends-la en qualité normale.')
      setFichier(null)
      return
    }
    setFichier(premier)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Cadrage</h1>
      <p className="text-sm text-muet">
        Place la page entière dans le cadre, lumière naturelle si possible. Le nom sera masqué
        automatiquement avant tout affichage.
      </p>

      <label className="block cursor-pointer rounded-2xl border border-dashed border-bord bg-surface p-6 text-center transition hover:border-jaune">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => choisir(event.target.files)}
        />
        <span className="text-base text-texte">Choisir une photo de la copie corrigée</span>
        <span className="mt-1 block text-sm text-muet">JPG, PNG ou WebP — 10 Mo maximum</span>
      </label>

      {apercu ? (
        <Carte titre="Aperçu">
          <img src={apercu} alt="Aperçu de ta copie" className="max-h-[45vh] w-full rounded-lg object-contain" />
        </Carte>
      ) : null}

      {refus ?? erreur ? <p role="alert" className="text-sm text-jaune">{refus ?? erreur}</p> : null}

      <Bouton onClick={() => fichier && void analyser(fichier)} disabled={!fichier || occupe} pleineLargeur>
        {occupe ? 'Analyse en cours…' : 'Analyser cette copie'}
      </Bouton>

      <div className="text-center">
        <Bouton variante="discret" onClick={() => void analyserDemo()} disabled={occupe}>
          Lancer la démonstration (copie d’exemple, réponses enregistrées)
        </Bouton>
      </div>
    </div>
  )
}
