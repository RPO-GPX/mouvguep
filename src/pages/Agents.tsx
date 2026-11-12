import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { useAgents, type Agent } from '../hooks/useAgents'

export default function Agents() {
  const { profile } = useAuth()
  const { agence } = useAgence()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [nom, setNom] = useState('')
  const [edition, setEdition] = useState<Agent | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { data: agents = [], isLoading, error } = useAgents(agence?.id ?? null)

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ['agents', agence?.id] })

  const viderFormulaire = () => {
    setNom('')
    setEdition(null)
  }

  const enregistrer = useMutation({
    mutationFn: async (v: { id?: string; nom: string }) => {
      if (v.id) {
        const { error } = await supabase.from('agents').update({ nom: v.nom }).eq('id', v.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('agents').insert({ agence_id: agence!.id, nom: v.nom })
        if (error) throw error
      }
    },
    onSuccess: () => {
      setMessage(null)
      viderFormulaire()
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  const basculer = useMutation({
    mutationFn: async (a: Agent) => {
      const { error } = await supabase.from('agents').update({ actif: !a.actif }).eq('id', a.id)
      if (error) throw error
    },
    onSuccess: () => {
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  if (profile?.role !== 'agence' && profile?.role !== 'admin') return <Navigate to="/" replace />
  if (!agence) return <p className="text-doux">Chargement…</p>

  function valider(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const n = nom.trim()
    if (!n) {
      setMessage("Indique le nom de l'agent.")
      return
    }
    if (agents.some((a) => a.nom.toLowerCase() === n.toLowerCase() && a.id !== edition?.id)) {
      setMessage('Un agent porte déjà ce nom dans cette agence.')
      return
    }
    enregistrer.mutate({ id: edition?.id, nom: n })
  }

  const nbActifs = agents.filter((a) => a.actif).length
  const lienAction = 'text-xs font-bold text-marine underline underline-offset-2'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-doux">{agence.nom}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Agents</h1>
          <p className="text-sm font-semibold text-doux">
            {nbActifs} agent{nbActifs > 1 ? 's' : ''} actif{nbActifs > 1 ? 's' : ''} : ils
            apparaissent dans la liste de sélection du BRQ.
          </p>
        </div>
        <button onClick={() => navigate('/brq')} className="btn btn-clair">
          ← Retour au BRQ
        </button>
      </header>

      <form onSubmit={valider} autoComplete="off" className="carte p-5 space-y-3">
        <h2 className="font-extrabold">{edition ? `Renommer : ${edition.nom}` : 'Nouvel agent'}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-doux">
            Nom de l'agent
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="champ w-72 mt-1 font-medium"
            />
          </label>
          <button type="submit" disabled={enregistrer.isPending} className="btn btn-rouge">
            {edition ? 'Enregistrer' : "Ajouter l'agent"}
          </button>
          {edition && (
            <button type="button" onClick={viderFormulaire} className="btn btn-clair">
              Annuler
            </button>
          )}
        </div>
        {message && <p className="text-sm font-semibold text-[#b4232f]">{message}</p>}
        {edition && (
          <p className="text-xs text-doux">
            Renommer un agent ne change pas son nom sur les BRQ déjà saisis.
          </p>
        )}
      </form>

      {isLoading && <p className="text-doux">Chargement…</p>}
      {error && <p className="text-[#b4232f]">Erreur : {error.message}</p>}

      {agents.length === 0 && !isLoading ? (
        <p className="text-doux">Aucun agent pour cette agence. Ajoute le premier ci-dessus.</p>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead>
              <tr>
                <th className="text-left">Nom</th>
                <th className="text-left">Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className={a.actif ? 'hover:bg-[#f9faff]' : 'bg-[#f7f8fc] text-doux'}>
                  <td className="font-bold">{a.nom}</td>
                  <td>
                    {a.actif ? (
                      <span className="puce puce-ok">Actif</span>
                    ) : (
                      <span className="puce puce-neutre">Désactivé</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          setEdition(a)
                          setNom(a.nom)
                          setMessage(null)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={lienAction}
                      >
                        Renommer
                      </button>
                      <button
                        onClick={() => {
                          if (
                            !a.actif ||
                            window.confirm(
                              `Désactiver ${a.nom} ? Il n'apparaîtra plus dans la liste du BRQ, mais restera sur les BRQ déjà saisis.`,
                            )
                          )
                            basculer.mutate(a)
                        }}
                        className={`text-xs font-bold underline underline-offset-2 ${
                          a.actif ? 'text-[#b4232f]' : 'text-[#17653f]'
                        }`}
                      >
                        {a.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}