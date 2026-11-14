import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { ajouterJours, formatDate } from '../lib/dates'
import { format } from '../lib/format'

type Entree = {
  id: number
  le: string
  auteur_nom: string | null
  auteur_role: string | null
  agence_id: string | null
  date_jour: string | null
  action: string
  champ: string | null
  ancienne_valeur: string | null
  nouvelle_valeur: string | null
  details: string | null
  agences: { nom: string } | null
}

const ROLES: Record<string, string> = {
  agence: 'Caissier',
  suivi: 'Chargé de suivi',
  regional: 'Directeur régional',
  admin: 'Administrateur',
}

const ACTIONS: Record<string, { libelle: string; classe: string }> = {
  modification: { libelle: "Modification d'une case", classe: 'puce-neutre' },
  verrouillage: { libelle: 'Verrouillage du jour', classe: 'puce-verrou' },
  deverrouillage: { libelle: 'Déverrouillage du jour', classe: 'puce-attente' },
  creation_brq: { libelle: 'BRQ créé', classe: 'puce-neutre' },
  validation_brq: { libelle: 'BRQ validé', classe: 'puce-ok' },
  reouverture_brq: { libelle: 'BRQ rouvert', classe: 'puce-attente' },
  reception_brq: { libelle: 'BRQ réceptionné', classe: 'puce-ok' },
  annulation_reception_brq: { libelle: 'Réception annulée', classe: 'puce-attente' },
  ajout_avis: { libelle: 'Avis de versement ajouté', classe: 'puce-ok' },
  suppression_avis: { libelle: 'Avis de versement supprimé', classe: 'puce-alerte' },
  creation_agence: { libelle: 'Agence créée', classe: 'puce-neutre' },
  modification_agence: { libelle: 'Agence modifiée', classe: 'puce-neutre' },
  desactivation_agence: { libelle: 'Agence désactivée', classe: 'puce-alerte' },
  reactivation_agence: { libelle: 'Agence réactivée', classe: 'puce-ok' },
}

const GROUPES: Record<string, { libelle: string; actions: string[] }> = {
  modification: { libelle: 'Modifications de cases', actions: ['modification'] },
  verrou: { libelle: 'Verrouillage / déverrouillage', actions: ['verrouillage', 'deverrouillage'] },
  brq: {
    libelle: 'BRQ',
    actions: [
      'creation_brq',
      'validation_brq',
      'reouverture_brq',
      'reception_brq',
      'annulation_reception_brq',
    ],
  },
  avis: { libelle: 'Avis de versement', actions: ['ajout_avis', 'suppression_avis'] },
  agence: {
    libelle: 'Agences',
    actions: ['creation_agence', 'modification_agence', 'desactivation_agence', 'reactivation_agence'],
  },
}

const CHAMPS: Record<string, string> = {
  solde_ouverture: "Solde d'ouverture",
  recu_cash: 'Reçu cash',
  retire_par_cheque: 'Retiré par chèque',
  brq: 'BRQ',
  recolte_non_envoyee: 'Récolte non envoyée',
  pmt: 'Pmt',
  tpe: 'TPE',
  depense: 'Dépense',
  pmt_vendeur: 'Pmt vendeur',
  transfert_interne: 'Transfert interne',
  v_bancaire: 'V. bancaire',
  montant_reel: 'Montant réel',
  recettes: 'Recettes espèces',
  nom: 'Nom',
  seuil_alerte: "Seuil d'alerte",
}

const estNombre = (v: string | null) => v !== null && v.trim() !== '' && Number.isFinite(Number(v))
const lisible = (v: string | null) => (v === null ? '—' : estNombre(v) ? format(Number(v)) : v)

