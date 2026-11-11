import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type Agence = {
  id: string
  nom: string
  region: string | null
  seuil_alerte: number
  actif: boolean
}

type AgenceState = {
  agences: Agence[] // agences actives visibles pour l'utilisateur connecté
  agenceId: string | null
  agence: Agence | null
  setAgenceId: (id: string) => void
  // vrai si l'utilisateur peut réceptionner / verrouiller / déverrouiller
  peutControler: boolean
  // vrai quand la liste des agences est chargée
  chargees: boolean
}

const AgenceContext = createContext<AgenceState | undefined>(undefined)

export function AgenceProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [choix, setChoix] = useState<string | null>(null)

  const { data: toutes = [], isSuccess } = useQuery({
    queryKey: ['agences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agences')
        .select('*')
        .eq('actif', true)
        .order('nom')
      if (error) throw error
      return data as Agence[]
    },
  })

  let agences: Agence[] = []
  if (profile?.role === 'admin' || profile?.role === 'suivi') {
    agences = toutes
  } else if (profile?.role === 'regional') {
    agences = toutes.filter((a) => a.region !== null && a.region === profile.region)
  } else if (profile) {
    agences = toutes.filter((a) => a.id === profile.agence_id)
  }

  const agenceId =
    choix && agences.some((a) => a.id === choix) ? choix : (agences[0]?.id ?? null)
  const agence = agences.find((a) => a.id === agenceId) ?? null

  const peutControler = profile?.role === 'admin' || profile?.role === 'suivi'

  return (
    <AgenceContext.Provider
      value={{
        agences,
        agenceId,
        agence,
        setAgenceId: setChoix,
        peutControler,
        chargees: isSuccess,
      }}
    >
      {children}
    </AgenceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAgence() {
  const ctx = useContext(AgenceContext)
  if (!ctx) throw new Error('useAgence doit être utilisé dans AgenceProvider')
  return ctx
}