import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variante?: 'principal' | 'secondaire' | 'discret'
  disabled?: boolean
  pleineLargeur?: boolean
}

const CLASSES: Record<NonNullable<Props['variante']>, string> = {
  principal:
    'bg-jaune text-fond font-semibold hover:brightness-110 active:brightness-95 disabled:opacity-40',
  secondaire:
    'bg-surface-2 text-texte border border-bord hover:border-jaune disabled:opacity-40',
  discret: 'bg-transparent text-muet hover:text-texte underline underline-offset-4',
}

/** Bouton unique du produit : grosses cibles, contraste AA, focus visible. */
export function Bouton({
  children,
  onClick,
  type = 'button',
  variante = 'principal',
  disabled = false,
  pleineLargeur = false,
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-h-12 rounded-xl px-5 py-3 text-base transition',
        CLASSES[variante],
        pleineLargeur ? 'w-full' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
