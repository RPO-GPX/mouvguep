import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { NATURES_DEPENSE, type DepenseBrq, type LigneBrq } from '../lib/calculsBrq'

export type BrqComplet = {
  id: string
  numero: number
  reference: string
  statut: 'brouillon' | 'valide'
  prepare_par: string | null
  valide_par: string | null
  recu_par: string | null
  recu_le: string | null
  lignes: LigneBrq[]
  depenses: DepenseBrq[]
}

export function useBrq(agenceId: string | null, date: string) {
  return useQuery({
    queryKey: ['brq', agenceId, date],
    enabled: !!agenceId && !!date,
    queryFn: async (): Promise<BrqComplet | null> => {
      const { data: brq, error } = await supabase
        .from('brq')
        .select('*')
        .eq('agence_id', agenceId!)
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      if (!brq) return null

      const [l, d] = await Promise.all([
        supabase.from('brq_lignes').select('*').eq('brq_id', brq.id).order('position'),
        supabase.from('brq_depenses').select('*').eq('brq_id', brq.id),
      ])
      if (l.error) throw l.error
      if (d.error) throw d.error

      const lignes: LigneBrq[] = (l.data ?? []).map((r) => ({
        id: r.id,
        position: Number(r.position ?? 0),
        agent_nom: r.agent_nom ?? '',
        n_recolte: r.n_recolte ?? '',
        nbre_cmd: Number(r.nbre_cmd ?? 0),
        nbre_cmd_sd: Number(r.nbre_cmd_sd ?? 0),
        pu_ram: Number(r.pu_ram ?? 0),
        montant_recolte: Number(r.montant_recolte ?? 0),
        n_track: r.n_track ?? '',
        mode_facturation: r.mode_facturation ?? null,
        destination: r.destination ?? '',
        montant_sp_rpe: Number(r.montant_sp_rpe ?? 0),
        n_facture: r.n_facture ?? '',
        mode_paiement: r.mode_paiement ?? null,
        n_cheque: r.n_cheque ?? '',
        montant_especes: Number(r.montant_especes ?? 0),
      }))

      const depenses: DepenseBrq[] = (d.data ?? [])
        .map((r) => ({ id: r.id, nature: r.nature, montant: Number(r.montant ?? 0) }) as DepenseBrq)
        .sort((a, b) => NATURES_DEPENSE.indexOf(a.nature) - NATURES_DEPENSE.indexOf(b.nature))

      return {
        id: brq.id,
        numero: Number(brq.numero),
        reference: brq.reference ?? '',
        statut: brq.statut,
        prepare_par: brq.prepare_par ?? null,
        valide_par: brq.valide_par ?? null,
        recu_par: brq.recu_par ?? null,
        recu_le: brq.recu_le ?? null,
        lignes,
        depenses,
      }
    },
  })
}