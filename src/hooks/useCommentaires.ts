import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { finDeMois } from '../lib/dates'

export type Commentaire = {
  id: string
  date: string
  champ: string
  texte: string
  auteur_nom: string | null
  auteur_role: string | null
  cree_le: string
}

export const cleCommentaire = (date: string, champ: string) => `${date}|${champ}`

// Commentaires d'une agence pour un mois : « date|champ » -> liste
export function useCommentaires(agenceId: string | null, mois: string) {
  return useQuery({
    queryKey: ['commentaires', agenceId, mois],
    enabled: !!agenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commentaires_mouvement')
        .select('id, date, champ, texte, auteur_nom, auteur_role, cree_le')
        .eq('agence_id', agenceId!)
        .gte('date', mois + '-01')
        .lte('date', finDeMois(mois))
        .order('cree_le')
      if (error) throw error
      const m = new Map<string, Commentaire[]>()
      for (const r of (data ?? []) as Commentaire[]) {
        const k = cleCommentaire(r.date, r.champ)
        m.set(k, [...(m.get(k) ?? []), r])
      }
      return m
    },
  })
}