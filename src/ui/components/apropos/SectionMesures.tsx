import { Section } from './Section'
import { SECTIONS } from './catalogue'
import { ChiffreCle } from './ChiffreCle'

/**
 * Chiffres issus de docs/VALIDATION-MODELE.md, du build Vite et de la CI.
 * Aucun chiffre inventé, aucun arrondi arrangeant : chaque valeur porte sa
 * source, et ce qui n'est pas encore mesuré est dit plus bas.
 */
const MESURES: { valeur: string; legende: string; source: string }[] = [
  {
    valeur: '86 %',
    legende: 'de type dominant correct sur les copies nettes (6 sur 7).',
    source: 'banc live tests/live/inferhub.test.ts, corpus de 11 copies, 11 nov. 2026.',
  },
  {
    valeur: '100 %',
    legende:
      'sur les copies dégradées (2 sur 2) : rotation 2-3°, lumière inégale, bruit, flou léger.',
    source: 'même banc live, mêmes conditions de prise de vue qu’un téléphone.',
  },
  {
    valeur: '0',
    legende:
      'faux positif sur les 2 copies propres (nette et dégradée) : aucune faute inventée.',
    source: 'même banc live — exigence RNF-04, le risque qualifié de fatal.',
  },
  {
    valeur: '6 / 8',
    legende:
      'appels au proxy revenus en 503 sur une analyse réelle, tous absorbés par la chaîne de repli : le diagnostic est arrivé quand même.',
    source: 'démo publique de bout en bout, 11 nov. 22 h 27, sans clé côté navigateur.',
  },
  {
    valeur: '≈ 112 Ko',
    legende: 'le bundle JavaScript compressé (gzip), React compris.',
    source: 'npx vite build, bundle mesuré sur dist/assets/ (±1 Ko selon l’état du dépôt).',
  },
  {
    valeur: '170',
    legende: 'tests verts sans réseau ni quota, dont 74 de crash test (données hostiles, volume, pannes).',
    source: 'npm test en CI : 16 fichiers passés, 3 bancs live ignorés sans clé. Détails : docs/CRASH-TEST.md.',
  },
]

/** Section 5 : les mesures, leurs sources, et ce qu'on ne cache pas. */
export function SectionMesures() {
  return (
    <Section {...SECTIONS.mesures}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {MESURES.map((mesure) => (
          <ChiffreCle
            key={mesure.valeur}
            valeur={mesure.valeur}
            legende={mesure.legende}
            source={mesure.source}
          />
        ))}
      </ul>
      <div className="space-y-2 rounded-xl border border-bord bg-surface-2 p-3 text-xs text-muet">
        <p>
          <span className="font-medium text-texte">Ce qu’on ne cache pas.</span> La copie 8 est le
          seul échec du banc : <span className="font-mono">E10</span> rendu là où la vérité terrain
          attend <span className="font-mono">E09</span>. La copie mélange arrondi prématuré, unité
          absente et conversion fausse — c’est une ambiguïté de la fixture, pas un bug du modèle, et
          elle plaide pour des fixtures à faute unique.
        </p>
        <p>
          Le corpus est synthétique (copies générées, écriture manuscrite simulée) : il valide le
          contrat des prompts, la taxonomie et la robustesse à la prise de vue, pas la lecture d’un
          vrai manuscrit — protocole écrit dans <span className="font-mono">corpus/README.md</span>.
        </p>
      </div>
    </Section>
  )
}
