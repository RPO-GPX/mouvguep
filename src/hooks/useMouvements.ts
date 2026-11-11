import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Mouvement } from '../lib/calculs'

const num = (v: unknown) => Number(v ?? 0)
const numOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function chargerMouvements(agenceId: string): Promise<Mouvement[]> {
  const { data, error } = await supabase
    .from('mouvements_caisse')
    .select('*')
    .eq('agence_id', agenceId)
    .order('date')
  if (error) throw error
  return (data ?? []).map((r) => ({
    date: r.date as string,
    recu_cash: num(r.recu_cash),
    retire_par_cheque: num(r.retire_par_cheque),
    brq: num(r.brq),
    recolte_non_envoyee: num(r.recolte_non_envoyee),
    pmt: num(r.pmt),
    depense: num(r.depense),
    tpe: num(r.tpe),
    pmt_vendeur: num(r.pmt_vendeur),
    transfert_interne: num(r.transfert_interne),
    v_bancaire: num(r.v_bancaire),
    montant_reel: numOuNull(r.montant_reel),
    solde_ouverture: numOuNull(r.solde_ouverture),
    jour_repos: Boolean(r.jour_repos),
  }))
}

export function useMouvements(agenceId: string | null) {
  return useQuery({
    queryKey: ['mouvements', agenceId],
    enabled: !!agenceId,
    queryFn: () => chargerMouvements(agenceId!),
  })
}