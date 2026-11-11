import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { finDeMois } from '../lib/dates'

export const BUCKET_AVIS = 'avis-versement'

export type Avis = {
  id: string
  date: string
  chemin: string
  nom_fichier: string
  type_mime: string
  taille: number
  auteur_nom: string | null
  auteur_role: string | null
  cree_le: string
}

// Avis de versement d'une agence pour un mois : date -> liste
export function useAvis(agenceId: string | null, mois: string) {
  return useQuery({
    queryKey: ['avis', agenceId, mois],
    enabled: !!agenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avis_versement')
        .select('id, date, chemin, nom_fichier, type_mime, taille, auteur_nom, auteur_role, cree_le')
        .eq('agence_id', agenceId!)
        .gte('date', mois + '-01')
        .lte('date', finDeMois(mois))
        .order('cree_le')
      if (error) throw error
      const m = new Map<string, Avis[]>()
      for (const r of (data ?? []) as Avis[]) {
        m.set(r.date, [...(m.get(r.date) ?? []), r])
      }
      return m
    },
  })
}