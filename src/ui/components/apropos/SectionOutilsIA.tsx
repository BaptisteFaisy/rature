import { AMONT_PAR_DEFAUT, CHAINE_MODELES, MODELE_PAR_DEFAUT } from '../../../domain/config'
import { Section } from './Section'
import { SECTIONS } from './catalogue'
import { BlocListe } from './BlocListe'
import { LienExterne } from './LienExterne'
import { docDuDepot } from './lienDepot'

/** Ce que le produit appelle pendant une analyse — et rien d’autre. */
const PRODUIT = [
  `Une API multimodale [OI]-compatible servie par InferHub (${AMONT_PAR_DEFAUT}), derrière un proxy edge qui garde la clé côté serveur. En secours, tu peux coller ta propre clé (BYOK) : elle reste sur ton appareil.`,
  `Modèle par défaut ${MODELE_PAR_DEFAUT}, avec une chaîne de repli sur ${CHAINE_MODELES.length} modèles de la famille ag/ : un 402 ou un 5xx fait passer au suivant, l’analyse aboutit quand même.`,
  'Trois usages, pas un de plus : relever et typer les annotations du professeur (vision), générer l’exercice ciblé, puis juger cet exercice (garde-fou). Aucun OCR classique.',
  'Les prompts sont versionnés dans prompts/ (analyse, extraction, classification, revue, génération, garde-fou) : ils font partie du produit au même titre que le code.',
]

/** Ce qui a été assisté pendant le hackathon, déclaré sans zone grise. */
const DEVELOPPEMENT = [
  'Agents de codage ZeroClaw et leurs sous-agents : écriture du code TypeScript/React, des tests, de la configuration CI et de la documentation.',
  'Modèles via InferHub : résolution automatique des conflits de rebase dans la file de merge.',
  'Agent de périmètre CI : rédaction du bloc « Scope » des pull requests à partir du diff.',
  'Estimation honnête : la majorité du volume de code est assistée, la totalité des décisions de conception et des règles métier est humaine.',
]

/** Ce qui n’est pas généré — les décisions qui font le produit. */
const DECISIONS = [
  'La taxonomie des 12 types et leurs signatures.',
  'Les règles de pondération du profil : seuil de confiance, E99 exclue, E11 à poids nul.',
  'Le corpus de validation et la vérité terrain associée.',
  'La palette, et le refus du rouge dans l’interface : la copie est déjà annotée en rouge par le professeur.',
]

/** Section 6 : l’IA appelée par le produit, l’IA qui a aidé à l’écrire. */
export function SectionOutilsIA() {
  return (
    <Section {...SECTIONS.outilsIA}>
      <p className="text-sm text-muet">
        Deux usages distincts, et ils ne se mélangent pas : l’IA que le produit appelle pour toi
        pendant une analyse, et l’IA qui a aidé à l’écrire pendant le hackathon.
      </p>
      <BlocListe titre="Ce que le produit appelle" items={PRODUIT} />
      <BlocListe titre="Ce qui a été assisté pour le développement" items={DEVELOPPEMENT} />
      <BlocListe titre="Ce qui n’est pas généré" items={DECISIONS} ton="vert" />
      <p className="text-sm text-muet">
        Déclaration complète, outil par outil :{' '}
        <LienExterne href={docDuDepot('docs/DECLARATION-IA.md')}>docs/DECLARATION-IA.md</LienExterne>.
      </p>
    </Section>
  )
}
