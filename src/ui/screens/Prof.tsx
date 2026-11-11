import { useState } from 'react'
import { statsClasse } from '../../domain/classe'
import { CODES_ERREUR, CODE_NON_TYPEE } from '../../domain/taxonomy'
import { libelleDe } from '../../domain/taxonomy'
import type { Diagnostic } from '../../domain/types'
import { statsEnCsv } from '../../export/exports'
import { telechargerCsv } from '../../export/telecharger'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { CarteLundi } from '../components/CarteLundi'
import { useRature } from '../../etat/useRature'

/** Écran 7 — mode prof (RF-20) : N copies → statistique de classe + CSV. */
export function Prof() {
  const { analyserLot, occupe, erreur } = useRature()
  const [fichiers, setFichiers] = useState<File[]>([])
  const [copies, setCopies] = useState<Diagnostic[]>([])

  const stats = statsClasse(copies)
  const types = [...CODES_ERREUR, CODE_NON_TYPEE].filter((code) => (stats.parType[code] ?? 0) > 0)
  const total = types.reduce((somme, code) => somme + (stats.parType[code] ?? 0), 0)

  const lancer = async () => {
    if (fichiers.length === 0) return
    const collectes = await analyserLot(fichiers)
    setCopies((precedentes) => [...precedentes, ...collectes])
    setFichiers([])
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Mode professeur</h1>
      <p className="text-sm text-muet">
        Photographie le paquet de copies : tu obtiens la statistique d’erreurs de la classe et tu
        sais quoi reprendre lundi. Ces copies ne rejoignent pas l’historique personnel.
      </p>

      <label className="block cursor-pointer rounded-2xl border border-dashed border-bord bg-surface p-6 text-center">
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => setFichiers(Array.from(event.target.files ?? []))}
        />
        <span className="text-base text-texte">
          {fichiers.length > 0 ? `${fichiers.length} copie(s) prête(s)` : 'Choisir plusieurs photos'}
        </span>
        <span className="mt-1 block text-sm text-muet">Sélection multiple, aucune limite de copie</span>
      </label>

      <Bouton onClick={() => void lancer()} disabled={fichiers.length === 0 || occupe} pleineLargeur>
        {occupe ? 'Analyse en cours…' : `Analyser ${fichiers.length || ''} copie(s)`.trim()}
      </Bouton>
      {erreur ? <p role="alert" className="text-sm text-jaune">{erreur}</p> : null}

      {stats.nbCopies > 0 ? (
        <>
          <Carte
            titre={`${stats.nbCopies} copie(s) — type dominant : ${stats.typeLePlusFrequent ? libelleDe(stats.typeLePlusFrequent) : 'aucun'}`}
            ton="jaune"
          >
            <p className="text-sm text-muet">
              {stats.typeLePlusFrequent
                ? `${stats.pourcentageTypeFrequent} % des erreurs de la classe portent sur ce point.`
                : 'Aucune erreur pondérée relevée.'}
            </p>
          </Carte>

          <CarteLundi stats={stats} />

          <Carte titre="Répartition des erreurs de la classe">
            <ul className="space-y-2 text-sm">
              {types.map((code) => (
                <li key={code} className="flex items-baseline justify-between gap-3">
                  <span className="text-texte">
                    <span className="font-mono text-xs text-muet">{code}</span> {libelleDe(code)}
                  </span>
                  <span className="font-mono text-xs text-muet">
                    {stats.parType[code]} · {total === 0 ? 0 : Math.round(((stats.parType[code] ?? 0) / total) * 100)} %
                  </span>
                </li>
              ))}
            </ul>
          </Carte>

          <Bouton variante="secondaire" onClick={() => telechargerCsv(statsEnCsv(stats), 'rature-classe')}>
            Exporter la statistique (CSV)
          </Bouton>
        </>
      ) : null}
    </div>
  )
}
