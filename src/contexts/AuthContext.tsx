import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  nom: string | null
  role: 'agence' | 'regional' | 'suivi' | 'admin'
  region: string | null
  agence_id: string | null
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

// Garde la session actuelle tant que c'est le même utilisateur :
// Supabase renvoie un événement à chaque retour sur l'onglet, il ne doit rien recharger.
const memeUtilisateur = (ancienne: Session | null, nouvelle: Session | null) =>
  ancienne?.user.id === nouvelle?.user.id ? ancienne : nouvelle

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // 1. Suivre la connexion / déconnexion
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession((ancienne) => memeUtilisateur(ancienne, data.session))
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nouvelle) => {
      setSession((ancienne) => memeUtilisateur(ancienne, nouvelle))
      if (!nouvelle) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 2. Charger le profil (nom, rôle, agence) quand l'utilisateur change, pas à chaque événement
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) return
    let annule = false
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (annule) return
        setProfile(data as Profile | null)
        setLoading(false)
      })
    return () => {
      annule = true
    }
  }, [userId])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}