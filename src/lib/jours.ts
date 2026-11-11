import type { Mouvement } from './calculs'
import { ajouterJours, jourSemaine } from './dates'

export function completerJours(existants: Mouvement[], dateFin: string): Mouvement[] {
  if (existants.length === 0) return []
  const parDate = new Map(existants.map((m) => [m.date, m]))
  const dates = existants.map((m) => m.date).sort()
  const debut = dates[0]
  const derniere = dates[dates.length - 1]
  const fin = derniere > dateFin ? derniere : dateFin

  const resultat: Mouvement[] = []
  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) {
    resultat.push(
      parDate.get(d) ?? {
        date: d,
        recu_cash: 0,
        retire_par_cheque: 0,
        brq: 0,
        recolte_non_envoyee: 0,
        pmt: 0,
        depense: 0,
        tpe: 0,
        pmt_vendeur: 0,
        transfert_interne: 0,
        v_bancaire: 0,
        montant_reel: null,
        solde_ouverture: null,
        jour_repos: jourSemaine(d) === 5,
      },
    )
  }
  return resultat
}