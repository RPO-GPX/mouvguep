export const format = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatOuVide = (n: number) => (n === 0 ? '' : format(n))

// "1 655 625,50" → 1655625.5 ; vide → null ; texte invalide → undefined
export function analyserMontant(texte: string): number | null | undefined {
  const propre = texte.replace(/\s/g, '').replace(',', '.')
  if (propre === '') return null
  const n = Number(propre)
  return Number.isFinite(n) ? n : undefined
}