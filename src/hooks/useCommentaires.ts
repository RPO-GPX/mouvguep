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

// Commentaires d'une agence pour un mois, classés par case (date|champ) et par jour
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

      const parCase = new Map<string, Commentaire[]>()
      const parJour = new Map<string, Commentaire[]>()
      for (const r of (data ?? []) as Commentaire[]) {
        const k = cleCommentaire(r.date, r.champ)
        parCase.set(k, [...(parCase.get(k) ?? []), r])
        parJour.set(r.date, [...(parJour.get(r.date) ?? []), r])
      }
      return { parCase, parJour }
    },
  })
}