type Props = { ancre: string; titre: string }

/** Lien interne du sommaire : ancre `#` vers une section du même écran. */
export function LienSommaire({ ancre, titre }: Props) {
  return (
    <a
      href={`#${ancre}`}
      className="text-sm text-jaune underline underline-offset-4 hover:brightness-110"
    >
      {titre}
    </a>
  )
}
