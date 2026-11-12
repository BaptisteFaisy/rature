import { MAX_TENTATIVES_EXERCICE } from '../../../domain/config'
import { Section } from './Section'
import { SECTIONS } from './catalogue'

/** Les trois booléens rendus par `prompts/garde-fou.md` — jugés après génération. */
const CRITERES: { cle: string; question: string; exemple: string }[] = [
  {
    cle: 'travailleLeBonType',
    question: 'L’exercice fait-il réellement faire le geste du type visé ?',
    exemple: 'Pour E01 « signe perdu », il faut un développement avec des signes à traiter.',
  },
  {
    cle: 'neDonneLaSolutionOrigine',
    question: 'Évite-t-il de recopier l’exercice d’origine et sa solution ?',
    exemple: 'Mêmes nombres, même énoncé = refus : on travaille, on ne rejoue pas la copie.',
  },
  {
    cle: 'memeNiveau',
    question: 'Le niveau est-il cohérent avec la copie analysée ?',
    exemple: 'Ni trop simple (aucun progrès), ni hors de portée (aucune réussite possible).',
  },
]

/** Message réellement renvoyé par `src/pipeline/exercise.ts` quand tout échoue. */
const REFUS =
  'Exercice non disponible pour ce type (Puissance mal gérée) : mieux vaut rien qu’un exercice à côté du sujet.'

/** Section 3 : l'exercice est généré, puis jugé — et le refus est assumé. */
export function SectionGardeFou() {
  return (
    <Section {...SECTIONS.gardeFou}>
      <p className="text-sm text-muet">
        Un exercice hors sujet est pire que pas d’exercice : l’élève travaille à côté de sa faille et
        l’application ment. La génération et le jugement sont donc{' '}
        <span className="text-texte">deux appels distincts, jamais un seul</span> — le modèle qui
        écrit l’exercice n’est pas celui qui le valide.
      </p>
      <h3 className="text-lg font-semibold text-texte">Les trois critères vérifiés</h3>
      <ul className="space-y-2">
        {CRITERES.map((critere, index) => (
          <li key={critere.cle} className="rounded-lg border border-bord bg-surface-2 p-3">
            <p className="text-sm font-medium text-texte">
              <span className="mr-2 font-mono text-vert" aria-hidden="true">
                {index + 1}
              </span>
              {critere.question}
            </p>
            <p className="mt-1 text-xs text-muet">{critere.exemple}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-xl border border-jaune/50 bg-jaune/10 p-3 text-sm">
        <p className="text-texte">
          <span className="font-semibold text-jaune">
            {MAX_TENTATIVES_EXERCICE} tentatives maximum.
          </span>{' '}
          Un seul critère refusé déclenche une régénération, motifs du refus à l’appui. Au-delà, le
          pipeline rend <span className="font-mono">exercice: null</span> et un message explicite :
          jamais un exercice douteux pour remplir l’écran.
        </p>
        <p className="rounded bg-surface px-2 py-1 font-mono text-xs text-jaune">« {REFUS} »</p>
      </div>
    </Section>
  )
}
