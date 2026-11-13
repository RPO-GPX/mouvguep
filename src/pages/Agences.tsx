import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { analyserMontant, format } from '../lib/format'
import { useConfirmer } from '../components/ConfirmProvider'

type AgenceAdmin = {
  id: string
  nom: string
  region: string | null
  code: string | null
  seuil_alerte: number
  actif: boolean
}

const REGIONS = ['Est', 'Ouest', 'Centre', 'Sud']

export default function Agences() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const confirmer = useConfirmer()

  const [nom, setNom] = useState('')
  const [region, setRegion] = useState('Est')
  const [seuil, setSeuil] = useState('1000000')
  const [edition, setEdition] = useState<AgenceAdmin | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [filtreRegion, setFiltreRegion] = useState('')
  const [statut, setStatut] = useState<'toutes' | 'actives' | 'desactivees'>('toutes')

  const { data: agences = [], isLoading, error } = useQuery({
    queryKey: ['agences-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agences')
        .select('id, nom, region, code, seuil_alerte, actif')
        .order('nom')
      if (error) throw error
      return (data ?? []).map((a) => ({ ...a, seuil_alerte: Number(a.seuil_alerte) })) as AgenceAdmin[]
    },
  })

  const viderFormulaire = () => {
    setNom('')
    setRegion('Est')
    setSeuil('1000000')
    setEdition(null)
  }

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['agences'] })
    return queryClient.invalidateQueries({ queryKey: ['agences-admin'] })
  }

  const traduire = (m: string) =>
    m.toLowerCase().includes('duplicate') ? 'Une agence porte déjà ce nom.' : m

  const enregistrer = useMutation({
    mutationFn: async (v: { id?: string; nom: string; region: string; seuil: number }) => {
      if (v.id) {
        const { error } = await supabase
          .from('agences')
          .update({ nom: v.nom, seuil_alerte: v.seuil })
          .eq('id', v.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('agences')
          .insert({ nom: v.nom, region: v.region, seuil_alerte: v.seuil })
        if (error) throw error
      }
    },
    onSuccess: () => {
      setMessage(null)
      viderFormulaire()
      return rafraichir()
    },
    onError: (e: Error) => setMessage(traduire(e.message)),
  })

  const basculer = useMutation({
    mutationFn: async (a: AgenceAdmin) => {
      const { error } = await supabase.from('agences').update({ actif: !a.actif }).eq('id', a.id)
      if (error) throw error
    },
    onSuccess: () => {
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(traduire(e.message)),
  })

  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  function valider(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const n = nom.trim()
    if (!n) {
      setMessage("Le nom de l'agence est obligatoire.")
      return
    }
    const s = analyserMontant(seuil)
    if (s === undefined || s === null || s <= 0) {
      setMessage("Seuil d'alerte invalide : utilise uniquement des chiffres.")
      return
    }
    enregistrer.mutate({ id: edition?.id, nom: n, region, seuil: s })
  }

  function commencerEdition(a: AgenceAdmin) {
    setEdition(a)
    setNom(a.nom)
    setRegion(a.region ?? 'Est')
    setSeuil(String(a.seuil_alerte))
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const t = recherche.trim().toLowerCase()
  const liste = agences.filter(
    (a) =>
      (!t || a.nom.toLowerCase().includes(t) || (a.code ?? '').toLowerCase().includes(t)) &&
      (!filtreRegion || a.region === filtreRegion) &&
      (statut === 'toutes' || (statut === 'actives' ? a.actif : !a.actif)),
  )
  const nbActives = agences.filter((a) => a.actif).length

  const etiquette = 'block text-xs font-bold text-doux mb-1'
  const lienAction = 'text-xs font-bold text-marine underline underline-offset-2'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Agences</h1>
        <p className="text-sm font-semibold text-doux">
          {nbActives} agence{nbActives > 1 ? 's' : ''} active{nbActives > 1 ? 's' : ''} sur{' '}
          {agences.length}
        </p>
      </header>

      <form onSubmit={valider} autoComplete="off" className="carte p-5 space-y-4">
        <h2 className="font-extrabold">
          {edition ? `Modifier : ${edition.nom} (${edition.code ?? '—'})` : 'Nouvelle agence'}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={etiquette}>Nom de l'agence</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="champ font-medium"
            />
          </div>
          <div>
            <label className={etiquette}>Région</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={!!edition}
              className="champ font-medium disabled:bg-entete"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiquette}>Seuil d'alerte de versement (DA)</label>
            <input
              value={seuil}
              inputMode="decimal"
              onChange={(e) => setSeuil(e.target.value)}
              className="champ font-medium"
            />
          </div>
        </div>
        {!edition && (
          <p className="text-xs text-doux">
            Le code de l'agence (par exemple E25) est créé automatiquement et ne change plus.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={enregistrer.isPending} className="btn btn-rouge">
            {edition ? 'Enregistrer' : "Ajouter l'agence"}
          </button>
          {edition && (
            <button type="button" onClick={viderFormulaire} className="btn btn-clair">
              Annuler
            </button>
          )}
          {message && <span className="text-sm font-semibold text-[#b4232f]">{message}</span>}
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={etiquette}>Rechercher</label>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou code"
            className="champ w-64 h-10 font-medium"
          />
        </div>
        <div>
          <label className={etiquette}>Région</label>
          <select
            value={filtreRegion}
            onChange={(e) => setFiltreRegion(e.target.value)}
            className="champ w-auto h-10 font-medium"
          >
            <option value="">Toutes</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiquette}>Statut</label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as typeof statut)}
            className="champ w-auto h-10 font-medium"
          >
            <option value="toutes">Toutes</option>
            <option value="actives">Actives</option>
            <option value="desactivees">Désactivées</option>
          </select>
        </div>
        <span className="text-sm font-semibold text-doux pb-2.5">{liste.length} agence(s)</span>
      </div>

      {isLoading && <p className="text-doux">Chargement…</p>}
      {error && <p className="text-[#b4232f]">Erreur : {error.message}</p>}

      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr>
              <th className="text-left">Code</th>
              <th className="text-left">Agence</th>
              <th className="text-left">Région</th>
              <th>Seuil d'alerte (DA)</th>
              <th className="text-left">Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.id} className={a.actif ? 'hover:bg-[#f9faff]' : 'bg-[#f7f8fc] text-doux'}>
                <td className="font-mono text-xs">{a.code ?? '—'}</td>
                <td className="font-bold">{a.nom}</td>
                <td>{a.region ?? '—'}</td>
                <td className="text-right tabular-nums">{format(a.seuil_alerte)}</td>
                <td>
                  {a.actif ? (
                    <span className="puce puce-ok">Active</span>
                  ) : (
                    <span className="puce puce-alerte">Désactivée</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-4">
                    <button onClick={() => commencerEdition(a)} className={lienAction}>
                      Modifier
                    </button>
                    <button
                                            onClick={async () => {
                        const ok = await confirmer({
                          titre: a.actif
                            ? `Désactiver l'agence ${a.nom} ?`
                            : `Réactiver l'agence ${a.nom} ?`,
                          message: a.actif
                            ? 'Elle disparaîtra des listes et des tableaux de bord, et plus personne (sauf toi) ne pourra y saisir. Ses données sont conservées.'
                            : undefined,
                          confirmer: a.actif ? 'Désactiver' : 'Réactiver',
                          danger: a.actif,
                        })
                        if (ok) basculer.mutate(a)
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
    </div>
  )
}