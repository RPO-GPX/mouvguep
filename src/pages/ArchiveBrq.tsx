import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { formatDate, nomJour } from '../lib/dates'
import { format } from '../lib/format'

type Statut = 'tous' | 'brouillon' | 'a_receptionner' | 'recu'

type LigneArchive = {
  id: string
  numero: number
  reference: string
  date: string
  agence_id: string
  statut: 'brouillon' | 'valide'
  prepare_par: string | null
  valide_par: string | null
  recu_par: string | null
  recu_le: string | null
  brq_lignes: { montant_recolte: number | null; montant_especes: number | null }[]
  brq_depenses: { montant: number | null }[]
}

const arrondi = (n: number) => Math.round(n * 100) / 100
const recettes = (l: LigneArchive) =>
  arrondi(
    l.brq_lignes.reduce(
      (s, x) => s + Number(x.montant_recolte ?? 0) + Number(x.montant_especes ?? 0),
      0,
    ),
  )
const depenses = (l: LigneArchive) =>
  arrondi(l.brq_depenses.reduce((s, x) => s + Number(x.montant ?? 0), 0))

const aujourdhui = new Date().toISOString().slice(0, 10)
const debutMois = aujourdhui.slice(0, 8) + '01'

function moisPrecedent(): [string, string] {
  const d = new Date(aujourdhui + 'T00:00:00Z')
  const debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))
  return [debut.toISOString().slice(0, 10), fin.toISOString().slice(0, 10)]
}

function Badge({ l }: { l: LigneArchive }) {
  if (l.recu_le) return <span className="puce puce-ok">Réceptionné</span>
  if (l.statut === 'valide') return <span className="puce puce-attente">À réceptionner</span>
  return <span className="puce puce-neutre">Brouillon</span>
}

