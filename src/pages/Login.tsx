import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErreur('E-mail ou mot de passe incorrect.')
    setEnCours(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <section className="relative overflow-hidden bg-marine text-white p-8 lg:p-14 lg:flex-[1.1] flex flex-col justify-between gap-10">
        <div
          className="hidden lg:block absolute -right-36 -bottom-36 w-[420px] h-[420px] rounded-full bg-rouge opacity-90"
          aria-hidden="true"
        />
        <div className="relative self-start bg-white rounded-2xl px-5 py-3">
          <img src="/logo-guepex.png" alt="GUEPEX Express Delivery" className="h-10 w-auto" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight mb-3">
            Gestion des mouvements de caisse
          </h2>
          <p className="text-[#d5d9ee] leading-relaxed">
            Le BRQ du jour, la caisse de chaque agence et leur contrôle, au même endroit.
          </p>
        </div>
        <p className="relative text-sm text-[#d5d9ee]">SPA GUEPEX · Express Delivery</p>
      </section>

      <section className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={handleSubmit} className="carte w-full max-w-sm p-9 flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-extrabold">Connexion</h1>
            <p className="text-sm text-doux mt-1.5">
              Entre avec le compte fourni par l'administrateur.
            </p>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.com"
              className="champ h-12 font-medium"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Mot de passe
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="champ h-12 font-medium"
            />
          </label>

          {erreur && <p className="text-sm font-semibold text-[#b4232f]">{erreur}</p>}

          <button type="submit" disabled={enCours} className="btn btn-rouge h-12 text-base">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </section>
    </div>
  )
}