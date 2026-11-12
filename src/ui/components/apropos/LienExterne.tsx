import type { ReactNode } from 'react'

type Props = { href: string; children: ReactNode; classe?: string }

const CLASSE_PAR_DEFAUT = 'text-jaune underline underline-offset-4 hover:brightness-110'

/** Lien sortant unique du produit : nouvel onglet, référent masqué, focus visible. */
export function LienExterne({ href, children, classe = CLASSE_PAR_DEFAUT }: Props) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={classe}>
      {children}
    </a>
  )
}