export default function ArchiveBrq() {
  const { profile } = useAuth()
  const { agences, setAgenceId } = useAgence()
  const navigate = useNavigate()

  const [du, setDu] = useState(debutMois)
  const [au, setAu] = useState(aujourdhui)
  const [agenceFiltre, setAgenceFiltre] = useState('')
  const [statut, setStatut] = useState<Statut>('tous')

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['archive-brq', du, au, agenceFiltre, statut],
    queryFn: async () => {
      let q = supabase
        .from('brq')
        .select(
          'id, numero, reference, date, agence_id, statut, prepare_par, valide_par, recu_par, recu_le, brq_lignes(montant_recolte, montant_especes), brq_depenses(montant)',
        )
        .gte('date', du)
        .lte('date', au)
      if (agenceFiltre) q = q.eq('agence_id', agenceFiltre)
      if (statut === 'brouillon') q = q.eq('statut', 'brouillon')
      if (statut === 'a_receptionner') q = q.eq('statut', 'valide').is('recu_le', null)
      if (statut === 'recu') q = q.not('recu_le', 'is', null)
      const { data, error } = await q.order('date', { ascending: false }).limit(500)
      if (error) throw error
      return (data ?? []) as unknown as LigneArchive[]
    },
  })

  const nomAgence = (id: string) => agences.find((a) => a.id === id)?.nom ?? '—'
  const plusieursAgences = profile?.role !== 'agence'

  const ouvrir = (l: LigneArchive, page: string) => {
    setAgenceId(l.agence_id)
    navigate(page)
  }

  const totalRecettes = arrondi(data.reduce((s, l) => s + recettes(l), 0))
  const totalDepenses = arrondi(data.reduce((s, l) => s + depenses(l), 0))

  const etiquette = 'block text-xs font-bold text-doux mb-1'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Archive des BRQ</h1>
        <p className="text-sm font-semibold text-doux">Retrouve n'importe quel BRQ par date, agence ou statut.</p>
      </header>

      <div className="carte p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className={etiquette}>Du</label>
          <input
            type="date"
            value={du}
            max={au}
            onChange={(e) => e.target.value && setDu(e.target.value)}
            className="champ w-auto h-10 font-medium"
          />
        </div>
        <div>
          <label className={etiquette}>Au</label>
          <input
            type="date"
            value={au}
            min={du}
            onChange={(e) => e.target.value && setAu(e.target.value)}
            className="champ w-auto h-10 font-medium"
          />
        </div>

        {plusieursAgences && (
          <div>
            <label className={etiquette}>Agence</label>
            <select
              value={agenceFiltre}
              onChange={(e) => setAgenceFiltre(e.target.value)}
              className="champ w-auto min-w-52 h-10 font-medium"
            >
              <option value="">Toutes les agences</option>
              {agences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={etiquette}>Statut</label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as Statut)}
            className="champ w-auto h-10 font-medium"
          >
            <option value="tous">Tous</option>
            <option value="brouillon">Brouillon</option>
            <option value="a_receptionner">À réceptionner</option>
            <option value="recu">Réceptionné</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setDu(debutMois)
              setAu(aujourdhui)
            }}
            className="btn btn-clair !min-h-10"
          >
            Ce mois
          </button>
          <button
            onClick={() => {
              const [d, f] = moisPrecedent()
              setDu(d)
              setAu(f)
            }}
            className="btn btn-clair !min-h-10"
          >
            Mois précédent
          </button>
        </div>
      </div>

      {isLoading && <p className="text-doux">Chargement…</p>}
      {error && <p className="text-[#b4232f]">Erreur : {error.message}</p>}

      {!isLoading && !error && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="carte p-5">
              <p className="text-sm font-semibold text-doux">BRQ trouvés</p>
              <p className="text-2xl font-extrabold mt-1">{data.length}</p>
              {data.length === 500 && (
                <span className="puce puce-attente mt-2">Limité à 500 : réduis la période</span>
              )}
            </div>
            <div className="carte p-5">
              <p className="text-sm font-semibold text-doux">Recettes espèces</p>
              <p className="text-2xl font-extrabold mt-1 tabular-nums">
                {format(totalRecettes)} <span className="text-sm font-semibold text-doux">DA</span>
              </p>
            </div>
            <div className="carte p-5">
              <p className="text-sm font-semibold text-doux">Dépenses</p>
              <p className="text-2xl font-extrabold mt-1 tabular-nums">
                {format(totalDepenses)} <span className="text-sm font-semibold text-doux">DA</span>
              </p>
            </div>
          </section>

          {data.length === 0 ? (
            <p className="text-doux">Aucun BRQ pour ces critères.</p>
          ) : (
            <div className="carte overflow-x-auto">
              <table className="tableau">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    {plusieursAgences && <th className="text-left">Agence</th>}
                    <th className="text-left">Référence</th>
                    <th className="text-left">Statut</th>
                    <th>Recettes espèces</th>
                    <th>Dépenses</th>
                    <th>Net</th>
                    <th className="text-left">Préparé par</th>
                    <th className="text-left">Validé par</th>
                    <th className="text-left">Réceptionné par</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((l) => {
                    const r = recettes(l)
                    const d = depenses(l)
                    const net = arrondi(r - d)
                    return (
                      <tr key={l.id} className="hover:bg-[#f9faff]">
                        <td>
                          <span className="font-bold capitalize">{nomJour(l.date)}</span>{' '}
                          <span className="text-doux">{formatDate(l.date)}</span>
                        </td>
                        {plusieursAgences && <td className="font-bold">{nomAgence(l.agence_id)}</td>}
                        <td className="font-mono text-xs">{l.reference}</td>
                        <td>
                          <Badge l={l} />
                        </td>
                        <td className="text-right tabular-nums">{format(r)}</td>
                        <td className="text-right tabular-nums">{format(d)}</td>
                        <td
                          className={`text-right tabular-nums font-extrabold ${
                            net < 0 ? 'text-[#b4232f]' : ''
                          }`}
                        >
                          {format(net)}
                        </td>
                        <td>{l.prepare_par ?? '—'}</td>
                        <td>{l.valide_par ?? '—'}</td>
                        <td>
                          {l.recu_le ? (
                            <>
                              {l.recu_par ?? '—'}{' '}
                              <span className="text-xs text-doux">
                                {new Date(l.recu_le).toLocaleString('fr-FR')}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => ouvrir(l, `/brq?date=${l.date}`)}
                              className="btn btn-clair !min-h-8 !px-3 !text-xs"
                            >
                              Ouvrir
                            </button>
                            <button
                              onClick={() => ouvrir(l, `/brq/imprimer/${l.date}`)}
                              className="btn btn-clair !min-h-8 !px-3 !text-xs"
                            >
                              Imprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}