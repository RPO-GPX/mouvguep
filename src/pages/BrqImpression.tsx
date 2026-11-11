import { useNavigate, useParams } from 'react-router-dom'
import { useAgence } from '../contexts/AgenceContext'
import { useBrq } from '../hooks/useBrq'
import { calculerBrq, totalLigne } from '../lib/calculsBrq'
import { formatDate, nomJour } from '../lib/dates'
import { format, formatOuVide } from '../lib/format'

const c = 'border border-black px-1 py-0.5 text-[10px]'
const cd = `${c} text-right tabular-nums`

export default function BrqImpression() {
  const { date = '' } = useParams()
  const navigate = useNavigate()
  const { agence } = useAgence()
  const { data: brq, isLoading, error } = useBrq(agence?.id ?? null, date)

  const barre = (
    <div className="flex gap-3 print:hidden">
      <button
        onClick={() => navigate('/brq?date=' + date)}
        className="bg-slate-200 rounded-lg px-4 py-2"
      >
        ← Retour
      </button>
      <button
        onClick={() => window.print()}
        className="bg-blue-700 text-white rounded-lg px-4 py-2 font-medium"
      >
        Imprimer / Enregistrer en PDF
      </button>
    </div>
  )

  if (!agence || isLoading) return <p>Chargement…</p>
  if (error) return <p className="text-red-600">Erreur : {error.message}</p>
  if (!brq) {
    return (
      <div className="space-y-3">
        {barre}
        <p>Aucun BRQ pour le {formatDate(date)}.</p>
      </div>
    )
  }

  const totaux = calculerBrq(brq.lignes, brq.depenses)

  return (
    <div className="space-y-3">
      {barre}

      <div className="bg-white p-4 print:p-0 text-black">
                       <div className="flex items-start justify-between gap-4 mb-3">
          <div className="shrink-0">
            <img src="/logo-guepex.png" alt="GUEPEX Express Delivery" className="h-12 w-auto" />
            <p className="mt-1 text-[11px] font-mono font-semibold">Réf. : {brq.reference}</p>
            {brq.statut !== 'valide' && (
              <p className="text-xs font-bold text-red-600">BROUILLON — non validé</p>
            )}
          </div>

          <h1 className="flex-1 text-center text-lg font-bold leading-tight pt-2">
            BULLETIN DE RENSEIGNEMENTS QUOTIDIEN
          </h1>

          <div className="shrink-0 text-sm text-right">
            <p>
              <b>Bureau :</b> {agence.nom}
            </p>
            <p>
              <b>Date :</b> <span className="capitalize">{nomJour(date)}</span> {formatDate(date)}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="font-bold text-center">
              <th className={c}></th>
              <th className={c} colSpan={5}>E-COMMERCE</th>
              <th className={c} colSpan={4}>FACTURE</th>
              <th className={c}>Total</th>
            </tr>
            <tr className="font-bold text-center">
              <th className={c}>Agents</th>
              <th className={c}>N° récolte</th>
              <th className={c}>Nbre Cmd</th>
              <th className={c}>Nbre Cmd SD</th>
              <th className={c}>PU/Ram</th>
              <th className={c}>Montant Récolte</th>
              <th className={c}>N° Facture</th>
              <th className={c}>Mode Paiement</th>
              <th className={c}>N° Chèque</th>
              <th className={c}>Montant Encaissé (Espèces)</th>
              <th className={c}>Recettes / Agent</th>
            </tr>
          </thead>
          <tbody>
            {brq.lignes.map((l) => (
              <tr key={l.id}>
                <td className={c}>{l.agent_nom}</td>
                <td className={c}>{l.n_recolte}</td>
                <td className={cd}>{l.nbre_cmd || ''}</td>
                <td className={cd}>{l.nbre_cmd_sd || ''}</td>
                <td className={cd}>{l.pu_ram || ''}</td>
                <td className={cd}>{formatOuVide(l.montant_recolte)}</td>
                <td className={c}>{l.n_facture}</td>
                <td className={c}>{l.mode_paiement ?? ''}</td>
                <td className={c}>{l.n_cheque}</td>
                <td className={cd}>{formatOuVide(l.montant_especes)}</td>
                <td className={`${cd} font-semibold`}>{formatOuVide(totalLigne(l))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className={c} colSpan={5}>TOTAL ENCAISSEMENTS</td>
              <td className={cd}>{format(totaux.total_ecommerce)}</td>
              <td className={c} colSpan={3}></td>
              <td className={cd}>{format(totaux.total_factures)}</td>
              <td className={cd}>{format(totaux.total_recettes)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-6 print:break-inside-avoid">
          <div>
            <p className="text-sm font-bold mb-1">Dépenses</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="font-bold">
                  <th className={`${c} text-left`}>Nature dépenses</th>
                  <th className={c}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {brq.depenses.map((d) => (
                  <tr key={d.id}>
                    <td className={c}>{d.nature}</td>
                    <td className={cd}>{formatOuVide(d.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-sm font-bold mb-1">Récapitulatif</p>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className={c}>Total Recettes Espèces</td>
                  <td className={cd}>{format(totaux.total_recettes)}</td>
                </tr>
                <tr>
                  <td className={c}>Total Recettes Chèque</td>
                  <td className={cd}>{format(totaux.total_cheques)}</td>
                </tr>
                <tr>
                  <td className={c}>Nbre Chèques</td>
                  <td className={cd}>{totaux.nbre_cheques}</td>
                </tr>
                <tr>
                  <td className={c}>Total Dépenses</td>
                  <td className={cd}>{format(totaux.total_depenses)}</td>
                </tr>
                <tr className="font-bold">
                  <td className={c}>TOTAL RECETTES Espèces</td>
                  <td className={cd}>{format(totaux.reste_especes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex justify-between text-sm print:break-inside-avoid">
          <p>
            <b>BRQ préparé par :</b> {brq.prepare_par ?? ''}
          </p>
          <p>
            <b>BRQ validé par :</b> {brq.valide_par ?? ''}
          </p>
        </div>
      </div>
    </div>
  )
}