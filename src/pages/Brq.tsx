import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { useBrq } from '../hooks/useBrq'
import { calculerBrq, NATURES_DEPENSE, totalLigne } from '../lib/calculsBrq'
import { formatDate, jourSemaine, nomJour } from '../lib/dates'
import { format, formatOuVide } from '../lib/format'
import CelluleMontant from '../components/CelluleMontant'
import CelluleTexte from '../components/CelluleTexte'

const MODES_PAIEMENT = ['Espèces', 'Chèque', 'Virement']

type ChampTexte = 'agent_nom' | 'n_recolte' | 'n_facture' | 'n_cheque'
type ChampEntier = 'nbre_cmd' | 'nbre_cmd_sd' | 'pu_ram'
type ChampMontant = 'montant_recolte' | 'montant_especes'

function Liste({
  valeur,
  options,
  onChange,
  largeur = 'w-24',
}: {
  valeur: string | null
  options: { valeur: string; titre: string }[]
  onChange: (v: string | null) => void
  largeur?: string
}) {
  return (
    <select
      value={valeur ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className={`${largeur} px-2 py-1.5 bg-transparent border border-transparent rounded-lg hover:border-bord focus:bg-white focus:border-marine focus:ring-2 focus:ring-marine/20 outline-none`}
    >
      <option value=""></option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.titre}
        </option>
      ))}
    </select>
  )
}

