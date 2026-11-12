import { Section } from './Section'
import { SECTIONS } from './catalogue'

/** RNF-P1 à P5 (docs/ARCHITECTURE.md), traduites en langage clair. */
const REGLES: { ref: string; titre: string; texte: string }[] = [
  {
    ref: 'RNF-P1',
    titre: 'Ta copie n’est jamais enregistrée',
    texte:
      'l’image vit en mémoire le temps de l’analyse, puis disparaît. Elle n’est écrite ni dans ton navigateur, ni sur un serveur.',
  },
  {
    ref: 'RNF-P2',
    titre: 'Ton nom est masqué avant tout le reste',
    texte:
      'dès l’étape 2, le bandeau d’en-tête est pixelisé : ni l’écran, ni le modèle, ni le proxy ne voient l’identité de l’élève.',
  },
  {
    ref: 'RNF-P3',
    titre: 'Le proxy ne lit pas ta copie',
    texte:
      'il garde la clé d’API côté serveur et ne journalise que l’horodatage, le code HTTP et la latence — aucun contenu.',
  },
  {
    ref: 'RNF-P4',
    titre: 'Ton historique t’appartient',
    texte:
      'il reste en local (IndexedDB) sur cet appareil, sans compte ni base de données ; tu peux l’exporter et tout supprimer depuis l’écran Réglages.',
  },
  {
    ref: 'RNF-P5',
    titre: 'On l’écrit, on ne le suppose pas',
    texte:
      'la mention « aucune copie n’est conservée » est affichée dans l’interface : accueil, cadrage, réglages et pied de page.',
  },
]

/** Section 4 : les cinq règles de confidentialité, tenues dans le code. */
export function SectionConfidentialite() {
  return (
    <Section {...SECTIONS.confidentialite}>
      <p className="text-sm text-muet">
        Aucun backend de données : pas de base, pas d’authentification, pas d’analyse côté serveur.
        Voici les cinq exigences du cahier des charges et ce qu’elles veulent dire pour toi.
      </p>
      <ul className="space-y-2">
        {REGLES.map((regle) => (
          <li key={regle.ref} className="rounded-lg border border-bord bg-surface-2 p-3">
            <p className="text-sm">
              <span className="mr-2 rounded-full border border-vert/50 px-2 py-0.5 font-mono text-xs text-vert">
                {regle.ref}
              </span>
              <span className="font-medium text-texte">{regle.titre}</span>
              <span className="text-muet"> — {regle.texte}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muet">
        Et ce que le produit ne fait pas non plus : il ne note pas ta copie, ne donne jamais la
        réponse de l’exercice d’origine, et n’entraîne aucun modèle.
      </p>
    </Section>
  )
}
