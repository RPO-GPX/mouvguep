export type Mouvement = {
  date: string // format AAAA-MM-JJ
  // Débit (entrées)
  recu_cash: number
  retire_par_cheque: number
  brq: number
  recolte_non_envoyee: number
  pmt: number
  // Crédit (sorties)
  depense: number
  tpe: number
  pmt_vendeur: number
  transfert_interne: number
  v_bancaire: number
  // Clôture
  montant_reel: number | null
  solde_ouverture: number | null
  jour_repos: boolean
}

export type LigneCalculee = Mouvement & {
  dispo: number
  total_debit: number
  total_credit: number
  reste: number
  alerte: boolean
  ecart_manque: number
  ecart_surplus: number
}

const arrondi = (n: number) => Math.round(n * 100) / 100

export function calculerMouvements(
  mouvements: Mouvement[],
  seuilAlerte = 1_000_000,
): LigneCalculee[] {
  const tries = [...mouvements].sort((a, b) => a.date.localeCompare(b.date))
  let resteVeille = 0
  let recolteVeille = 0

  return tries.map((m, i) => {
    // Premier jour : solde d'ouverture. Ensuite : reste de la veille.
    const dispo = i === 0 ? (m.solde_ouverture ?? 0) : resteVeille
    const repos = m.jour_repos

    const total_debit = repos
      ? 0
      : arrondi(m.recu_cash + m.retire_par_cheque + m.brq + m.recolte_non_envoyee + m.pmt + m.tpe)
    const total_credit = repos
      ? 0
      : arrondi(m.depense + m.pmt_vendeur + m.transfert_interne + m.v_bancaire)

    // La récolte non envoyée de la veille sort de la caisse le lendemain
    const reste = arrondi(dispo + total_debit - total_credit - recolteVeille)

    const ecart = m.montant_reel === null ? 0 : arrondi(m.montant_reel - reste)

    resteVeille = reste
    recolteVeille = repos ? 0 : m.recolte_non_envoyee

    return {
      ...m,
      dispo,
      total_debit,
      total_credit,
      reste,
      alerte: reste >= seuilAlerte,
      ecart_manque: ecart < 0 ? -ecart : 0,
      ecart_surplus: ecart > 0 ? ecart : 0,
    }
  })
}