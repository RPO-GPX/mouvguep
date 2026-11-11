import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence, type Agence } from '../contexts/AgenceContext'
import { chargerMouvements } from '../hooks/useMouvements'
import { calculerMouvements } from '../lib/calculs'
import { completerJours } from '../lib/jours'
import { ajouterJours, finDeMois, formatDate, jourSemaine, nomJour } from '../lib/dates'
import { format, formatOuVide } from '../lib/format'

type StatutBrq = 'recu' | 'valide' | 'brouillon' | null

type LigneAgence = {
  agence: Agence
  etat: { reste: number; alerte: boolean } | null
  derniereSaisie: string | null
  manque: number
  surplus: number
  brq: StatutBrq
  verrouille: boolean
}

const arrondi = (n: number) => Math.round(n * 100) / 100

export default function TableauDeBord() {
  const { profile } = useAuth()
  const { agences, setAgenceId } = useAgence()
  const navigate = useNavigate()

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const moisCourant = aujourdhui.slice(0, 7)
  const [dateRef, setDateRef] = useState(aujourdhui)

  // Même clé que la page Mouvement de caisse : les données sont partagées
  const resultats = useQueries({
    queries: agences.map((a) => ({
      queryKey: ['mouvements', a.id],
      queryFn: () => chargerMouvements(a.id),
    })),
  })

  const { data: brqJour = [] } = useQuery({
    queryKey: ['brq-jour', dateRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brq')
        .select('agence_id, statut, recu_le')
        .eq('date', dateRef)
      if (error) throw error
      return (data ?? []) as {
        agence_id: string
        statut: 'valide' | 'brouillon'
        recu_le: string | null
      }[]
    },
  })

  const { data: verrousJour = [] } = useQuery({
    queryKey: ['verrous-jour', dateRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mouvements_caisse')
        .select('agence_id')
        .eq('date', dateRef)
        .eq('verrouille', true)
      if (error) throw error
      return (data ?? []).map((r) => r.agence_id as string)
    },
  })

  if (!profile || profile.role === 'agence') return <Navigate to="/" replace />
  if (agences.length === 0 || resultats.some((r) => r.isLoading)) {
    return <p className="text-doux">Chargement…</p>
  }
  const erreur = resultats.find((r) => r.error)?.error
  if (erreur) return <p className="text-[#b4232f]">Erreur : {erreur.message}</p>

  const mois = dateRef.slice(0, 7)

  const lignes: LigneAgence[] = agences.map((agence, i) => {
    const existants = resultats[i]?.data ?? []
    const b = brqJour.find((x) => x.agence_id === agence.id)
    const brq: StatutBrq = b ? (b.recu_le ? 'recu' : b.statut) : null
    const verrouille = verrousJour.includes(agence.id)

    if (existants.length === 0) {
      return { agence, etat: null, derniereSaisie: null, manque: 0, surplus: 0, brq, verrouille }
    }

    const calcul = calculerMouvements(
      completerJours(existants, dateRef),
      Number(agence.seuil_alerte),
    )
    const jusqueLa = calcul.filter((l) => l.date <= dateRef)
    const courant = jusqueLa[jusqueLa.length - 1]
    const duMois = jusqueLa.filter((l) => l.date.startsWith(mois))
    const dates = existants
      .map((m) => m.date)
      .filter((d) => d <= dateRef)
      .sort()

    return {
      agence,
      etat: courant ? { reste: courant.reste, alerte: courant.alerte } : null,
      derniereSaisie: dates[dates.length - 1] ?? null,
      manque: arrondi(duMois.reduce((s, l) => s + l.ecart_manque, 0)),
      surplus: arrondi(duMois.reduce((s, l) => s + l.ecart_surplus, 0)),
      brq,
      verrouille,
    }
  })

  const vendredi = jourSemaine(dateRef) === 5
  const totalCaisse = arrondi(lignes.reduce((s, l) => s + (l.etat?.reste ?? 0), 0))
  const nbAlertes = lignes.filter((l) => l.etat?.alerte).length
  const nbDemarrees = lignes.filter((l) => l.etat !== null).length
  const nbRecus = lignes.filter((l) => l.brq === 'recu').length
  const nbAReceptionner = lignes.filter((l) => l.brq === 'valide').length
  const nbBrouillons = lignes.filter((l) => l.brq === 'brouillon').length
  const nbNonCrees = lignes.filter((l) => l.brq === null).length
  const nbVerrouilles = lignes.filter((l) => l.verrouille).length

  const choisirMois = (m: string) => {
    if (!m) return
    setDateRef(m >= moisCourant ? aujourdhui : finDeMois(m))
  }

  const ouvrir = (id: string, page: string) => {
    setAgenceId(id)
    navigate(page)
  }

  const etiquette = 'block text-xs font-bold text-doux mb-1'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="text-sm font-semibold text-doux">
          Situation au <span className="capitalize">{nomJour(dateRef)}</span> {formatDate(dateRef)}
        </p>
      </header>

      <div className="carte p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => setDateRef(ajouterJours(dateRef, -1))}
            className="btn btn-clair !min-h-10 !px-3"
            title="Jour précédent"
            aria-label="Jour précédent"
          >
            ◀
          </button>
          <div>
            <label className={etiquette}>Jour</label>
            <input
              type="date"
              value={dateRef}
              max={aujourdhui}
              onChange={(e) => {
                const v = e.target.value
                if (v) setDateRef(v > aujourdhui ? aujourdhui : v)
              }}
              className="champ w-auto h-10 font-medium"
            />
          </div>
          <button
            onClick={() => setDateRef(ajouterJours(dateRef, 1))}
            disabled={dateRef >= aujourdhui}
            className="btn btn-clair !min-h-10 !px-3"
            title="Jour suivant"
            aria-label="Jour suivant"
          >
            ▶
          </button>
        </div>

        <div>
          <label className={etiquette}>Mois (situation en fin de mois)</label>
          <input
            type="month"
            value={mois}
            max={moisCourant}
            onChange={(e) => choisirMois(e.target.value)}
            className="champ w-auto h-10 font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDateRef(aujourdhui)} className="btn btn-clair !min-h-10">
            Aujourd'hui
          </button>
          <button
            onClick={() => setDateRef(ajouterJours(aujourdhui, -1))}
            className="btn btn-clair !min-h-10"
          >
            Hier
          </button>
          <button
            onClick={() => setDateRef(ajouterJours(moisCourant + '-01', -1))}
            className="btn btn-clair !min-h-10"
          >
            Fin du mois précédent
          </button>
        </div>
      </div>

      {dateRef !== aujourdhui && (
        <p className="rounded-xl bg-[#fff3e0] text-[#8a4b00] px-4 py-2.5 text-sm font-semibold">
          Tu consultes une situation passée (le {formatDate(dateRef)}), pas la situation actuelle.
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="carte p-5">
          <p className="text-sm font-semibold text-doux">Total en caisse (agences affichées)</p>
          <p className="text-2xl font-extrabold mt-1.5 tabular-nums">
            {format(totalCaisse)} <span className="text-sm font-semibold text-doux">DA</span>
          </p>
        </div>
        <div className="carte p-5">
          <p className="text-sm font-semibold text-doux">Agences en alerte de versement</p>
          <p
            className={`text-2xl font-extrabold mt-1.5 ${
              nbAlertes > 0 ? 'text-[#b4232f]' : 'text-[#17653f]'
            }`}
          >
            {nbAlertes} <span className="text-base font-semibold text-doux">/ {nbDemarrees}</span>
          </p>
        </div>
        <div className="carte p-5 text-sm space-y-1">
          <p className="font-semibold text-doux">BRQ du {formatDate(dateRef)}</p>
          {vendredi ? (
            <p className="text-doux">Vendredi : jour de repos</p>
          ) : (
            <>
              <p>
                <b className="text-[#17653f]">{nbRecus}</b> réceptionnés ·{' '}
                <b className="text-[#8a4b00]">{nbAReceptionner}</b> à réceptionner
              </p>
              <p>
                <b>{nbBrouillons}</b> brouillons · <b>{nbNonCrees}</b> non créés
              </p>
            </>
          )}
          <p className="text-doux">
            {nbVerrouilles} jour{nbVerrouilles > 1 ? 's' : ''} verrouillé
            {nbVerrouilles > 1 ? 's' : ''}
          </p>
        </div>
      </section>

      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr>
              <th className="text-left">Agence</th>
              <th>Reste en caisse</th>
              <th className="text-left">Notification</th>
              <th className="text-center">Dernière saisie</th>
              <th>Manque du mois</th>
              <th>Surplus du mois</th>
              <th className="text-left">BRQ du jour</th>
              <th className="text-left">Jour verrouillé</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.agence.id} className="hover:bg-[#f9faff]">
                <td className="font-bold">{l.agence.nom}</td>

                {l.etat ? (
                  <>
                    <td className="text-right tabular-nums font-extrabold">{format(l.etat.reste)}</td>
                    <td>
                      <span className={`puce ${l.etat.alerte ? 'puce-alerte' : 'puce-ok'}`}>
                        {l.etat.alerte ? 'Alerte versement' : 'OK'}
                      </span>
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="text-center text-doux">
                    Suivi non démarré
                  </td>
                )}

                <td className="text-center text-doux">
                  {l.derniereSaisie ? formatDate(l.derniereSaisie) : '—'}
                </td>
                <td
                  className={`text-right tabular-nums ${
                    l.manque > 0 ? 'font-bold text-[#b4232f]' : ''
                  }`}
                >
                  {formatOuVide(l.manque)}
                </td>
                <td className="text-right tabular-nums">{formatOuVide(l.surplus)}</td>
                <td>
                  {l.brq === 'recu' && <span className="puce puce-ok">Réceptionné</span>}
                  {l.brq === 'valide' && <span className="puce puce-attente">À réceptionner</span>}
                  {l.brq === 'brouillon' && <span className="puce puce-neutre">Brouillon</span>}
                  {l.brq === null && (
                    <span className="text-xs text-doux">{vendredi ? 'Repos' : 'Non créé'}</span>
                  )}
                </td>
                <td>
                  {l.verrouille ? (
                    <span className="puce puce-verrou">Verrouillé</span>
                  ) : (
                    <span className="text-doux">—</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => ouvrir(l.agence.id, '/')}
                      className="btn btn-clair !min-h-8 !px-3 !text-xs"
                    >
                      Caisse
                    </button>
                    <button
                      onClick={() => ouvrir(l.agence.id, `/brq?date=${dateRef}`)}
                      className="btn btn-clair !min-h-8 !px-3 !text-xs"
                    >
                      BRQ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-doux">
        Manque et surplus : cumul du 1er du mois jusqu'au jour choisi.
      </p>
    </div>
  )
}