// Texte brut d'une entrée (affichage et export)
function texteDetail(e: Entree): string {
  const champ = e.champ ? (CHAMPS[e.champ] ?? e.champ) : ''
  if (e.action === 'modification' || e.action === 'modification_agence') {
    return `${champ} : ${lisible(e.ancienne_valeur)} → ${lisible(e.nouvelle_valeur)}`
  }
  if (e.action === 'validation_brq') {
    const [ref, dep] = (e.details ?? '').split(' · dépenses ')
    return `${ref} · ${champ} ${lisible(e.nouvelle_valeur)}${dep ? ` · dépenses ${lisible(dep)}` : ''}`
  }
  return e.details ?? ''
}

function exporterCsv(lignes: Entree[], du: string, au: string) {
  const entetes = [
    'Date et heure',
    'Agence',
    'Jour concerné',
    'Auteur',
    'Rôle',
    'Action',
    'Champ',
    'Ancienne valeur',
    'Nouvelle valeur',
    'Détail',
  ]
  const nombre = (v: string | null) => (v === null ? '' : estNombre(v) ? v.replace('.', ',') : v)
  const corps = lignes.map((e) => [
    new Date(e.le).toLocaleString('fr-FR'),
    e.agences?.nom ?? '',
    e.date_jour ? formatDate(e.date_jour) : '',
    e.auteur_nom ?? 'Système',
    e.auteur_role ? (ROLES[e.auteur_role] ?? e.auteur_role) : '',
    ACTIONS[e.action]?.libelle ?? e.action,
    e.champ ? (CHAMPS[e.champ] ?? e.champ) : '',
    nombre(e.ancienne_valeur),
    nombre(e.nouvelle_valeur),
    e.details ?? '',
  ])
  const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`
  // BOM + point-virgule : s'ouvre correctement dans Excel en français
  const csv = '\uFEFF' + [entetes, ...corps].map((l) => l.map(echapper).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `journal-audit-${du}-${au}.csv`
  lien.click()
  URL.revokeObjectURL(url)
}

const PAS = 100

export default function Journal() {
  const { profile } = useAuth()
  const { agences } = useAgence()

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const [du, setDu] = useState(ajouterJours(aujourdhui, -6))
  const [au, setAu] = useState(aujourdhui)
  const [agenceFiltre, setAgenceFiltre] = useState('')
  const [groupe, setGroupe] = useState('')
  const [auteur, setAuteur] = useState('')
  const [limite, setLimite] = useState(PAS)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['journal', du, au, agenceFiltre, groupe, auteur, limite],
    queryFn: async () => {
      let q = supabase
        .from('journal_audit')
        .select('*, agences(nom)', { count: 'exact' })
        .gte('le', new Date(du + 'T00:00:00').toISOString())
        .lte('le', new Date(au + 'T23:59:59.999').toISOString())
      if (agenceFiltre) q = q.eq('agence_id', agenceFiltre)
      if (groupe) q = q.in('action', GROUPES[groupe].actions)
      if (auteur.trim()) q = q.ilike('auteur_nom', `%${auteur.trim()}%`)
      const { data, error, count } = await q.order('le', { ascending: false }).limit(limite)
      if (error) throw error
      return { lignes: (data ?? []) as unknown as Entree[], total: count ?? 0 }
    },
    placeholderData: keepPreviousData,
  })

  if (!profile || profile.role === 'agence') return <Navigate to="/" replace />

  const lignes = data?.lignes ?? []
  const total = data?.total ?? 0
  const etiquette = 'block text-xs font-bold text-doux mb-1'

  const reinitialiser = (nouveauDu: string, nouveauAu: string) => {
    setDu(nouveauDu)
    setAu(nouveauAu)
    setLimite(PAS)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Journal d'audit</h1>
          <p className="text-sm font-semibold text-doux">
            Qui a fait quoi, et quand. Les entrées ne peuvent ni être modifiées ni supprimées.
          </p>
        </div>
        <button
          onClick={() => exporterCsv(lignes, du, au)}
          disabled={lignes.length === 0}
          className="btn btn-clair"
        >
          Exporter en CSV
        </button>
      </header>

      <div className="carte p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className={etiquette}>Du</label>
          <input
            type="date"
            value={du}
            max={au}
            onChange={(e) => e.target.value && reinitialiser(e.target.value, au)}
            className="champ w-auto h-10 font-medium"
          />
        </div>
        <div>
          <label className={etiquette}>Au</label>
          <input
            type="date"
            value={au}
            min={du}
            onChange={(e) => e.target.value && reinitialiser(du, e.target.value)}
            className="champ w-auto h-10 font-medium"
          />
        </div>
        <div>
          <label className={etiquette}>Agence</label>
          <select
            value={agenceFiltre}
            onChange={(e) => {
              setAgenceFiltre(e.target.value)
              setLimite(PAS)
            }}
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
        <div>
          <label className={etiquette}>Type d'action</label>
          <select
            value={groupe}
            onChange={(e) => {
              setGroupe(e.target.value)
              setLimite(PAS)
            }}
            className="champ w-auto h-10 font-medium"
          >
            <option value="">Toutes</option>
            {Object.entries(GROUPES).map(([cle, g]) => (
              <option key={cle} value={cle}>
                {g.libelle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiquette}>Auteur</label>
          <input
            value={auteur}
            onChange={(e) => {
              setAuteur(e.target.value)
              setLimite(PAS)
            }}
            placeholder="Nom"
            className="champ w-48 h-10 font-medium"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => reinitialiser(aujourdhui, aujourdhui)}
            className="btn btn-clair !min-h-10"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => reinitialiser(ajouterJours(aujourdhui, -6), aujourdhui)}
            className="btn btn-clair !min-h-10"
          >
            7 jours
          </button>
          <button
            onClick={() => reinitialiser(ajouterJours(aujourdhui, -29), aujourdhui)}
            className="btn btn-clair !min-h-10"
          >
            30 jours
          </button>
        </div>
      </div>

      {isLoading && <p className="text-doux">Chargement…</p>}
      {error && <p className="text-[#b4232f]">Erreur : {error.message}</p>}

      {!isLoading && !error && (
        <>
          <p className="text-sm text-doux">
            <b className="text-encre">{total}</b> entrée{total > 1 ? 's' : ''} sur la période
            {total > lignes.length && ` · ${lignes.length} affichées`}
            {isFetching && ' · actualisation…'}
          </p>

          {lignes.length === 0 ? (
            <p className="text-doux">Aucune entrée pour ces critères.</p>
          ) : (
            <div className="carte overflow-x-auto">
              <table className="tableau">
                <thead>
                  <tr>
                    <th className="text-left">Date et heure</th>
                    <th className="text-left">Agence</th>
                    <th className="text-left">Jour concerné</th>
                    <th className="text-left">Auteur</th>
                    <th className="text-left">Action</th>
                    <th className="text-left">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((e) => {
                    const a = ACTIONS[e.action]
                    return (
                      <tr key={e.id} className="hover:bg-[#f9faff]">
                        <td className="text-doux">{new Date(e.le).toLocaleString('fr-FR')}</td>
                        <td className="font-bold">{e.agences?.nom ?? '—'}</td>
                        <td>{e.date_jour ? formatDate(e.date_jour) : '—'}</td>
                        <td>
                          <span className="font-bold">{e.auteur_nom ?? 'Système'}</span>
                          {e.auteur_role && (
                            <span className="text-xs text-doux">
                              {' '}
                              · {ROLES[e.auteur_role] ?? e.auteur_role}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`puce ${a?.classe ?? 'puce-neutre'}`}>
                            {a?.libelle ?? e.action}
                          </span>
                        </td>
                        <td>{texteDetail(e)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {total > lignes.length && (
            <button onClick={() => setLimite(limite + PAS)} className="btn btn-clair">
              Afficher {PAS} de plus
            </button>
          )}
        </>
      )}
    </div>
  )
}