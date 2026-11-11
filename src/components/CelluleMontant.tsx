import { analyserMontant, format } from '../lib/format'

type Props = {
  valeur: number | null
  nullable?: boolean // true : case vide = pas de valeur (ex. montant réel)
  largeur?: string
  onValider: (valeur: number | null) => void
  onInvalide: () => void
}

export default function CelluleMontant({
  valeur,
  nullable = false,
  largeur = 'w-28',
  onValider,
  onInvalide,
}: Props) {
  const affiche = valeur === null || (valeur === 0 && !nullable) ? '' : format(valeur)

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
      className={`${largeur} px-2 py-1.5 text-right tabular-nums bg-transparent border border-transparent rounded-lg hover:border-bord focus:bg-white focus:border-marine focus:ring-2 focus:ring-marine/20 outline-none`}
    />
  )
}