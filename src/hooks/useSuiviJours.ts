import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type Verrou = { par: string | null; le: string | null }
export type StatutBrqJour = 'recu' | 'valide' | 'brouillon'

// Jours verrouillés d'une agence : date -> qui / quand
export function useVerrous(agenceId: string | null) {
  return useQuery({
    queryKey: ['verrous', agenceId],
    enabled: !!agenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mouvements_caisse')
        .select('date, verrouille_par, verrouille_le')
        .eq('agence_id', agenceId!)
        .eq('verrouille', true)
      if (error) throw error
      const m = new Map<string, Verrou>()
      for (const r of data ?? []) {
        m.set(r.date as string, { par: r.verrouille_par ?? null, le: r.verrouille_le ?? null })
      }
      return m
    },
  })
}

// État du BRQ de chaque jour : date -> brouillon / validé / reçu
export function useStatutsBrq(agenceId: string | null) {
  return useQuery({
    queryKey: ['statuts-brq', agenceId],
    enabled: !!agenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brq')
        .select('date, statut, recu_le')
        .eq('agence_id', agenceId!)
      if (error) throw error
      const m = new Map<string, StatutBrqJour>()
      for (const r of data ?? []) {
        m.set(r.date as string, r.recu_le ? 'recu' : (r.statut as 'valide' | 'brouillon'))
      }
      return m
    },
  })
}