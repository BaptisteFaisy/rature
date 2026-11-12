import { LienExterne } from './LienExterne'

export type Lien = { etiquette: string; href: string; detail: string }

type Props = { lien: Lien }

/** Une ligne de la section liens : intitulé cliquable + ce qu'on y trouve. */
export function LigneLien({ lien }: Props) {
  return (
    <li className="rounded-lg border border-bord bg-surface-2 p-3">
      <LienExterne href={lien.href} classe="text-base font-medium text-jaune underline underline-offset-4">
        {lien.etiquette}
      </LienExterne>
      <p className="mt-1 text-xs text-muet">{lien.detail}</p>
    </li>
  )
}
