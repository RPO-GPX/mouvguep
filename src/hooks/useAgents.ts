import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type Agent = {
  id: string
  agence_id: string
  nom: string
  actif: boolean
}

export function useAgents(agenceId: string | null) {
  return useQuery({
    queryKey: ['agents', agenceId],
    enabled: !!agenceId,
    queryFn: async (): Promise<Agent[]> => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, agence_id, nom, actif')
        .eq('agence_id', agenceId!)
        .order('nom')
      if (error) throw error
      return (data ?? []) as Agent[]
    },
  })
}