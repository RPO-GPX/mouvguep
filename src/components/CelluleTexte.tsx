type Props = {
  valeur: string | number | null
  largeur?: string
  droite?: boolean
  // retourner false pour refuser la valeur (la case reprend l'ancienne valeur)
  onValider: (valeur: string) => boolean
}

export default function CelluleTexte({ valeur, largeur = 'w-28', droite = false, onValider }: Props) {
  const affiche = valeur === null ? '' : String(valeur)

  return (
    <input
      key={affiche}
      type="text"
      defaultValue={affiche}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v === affiche) return
        if (!onValider(v)) e.target.value = affiche
      }}
      className={`${largeur} px-2 py-1.5 ${
        droite ? 'text-right tabular-nums' : ''
      } bg-transparent border border-transparent rounded-lg hover:border-bord focus:bg-white focus:border-marine focus:ring-2 focus:ring-marine/20 outline-none`}
    />
  )
}