export default function Brq() {
  const { profile } = useAuth()
  const { agence, peutControler } = useAgence()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dateUrl = params.get('date')
  const [date, setDate] = useState(
    dateUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateUrl) ? dateUrl : new Date().toISOString().slice(0, 10),
  )
  const [message, setMessage] = useState<string | null>(null)

  const estAdmin = profile?.role === 'admin'
  const peutSaisir = profile?.role === 'agence' || estAdmin
  const peutReceptionner = peutControler

  const { data: brq, isLoading, error } = useBrq(agence?.id ?? null, date)

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ['brq', agence?.id, date] })
  const surErreur = (e: Error) => setMessage('Erreur : ' + e.message)
  const surSucces = () => {
    setMessage(null)
    queryClient.invalidateQueries({ queryKey: ['brq-jour'] })
    return rafraichir()
  }

  const creer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('brq')
        .insert({ agence_id: agence!.id, date, prepare_par: profile?.nom ?? null })
        .select('id')
        .single()
      if (error) throw error
      const { error: e2 } = await supabase
        .from('brq_depenses')
        .insert(NATURES_DEPENSE.map((nature) => ({ brq_id: data.id, nature, montant: 0 })))
      if (e2) throw e2
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const ajouterLigne = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('brq_lignes')
        .insert({ brq_id: brq!.id, position: brq!.lignes.length })
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const majLigne = useMutation({
    mutationFn: async (v: { id: string; patch: Record<string, string | number | null> }) => {
      const { error } = await supabase.from('brq_lignes').update(v.patch).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const supprimerLigne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brq_lignes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const majDepense = useMutation({
    mutationFn: async (v: { id: string; montant: number }) => {
      const { error } = await supabase
        .from('brq_depenses')
        .update({ montant: v.montant })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const valider = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('valider_brq', { p_brq_id: brq!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mouvements', agence?.id] })
      return surSucces()
    },
    onError: surErreur,
  })

  const receptionner = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('receptionner_brq', { p_brq_id: brq!.id })
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  const rouvrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rouvrir_brq', { p_brq_id: brq!.id })
      if (error) throw error
    },
    onSuccess: surSucces,
    onError: surErreur,
  })

  if (!agence) return <p className="text-doux">Chargement…</p>

  const entete = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-doux">{agence.nom}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">BRQ</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(majLigne.isPending || majDepense.isPending) && (
          <span className="text-sm text-doux">Enregistrement…</span>
        )}
        {message && <span className="text-sm font-semibold text-[#b4232f]">{message}</span>}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="champ w-auto h-10 font-bold"
        />
        <span className="text-sm font-semibold text-doux capitalize">{nomJour(date)}</span>
      </div>
    </header>
  )

  if (isLoading) return <p className="text-doux">Chargement…</p>
  if (error) return <p className="text-[#b4232f]">Erreur : {error.message}</p>

  if (!brq) {
    return (
      <div className="space-y-5">
        {entete}
        {jourSemaine(date) === 5 ? (
          <p className="text-doux">Vendredi : jour de repos, pas de BRQ.</p>
        ) : peutSaisir ? (
          <div className="carte max-w-md p-6 space-y-3">
            <p className="font-semibold">Aucun BRQ pour le {formatDate(date)}.</p>
            <button
              onClick={() => creer.mutate()}
              disabled={creer.isPending}
              className="btn btn-rouge"
            >
              Créer le BRQ du {formatDate(date)}
            </button>
          </div>
        ) : (
          <p className="text-doux">Aucun BRQ pour le {formatDate(date)}.</p>
        )}
      </div>
    )
  }

  const verrouille = brq.statut === 'valide'
  const totaux = calculerBrq(brq.lignes, brq.depenses)

  const statutClasse = brq.recu_le
    ? 'puce-ok'
    : brq.statut === 'valide'
      ? 'puce-attente'
      : 'puce-neutre'
  const statutLibelle = brq.recu_le
    ? 'Réceptionné'
    : brq.statut === 'valide'
      ? 'Validé · à réceptionner'
      : 'Brouillon'

  const texte = (id: string, champ: ChampTexte) => (v: string) => {
    majLigne.mutate({ id, patch: { [champ]: v } })
    return true
  }
  const entier = (id: string, champ: ChampEntier) => (v: string) => {
    const n = v === '' ? 0 : Number(v)
    if (!Number.isInteger(n) || n < 0) {
      setMessage('Nombre entier invalide.')
      return false
    }
    majLigne.mutate({ id, patch: { [champ]: n } })
    return true
  }
  const montant = (id: string, champ: ChampMontant) => ({
    onValider: (v: number | null) => majLigne.mutate({ id, patch: { [champ]: v ?? 0 } }),
    onInvalide: () => setMessage('Montant invalide : utilise uniquement des chiffres.'),
  })

  const cellule = '!p-0'

  return (
    <div className="space-y-5">
      {entete}

      <div className="carte p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="puce puce-neutre font-mono">{brq.reference}</span>
          <span className={`puce ${statutClasse}`}>{statutLibelle}</span>
        </div>

        <p className="text-sm text-doux">
          Préparé par <b className="text-encre">{brq.prepare_par ?? '—'}</b>
          {verrouille && (
            <>
              {' '}
              · Validé par <b className="text-encre">{brq.valide_par ?? '—'}</b>
            </>
          )}
          {brq.recu_le && (
            <>
              {' '}
              · Réceptionné par <b className="text-encre">{brq.recu_par ?? '—'}</b> le{' '}
              {new Date(brq.recu_le).toLocaleString('fr-FR')}
            </>
          )}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => navigate(`/brq/imprimer/${date}`)} className="btn btn-clair">
            Imprimer / PDF
          </button>

          {!verrouille && peutSaisir && (
            <button
              onClick={() => {
                const ok = window.confirm(
                  `Valider le BRQ du ${formatDate(date)} ?\n\nIl sera verrouillé et transmis à la caisse :\nBRQ = ${format(totaux.total_recettes)}\nPmt vendeur = ${format(totaux.paiement_vendeurs)}`,
                )
                if (ok) valider.mutate()
              }}
              disabled={valider.isPending}
              className="btn btn-rouge"
            >
              Valider le BRQ
            </button>
          )}

          {!verrouille && !peutSaisir && (
            <span className="text-sm text-doux">Brouillon : en cours de saisie par l'agence</span>
          )}

          {verrouille && !brq.recu_le && peutReceptionner && (
            <button
              onClick={() => {
                const ok = window.confirm(
                  `Réceptionner le BRQ du ${formatDate(date)} ?\n\nTotal recettes espèces : ${format(totaux.total_recettes)}\nPaiement vendeurs : ${format(totaux.paiement_vendeurs)}`,
                )
                if (ok) receptionner.mutate()
              }}
              disabled={receptionner.isPending}
              className="btn btn-marine"
            >
              Réceptionner le BRQ
            </button>
          )}

          {verrouille && peutSaisir && (
            <button
              onClick={() => {
                const question = brq.recu_le
                  ? 'Ce BRQ est déjà réceptionné. Le rouvrir annule la réception : le chargé de suivi devra le réceptionner de nouveau. Continuer ?'
                  : 'Rouvrir ce BRQ pour le modifier ?'
                if (window.confirm(question)) rouvrir.mutate()
              }}
              disabled={rouvrir.isPending}
              className="btn btn-clair"
            >
              Rouvrir le BRQ
            </button>
          )}
        </div>
      </div>

      <fieldset disabled={verrouille || !peutSaisir} className="min-w-0 border-0 p-0 m-0 space-y-5">
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead>
              <tr>
                <th className="!bg-transparent"></th>
                <th colSpan={5} className="text-center !bg-[#e8f5ee] !text-[#17653f]">
                  E-commerce
                </th>
                <th colSpan={4} className="text-center !bg-[#f0ebfb] !text-[#5b3fa0]">
                  Facture
                </th>
                <th colSpan={2} className="!bg-transparent"></th>
              </tr>
              <tr>
                <th className="text-left">Agent</th>
                <th className="text-left">N° récolte</th>
                <th>Nbre cmd</th>
                <th>Nbre cmd SD</th>
                <th>PU/Ram</th>
                <th>Montant récolte</th>
                <th className="text-left">N° facture</th>
                <th className="text-left">Mode paiement</th>
                <th className="text-left">N° chèque</th>
                <th>Montant encaissé (espèces)</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brq.lignes.map((l) => (
                <tr key={l.id} className="hover:bg-[#f9faff]">
                  <td className={cellule}>
                    <CelluleTexte valeur={l.agent_nom} largeur="w-40" onValider={texte(l.id, 'agent_nom')} />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.n_recolte} onValider={texte(l.id, 'n_recolte')} />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.nbre_cmd || ''} droite largeur="w-16" onValider={entier(l.id, 'nbre_cmd')} />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.nbre_cmd_sd || ''} droite largeur="w-16" onValider={entier(l.id, 'nbre_cmd_sd')} />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.pu_ram || ''} droite largeur="w-16" onValider={entier(l.id, 'pu_ram')} />
                  </td>
                  <td className={cellule}>
                    <CelluleMontant valeur={l.montant_recolte} {...montant(l.id, 'montant_recolte')} />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.n_facture} onValider={texte(l.id, 'n_facture')} />
                  </td>
                  <td className={cellule}>
                    <Liste
                      valeur={l.mode_paiement}
                      options={MODES_PAIEMENT.map((m) => ({ valeur: m, titre: m }))}
                      onChange={(v) => majLigne.mutate({ id: l.id, patch: { mode_paiement: v } })}
                      largeur="w-28"
                    />
                  </td>
                  <td className={cellule}>
                    <CelluleTexte valeur={l.n_cheque} onValider={texte(l.id, 'n_cheque')} />
                  </td>
                  <td className={cellule}>
                    <CelluleMontant valeur={l.montant_especes} {...montant(l.id, 'montant_especes')} />
                  </td>
                  <td className="text-right font-extrabold tabular-nums bg-[#eaf6ef]">
                    {formatOuVide(totalLigne(l))}
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        if (window.confirm('Supprimer cette ligne ?')) supprimerLigne.mutate(l.id)
                      }}
                      className="text-[#b4232f] font-bold disabled:text-slate-300"
                      title="Supprimer la ligne"
                      aria-label="Supprimer la ligne"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-entete font-extrabold">
                <td colSpan={5}>TOTAL ENCAISSEMENTS</td>
                <td className="text-right tabular-nums">{format(totaux.total_ecommerce)}</td>
                <td colSpan={3}></td>
                <td className="text-right tabular-nums">{format(totaux.total_factures)}</td>
                <td className="text-right tabular-nums bg-[#dcefe3]">{format(totaux.total_recettes)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {peutSaisir && !verrouille && (
          <button
            type="button"
            onClick={() => ajouterLigne.mutate()}
            disabled={ajouterLigne.isPending}
            className="btn btn-marine"
          >
            + Ajouter une ligne
          </button>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="carte p-5 space-y-3">
            <h2 className="font-extrabold">Dépenses</h2>
            {brq.depenses.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{d.nature}</span>
                <CelluleMontant
                  valeur={d.montant}
                  largeur="w-36"
                  onValider={(v) => majDepense.mutate({ id: d.id, montant: v ?? 0 })}
                  onInvalide={() => setMessage('Montant invalide : utilise uniquement des chiffres.')}
                />
              </div>
            ))}
          </div>

          <div className="carte p-5 space-y-2.5">
            <h2 className="font-extrabold">Récapitulatif</h2>
            <div className="flex justify-between text-sm">
              <span className="text-doux">Total recettes espèces</span>
              <span className="font-bold tabular-nums">{format(totaux.total_recettes)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-doux">Total dépenses</span>
              <span className="font-bold tabular-nums">{format(totaux.total_depenses)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-doux">Chèques : {totaux.nbre_cheques}</span>
              <span className="font-bold tabular-nums">{format(totaux.total_cheques)}</span>
            </div>
            <div className="pt-3 border-t border-bord">
              <p className="text-sm font-semibold text-doux">Total recettes espèces (net)</p>
              <p
                className={`text-3xl font-extrabold tabular-nums ${
                  totaux.reste_especes < 0 ? 'text-[#b4232f]' : 'text-[#17653f]'
                }`}
              >
                {format(totaux.reste_especes)}{' '}
                <span className="text-sm font-semibold text-doux">DA</span>
              </p>
              {totaux.reste_especes < 0 && (
                <span className="puce puce-alerte mt-2">Les dépenses dépassent les recettes du jour</span>
              )}
            </div>
            <p className="text-xs text-doux">
              {verrouille ? 'Transmis à la caisse' : 'Sera transmis à la caisse'} : BRQ ={' '}
              {format(totaux.total_recettes)} · Pmt vendeur = {format(totaux.paiement_vendeurs)}
            </p>
          </div>
        </div>
      </fieldset>
    </div>
  )
}