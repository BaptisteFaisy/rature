import { useState } from 'react'
import { MODELE_PAR_DEFAUT, PROXY_PAR_DEFAUT } from '../../domain/config'
import type { Reglages as ReglagesType } from '../../domain/types'
import { Bouton } from '../components/Bouton'
import { PanneauSante } from '../components/PanneauSante'
import { Carte } from '../components/Carte'
import { useRature } from '../../etat/useRature'

const CHAMP = 'w-full rounded-lg border border-bord bg-surface-2 p-3 text-texte'

/** Écran 8 : BYOK, modèle, proxy, confidentialité, export et suppression. */
export function Reglages() {
  const { reglages, enregistrerReglages, viderHistorique, diagnostics } = useRature()
  const [brouillon, setBrouillon] = useState<ReglagesType>(reglages)
  const [confirme, setConfirme] = useState(false)

  const maj = (champ: keyof ReglagesType, valeur: string) => {
    setConfirme(false)
    setBrouillon({ ...brouillon, [champ]: valeur })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Réglages</h1>

      <Carte titre="Accès au modèle" ton="jaune">
        <p className="mb-3 text-sm text-muet">
          Par défaut, l’analyse passe par un proxy qui garde sa clé côté serveur. Si le quota du
          proxy est épuisé, colle ta propre clé InferHub (BYOK) : elle reste sur cet appareil.
        </p>
        <label className="mb-3 block text-sm text-texte" htmlFor="cle">
          Clé personnelle (BYOK)
          <input
            id="cle"
            type="password"
            autoComplete="off"
            className={`${CHAMP} mt-1 font-mono`}
            value={brouillon.clePersonnelle}
            placeholder="ih_…"
            onChange={(event) => maj('clePersonnelle', event.target.value)}
          />
        </label>
        <label className="mb-3 block text-sm text-texte" htmlFor="modele">
          Modèle
          <input
            id="modele"
            type="text"
            className={`${CHAMP} mt-1 font-mono`}
            value={brouillon.modele}
            placeholder={MODELE_PAR_DEFAUT}
            onChange={(event) => maj('modele', event.target.value)}
          />
        </label>
        <label className="block text-sm text-texte" htmlFor="proxy">
          Adresse du proxy
          <input
            id="proxy"
            type="text"
            className={`${CHAMP} mt-1 font-mono`}
            value={brouillon.proxy}
            placeholder={PROXY_PAR_DEFAUT}
            onChange={(event) => maj('proxy', event.target.value)}
          />
        </label>
      </Carte>

      <Bouton
        onClick={() => {
          void enregistrerReglages(brouillon)
          setConfirme(true)
        }}
      >
        {confirme ? 'Réglages enregistrés' : 'Enregistrer'}
      </Bouton>

      <PanneauSante />

      <Carte titre="Confidentialité" ton="vert">
        <ul className="list-inside list-disc space-y-1 text-sm text-muet">
          <li>Aucune copie n’est conservée : l’image est oubliée dès la fin de l’analyse.</li>
          <li>Le nom de l’élève est masqué avant tout affichage.</li>
          <li>L’historique reste sur cet appareil (IndexedDB), jamais sur un serveur.</li>
          <li>Le proxy ne journalise que l’horodatage et le code HTTP.</li>
        </ul>
      </Carte>

      <Carte titre="Mes données">
        <p className="mb-3 text-sm text-muet">
          {diagnostics.length} diagnostic(s) enregistré(s) sur cet appareil.
        </p>
        <Bouton
          variante="secondaire"
          onClick={() => {
            void viderHistorique()
          }}
        >
          Supprimer tout l’historique
        </Bouton>
      </Carte>
    </div>
  )
}
