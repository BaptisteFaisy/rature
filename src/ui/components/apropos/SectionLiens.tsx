import { Section } from './Section'
import { SECTIONS } from './catalogue'
import { LigneLien } from './LigneLien'
import type { Lien } from './LigneLien'
import { DEMO, DEPOT, docDuDepot } from './lienDepot'

/** Deux groupes : voir le produit, puis lire ce qui le documente. */
const GROUPES: { titre: string; liens: Lien[] }[] = [
  {
    titre: 'Voir le produit',
    liens: [
      {
        etiquette: 'Démo en ligne',
        href: DEMO,
        detail:
          'La webapp déployée, utilisable sans installation. Un mode démonstration prend le relais si l’amont est saturé.',
      },
      {
        etiquette: 'Dépôt GitHub',
        href: DEPOT,
        detail: 'Code, tests, corpus, prompts et CI : tout est public, sous licence MIT.',
      },
    ],
  },
  {
    titre: 'Les documents du dépôt',
    liens: [
      {
        etiquette: 'README',
        href: docDuDepot('README.md'),
        detail: 'Le produit en une page : pipeline, taxonomie, règles du profil, comment lancer.',
      },
      {
        etiquette: 'Write-up',
        href: docDuDepot('docs/WRITEUP.md'),
        detail: 'Le récit de conception : le problème, les choix, les impasses assumées.',
      },
      {
        etiquette: 'Script vidéo',
        href: docDuDepot('docs/SCRIPT-VIDEO.md'),
        detail: 'Le découpage seconde par seconde de la vidéo de soumission (3 minutes).',
      },
      {
        etiquette: 'Checklist de soumission',
        href: docDuDepot('docs/CHECKLIST-SOUMISSION.md'),
        detail: 'Les critères d’acceptation du concours, un par un, et où chacun est tenu.',
      },
      {
        etiquette: 'Architecture',
        href: docDuDepot('docs/ARCHITECTURE.md'),
        detail: 'Les quatre choix structurants, le pipeline et les règles RNF-P1 à P5.',
      },
      {
        etiquette: 'Validation du modèle',
        href: docDuDepot('docs/VALIDATION-MODELE.md'),
        detail: 'Le banc live, le corpus, chaque copie et sa latence : la source des chiffres.',
      },
    ],
  },
]

/** Section 7 : sortir de l’écran — démo, dépôt, documents. */
export function SectionLiens() {
  return (
    <Section {...SECTIONS.liens}>
      <p className="text-sm text-muet">
        Les juges parcourent le site : voici les trois endroits où le projet se vérifie vraiment.
      </p>
      {GROUPES.map((groupe) => (
        <div key={groupe.titre} className="space-y-2">
          <h3 className="text-lg font-semibold text-texte">{groupe.titre}</h3>
          <ul className="space-y-2">
            {groupe.liens.map((lien) => (
              <LigneLien key={lien.href} lien={lien} />
            ))}
          </ul>
        </div>
      ))}
    </Section>
  )
}
