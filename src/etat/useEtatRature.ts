/**
 * État de l'application : écran courant, données locales, réglages, santé du
 * proxy. Séparé des actions (`useActions.ts`) pour garder chaque fonction sous
 * la limite de 50 lignes.
 */
import { useCallback, useEffect, useState } from 'react'
import { MODELE_PAR_DEFAUT, PROXY_PAR_DEFAUT } from '../domain/config'
import { profilVide } from '../domain/profil'
import type { Diagnostic, Profil, Progression, Reglages, ResultatAnalyse } from '../domain/types'
import type { Transport } from '../pipeline/llm'
import { sonderProxy } from '../pipeline/sante'
import type { SanteProxy } from '../pipeline/sante'
import { REGLAGES_VIDES, chargerDiagnostics, chargerProfil, chargerReglages } from '../storage/local'

export type Ecran =
  | 'accueil'
  | 'cadrage'
  | 'analyse'
  | 'diagnostic'
  | 'profil'
  | 'exercice'
  | 'prof'
  | 'reglages'
  | 'apropos'

export const ECRANS: Ecran[] = [
  'accueil',
  'cadrage',
  'analyse',
  'diagnostic',
  'profil',
  'exercice',
  'prof',
  'reglages',
  'apropos',
]

export type Etat = {
  ecran: Ecran
  diagnostics: Diagnostic[]
  profil: Profil
  reglages: Reglages
  resultat: ResultatAnalyse | null
  progression: Progression[]
  erreur: string | null
  occupe: boolean
  /** Identifiant de la copie de démo en cours, null en analyse réelle. */
  demoId: string | null
  /** Santé du proxy : ok / ko (repli démo proposé) / inconnue. */
  santeProxy: SanteProxy
}

export function ecranDepuisUrl(): Ecran {
  const demande = new URLSearchParams(window.location.search).get('ecran')
  return ECRANS.includes(demande as Ecran) ? (demande as Ecran) : 'accueil'
}

export function etatInitial(): Etat {
  return {
    ecran: ecranDepuisUrl(),
    diagnostics: [],
    profil: profilVide(),
    reglages: REGLAGES_VIDES,
    resultat: null,
    progression: [],
    erreur: null,
    occupe: false,
    demoId: null,
    santeProxy: 'inconnue',
  }
}

/** Transport effectif : proxy edge, ou clé personnelle si elle est fournie. */
export function transportDe(reglages: Reglages): Transport {
  return {
    proxy: reglages.proxy.trim() || PROXY_PAR_DEFAUT,
    modele: reglages.modele.trim() || MODELE_PAR_DEFAUT,
    ...(reglages.clePersonnelle.trim() ? { cle: reglages.clePersonnelle.trim() } : {}),
  }
}

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : 'Analyse impossible. Réessaie dans un instant.'
}

/** Réseau ou amont épuisé : c'est le signal qui allume la pastille « ko ». */
export function amontMort(erreur: unknown): boolean {
  const statut = erreur instanceof Error && 'statut' in erreur ? (erreur as { statut: number }).statut : 0
  return [0, 502, 503, 504].includes(statut)
}

/** Remplace l'état d'une étape dans la liste (une ligne par étape, pas un journal). */
export function fusionner(liste: Progression[], nouvelle: Progression): Progression[] {
  return [...liste.filter((p) => p.etape !== nouvelle.etape), nouvelle]
}

export type Modificateur = (precedent: Etat) => Etat

export function useEtatRature() {
  const [etat, setEtat] = useState<Etat>(etatInitial)

  useEffect(() => {
    void (async () => {
      const [diagnostics, profil, reglages] = await Promise.all([
        chargerDiagnostics(),
        chargerProfil(),
        chargerReglages(),
      ])
      setEtat((precedent) => ({ ...precedent, diagnostics, profil, reglages }))
    })()
  }, [])

  // Sonde du proxy au chargement puis à chaque changement d'adresse. On sonde
  // l'adresse EFFECTIVE (repli inclus) : la valeur brute des réglages est vide
  // tant que l'utilisateur n'a rien saisi.
  const proxyActif = transportDe(etat.reglages).proxy
  useEffect(() => {
    void sonderProxy(proxyActif).then((santeProxy) => {
      setEtat((precedent) => ({ ...precedent, santeProxy }))
    })
  }, [proxyActif])

  const aller = useCallback((ecran: Ecran) => {
    setEtat((precedent) => ({ ...precedent, ecran }))
    const url = new URL(window.location.href)
    url.searchParams.set('ecran', ecran)
    window.history.replaceState({}, '', url)
  }, [])

  return { etat, setEtat, aller }
}
