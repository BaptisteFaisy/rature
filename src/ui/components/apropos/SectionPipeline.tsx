import { ETAPES } from '../../../domain/etapes'
import { BUDGET_PIPELINE_MS, MAX_FAUTES_A_REVOIR, SEUIL_REVUE } from '../../../domain/config'
import type { EtapeId } from '../../../domain/types'
import { Section } from './Section'
import { SECTIONS } from './catalogue'
import { LignePipeline } from './LignePipeline'
import type { FicheEtape } from './LignePipeline'

/**
 * Contrat et latence de chaque étape. Les libellés ne sont PAS recopiés : ils
 * viennent de `ETAPES`. Les latences sont celles mesurées sur le corpus et sur
 * la démo publique (docs/VALIDATION-MODELE.md), pas des objectifs.
 */
const FICHES: Record<EtapeId, FicheEtape> = {
  ingest: {
    entree: 'ta photo (fichier jusqu’à 10 Mo)',
    sortie: 'data URL de 1600 px, contraste étiré',
    latence: '< 300 ms',
    note: 'En local, sur ton appareil : rien ne part sur le réseau à ce stade.',
  },
  anonymise: {
    entree: 'le data URL de l’étape 1',
    sortie: 'le même data URL, bandeau du nom pixelisé',
    latence: '< 500 ms',
    note: 'Le nom est masqué avant tout affichage et avant tout envoi (RNF-P2).',
  },
  extrait: {
    entree: 'le data URL anonymisé + le prompt d’analyse',
    sortie: 'les annotations du professeur, ligne par ligne',
    latence: '16 à 50 s',
    note: 'Un seul appel vision pour les étapes 3 et 4. Mesuré sur le corpus : 22 s en moyenne, 6,7 s sur une copie propre. La fourchette vient de l’amont (place de marché), pas du code.',
  },
  classifie: {
    entree: 'les annotations relevées à l’étape 3',
    sortie: 'chaque faute typée dans les 12 codes, avec un score de confiance',
    latence: '0 s de plus',
    note: 'Même réponse que l’étape 3 : aucun appel supplémentaire. Les seuils sont appliqués côté client, jamais par le modèle.',
  },
  agrege: {
    entree: 'les fautes typées + l’historique local',
    sortie: 'ton profil d’erreur : récurrence, évolution, type dominant',
    latence: '< 50 ms',
    note: 'En local, dans IndexedDB. Aucune donnée ne quitte l’appareil ici.',
  },
  genere: {
    entree: 'le type dominant de ton profil + l’extrait de la copie',
    sortie: 'un exercice vérifié par le garde-fou, ou un refus explicite',
    latence: '< 6 s',
    note: 'Deux appels distincts : génération, puis jugement. Le diagnostic est déjà affiché pendant ce temps.',
  },
}

/** Section 1 : le pipeline rendu visible, avec ses vrais chiffres de latence. */
export function SectionPipeline() {
  const seuilRevue = SEUIL_REVUE.toString().replace('.', ',')
  return (
    <Section {...SECTIONS.pipeline}>
      <p className="text-sm text-muet">
        De la photo à l’exercice ciblé : six étapes, un budget cible de{' '}
        <span className="font-mono text-texte">{BUDGET_PIPELINE_MS / 1000} s</span> pour aller de
        la photo au diagnostic. Les latences ci-dessous sont mesurées, pas annoncées.
      </p>
      <ol className="space-y-2">
        {ETAPES.map(({ id, libelle }, index) => (
          <LignePipeline key={id} ordre={index + 1} libelle={libelle} fiche={FICHES[id]} />
        ))}
      </ol>
      <p className="rounded-xl border border-jaune/50 bg-jaune/10 p-3 text-sm text-texte">
        <span className="font-semibold text-jaune">
          Pourquoi les étapes 3 et 4 ne font qu’un seul appel.{' '}
        </span>
        Chaque aller-retour avec l’amont coûte 16 à 50 s selon la disponibilité des modèles : deux
        appels séquentiels faisaient tomber le budget « photo → diagnostic » à 40-90 s, la fusion le
        ramène à 22 s en moyenne sans perdre en justesse (4 copies sur 5 correctement typées).
      </p>
      <p className="text-xs text-muet">
        Étape 4 bis, hors des six libellés : les fautes dont la confiance est inférieure à{' '}
        <span className="font-mono">{seuilRevue}</span> sont revérifiées par un appel texte seul,
        borné à {MAX_FAUTES_A_REVOIR} fautes — il confirme, reclasse ou rétrograde en E99, sans
        jamais ajouter de faute.
      </p>
    </Section>
  )
}
