export const NATURES_DEPENSE = ['Paiement Vendeurs', 'Paiement Freelance', 'Divers'] as const
export type NatureDepense = (typeof NATURES_DEPENSE)[number]

export type LigneBrq = {
  id: string
  position: number
  agent_nom: string
  n_recolte: string
  nbre_cmd: number
  nbre_cmd_sd: number
  pu_ram: number
  montant_recolte: number
  n_track: string
  mode_facturation: string | null
  destination: string
  montant_sp_rpe: number
  n_facture: string
  mode_paiement: string | null
  n_cheque: string
  montant_especes: number
}

export type DepenseBrq = { id: string; nature: NatureDepense; montant: number }

const arrondi = (n: number) => Math.round(n * 100) / 100

// Total d'une ligne = montant récolte + montant encaissé espèces (hors desk classic)
export const totalLigne = (l: LigneBrq) => arrondi(l.montant_recolte + l.montant_especes)

export function calculerBrq(lignes: LigneBrq[], depenses: DepenseBrq[]) {
  const somme = (f: (l: LigneBrq) => number) =>
    arrondi(lignes.reduce((s, l) => s + f(l), 0))

  const total_ecommerce = somme((l) => l.montant_recolte)
  const total_desk_classic = somme((l) => l.montant_sp_rpe)
  const total_factures = somme((l) => l.montant_especes)
  const total_recettes = arrondi(total_ecommerce + total_factures)

  const total_depenses = arrondi(depenses.reduce((s, d) => s + d.montant, 0))
  const paiement_vendeurs = arrondi(
    depenses.filter((d) => d.nature === 'Paiement Vendeurs').reduce((s, d) => s + d.montant, 0),
  )

  const cheques = lignes.filter((l) => l.mode_paiement === 'Chèque')

  return {
    total_ecommerce,
    total_desk_classic,
    total_factures,
    total_recettes,
    total_depenses,
    paiement_vendeurs,
    reste_especes: arrondi(total_recettes - total_depenses),
    nbre_cheques: cheques.length,
    total_cheques: arrondi(cheques.reduce((s, l) => s + l.montant_especes, 0)),
  }
}