import { glossaire } from '../../../domain/pedagogie'
import { SEUIL_CONFIANCE } from '../../../domain/config'
import { Section } from './Section'
import { SECTIONS } from './catalogue'
import { TypeReplie } from './TypeReplie'

/** Les trois verrous qui tiennent le diagnostic — le seuil vient de la config. */
function verrous(seuil: string): { regle: string; effet: string }[] {
  return [
    {
      regle: 'Une faute = un seul type',
      effet:
        'même quand deux causes se superposent, on arbitre. C’est ce qui rend le profil comptable et la précision mesurable.',
    },
    {
      regle: `Confiance < ${seuil} → E99 « non typée »`,
      effet:
        'la faute est affichée, mais elle est exclue du profil : on ne construit aucun plan de travail sur un doute.',
    },
    {
      regle: 'E11 « erreur de recopie » pondérée à 0',
      effet:
        'elle est signalée à l’élève, mais elle ne pèse pas dans ses failles : une inattention n’est pas une lacune.',
    },
  ]
}

/** Section 2 : la taxonomie fermée, repliée par défaut, et ses trois verrous. */
export function SectionTaxonomie() {
  const types = glossaire()
  const seuil = SEUIL_CONFIANCE.toString().replace('.', ',')
  return (
    <Section {...SECTIONS.taxonomie}>
      <p className="text-sm text-muet">
        Le modèle n’invente jamais de catégorie : il choisit parmi ces {types.length} codes fermés,
        ou répond <span className="font-mono text-texte">E99</span>. C’est ce verrou qui rend le
        diagnostic mesurable — et qui empêche une réponse floue de passer pour une analyse.
      </p>
      <div className="space-y-2">
        {types.map((explication) => (
          <TypeReplie key={explication.code} explication={explication} />
        ))}
      </div>
      <p className="text-xs text-muet">
        Déplie un type : pourquoi cette erreur arrive, le geste concret qui l’évite, un exemple faux
        et sa version juste, et le piège voisin qui lui ressemble.
      </p>
      <h3 className="pt-1 text-lg font-semibold text-texte">Les trois verrous</h3>
      <ul className="space-y-2">
        {verrous(seuil).map((verrou) => (
          <li
            key={verrou.regle}
            className="rounded-lg border border-jaune/40 bg-surface-2 p-3 text-sm"
          >
            <span className="font-medium text-jaune">{verrou.regle}</span>
            <span className="text-muet"> — {verrou.effet}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
