import { analyserMontant, format } from '../lib/format'

type Props = {
  valeur: number | null
  nullable?: boolean // true : case vide = pas de valeur (ex. montant réel)
  largeur?: string
  plein?: boolean // true : remplit la cellule du tableau, texte aligné avec le titre de la colonne
  classe?: string
  onValider: (valeur: number | null) => void
  onInvalide: () => void
}

export default function CelluleMontant({
  valeur,
  nullable = false,
  largeur = 'w-28',
  plein = false,
  classe = '',
  onValider,
  onInvalide,
}: Props) {
  const affiche = valeur === null || (valeur === 0 && !nullable) ? '' : format(valeur)

  // plein : même marge que les titres du tableau (0,85 rem moins la bordure de 1 px)
  const forme = plein
    ? 'block w-full h-9 px-[calc(0.85rem-1px)] rounded-md'
    : `${largeur} px-2 py-1.5 rounded-lg`

  return (
    <input
      key={affiche}
      type="text"
      inputMode="decimal"
      defaultValue={affiche}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      onBlur={(e) => {
        const n = analyserMontant(e.target.value)
        if (n === undefined || (n !== null && n < 0)) {
          e.target.value = affiche
          onInvalide()
          return
        }
        const nouveau = nullable ? n : (n ?? 0)
        if (nouveau === valeur) return
        onValider(nouveau)
      }}
      className={`${forme} text-right tabular-nums bg-transparent border border-transparent hover:border-bord focus:bg-white focus:border-marine focus:ring-2 focus:ring-marine/20 outline-none ${classe}`}
    />
  )
}