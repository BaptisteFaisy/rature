type Props = { valeur: string; legende: string; source: string }

/** Un chiffre, sa légende, et surtout sa source : rien n'est avancé sans preuve. */
export function ChiffreCle({ valeur, legende, source }: Props) {
  return (
    <li className="rounded-xl border border-bord bg-surface-2 p-3">
      <p className="font-mono text-2xl font-semibold text-vert">{valeur}</p>
      <p className="mt-1 text-sm text-texte/90">{legende}</p>
      <p className="mt-1 text-xs text-muet">Source : {source}</p>
    </li>
  )
}
