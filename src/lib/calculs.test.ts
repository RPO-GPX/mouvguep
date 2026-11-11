import { describe, expect, it } from 'vitest'
import { calculerMouvements, type Mouvement } from './calculs'

const vide = {
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
  jour_repos: false,
}

const m = (date: string, p: Partial<Mouvement>): Mouvement => ({ ...vide, date, ...p })

describe('calculerMouvements', () => {
  it('reproduit le tableau Excel de janvier', () => {
    const lignes = calculerMouvements([
      m('2026-01-03', { solde_ouverture: 2608927.83, brq: 452152, recolte_non_envoyee: 326595, pmt_vendeur: 184499.5 }),
      m('2026-01-04', { brq: 1655625, recolte_non_envoyee: 64450, tpe: 87450, pmt_vendeur: 297647.1, v_bancaire: 3100000 }),
      m('2026-01-05', { brq: 1212705, recolte_non_envoyee: 109750, tpe: 9250, pmt_vendeur: 527461.5, v_bancaire: 1000000 }),
      m('2026-01-06', { brq: 1020270, recolte_non_envoyee: 49400, depense: 2000, tpe: 12250, pmt_vendeur: 457100, v_bancaire: 786000 }),
      m('2026-01-07', { brq: 870020, recolte_non_envoyee: 123190, tpe: 28400, pmt_vendeur: 17000, v_bancaire: 451000 }),
      m('2026-01-08', { brq: 1270215, recolte_non_envoyee: 256824, tpe: 7820, pmt_vendeur: 929199 }),
      m('2026-01-09', { jour_repos: true }),
    ])

    const attendu = [3203175.33, 1111558.23, 832851.73, 535421.73, 982831.73, 1449661.73, 1192837.73]
    lignes.forEach((l, i) => expect(l.reste).toBeCloseTo(attendu[i], 2))

    expect(lignes.map((l) => l.alerte)).toEqual([true, true, false, false, false, true, true])
  })

  it('calcule le manque et le surplus', () => {
    const [manque] = calculerMouvements([
      m('2026-01-03', { solde_ouverture: 1000, recu_cash: 500, montant_reel: 1400 }),
    ])
    expect(manque.reste).toBe(1500)
    expect(manque.ecart_manque).toBe(100)
    expect(manque.ecart_surplus).toBe(0)
  })
})