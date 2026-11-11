import { classement, occurrencesDominantes, phraseSynthese, typeDominant } from '../../domain/profil'
import { profilEnCsv, ficheEnMarkdown } from '../../export/exports'
import { telechargerCsv, telechargerMarkdown } from '../../export/telecharger'
import { BarreType } from '../components/BarreType'
import { Bouton } from '../components/Bouton'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

/** Écran 5 : le profil d'erreur longitudinal (stretch 9 — presque gratuit). */
export function Profil() {
  const { profil, diagnostics, aller } = useRature()
  const lignes = classement(profil)
  const dominant = typeDominant(profil)

  if (profil.totalAnalyses === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Mon profil d’erreur</h1>
        <p className="text-sm text-muet">
          Rien pour l’instant : le profil se construit à partir de la première copie analysée.
        </p>
        <Bouton onClick={() => aller('cadrage')}>Photographier une copie</Bouton>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Mon profil d’erreur</h1>

      <Carte titre={phraseSynthese(profil)} ton="vert">
        <p className="text-sm text-muet">
          {profil.totalAnalyses} copie(s) analysée(s). {dominant ? `${occurrencesDominantes(profil, dominant)} copie(s) où ce type était dominant.` : ''}
          <br />
          E11 (recopie) et E99 (non typée) ne comptent pas : ce ne sont pas des lacunes de fond.
        </p>
      </Carte>

      <Carte titre="Récurrence par type">
        <div className="space-y-3">
          {lignes.map((entree) => (
            <BarreType key={entree.code} code={entree.code} occurrences={entree.n} part={entree.part} />
          ))}
        </div>
      </Carte>

      <Carte titre="Évolution">
        <ol className="space-y-1 text-sm">
          {profil.evolution.slice(-8).reverse().map((entree) => (
            <li key={entree.date} className="flex justify-between gap-3 text-muet">
              <span className="font-mono text-xs">{entree.date.slice(0, 10)}</span>
              <span>{entree.typeDominant ?? 'copie propre'}</span>
            </li>
          ))}
        </ol>
      </Carte>

      <div className="flex flex-wrap gap-3">
        <Bouton variante="secondaire" onClick={() => telechargerCsv(profilEnCsv(profil))}>
          Exporter le profil (CSV)
        </Bouton>
        <Bouton variante="secondaire" onClick={() => telechargerMarkdown(ficheEnMarkdown(profil, diagnostics))}>
          Ma fiche de révision (Markdown)
        </Bouton>
      </div>
    </div>
  )
}
