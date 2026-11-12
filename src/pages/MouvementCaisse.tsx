import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { useMouvements } from '../hooks/useMouvements'
import {
  useStatutsBrq,
  useVerrous,
  type StatutBrqJour,
  type Verrou,
} from '../hooks/useSuiviJours'
import { cleCommentaire, useCommentaires, type Commentaire } from '../hooks/useCommentaires'
import { useAvis, type Avis } from '../hooks/useAvis'
import { calculerMouvements } from '../lib/calculs'
import { completerJours } from '../lib/jours'
import { finDeMois, formatDate, nomJour } from '../lib/dates'
import { format, formatOuVide } from '../lib/format'
import CelluleMontant from '../components/CelluleMontant'
import PanneauCommentaires from '../components/PanneauCommentaires'
import PanneauAvis from '../components/PanneauAvis'

// TPE est un virement direct sur le compte de l'entreprise : il se compte en plus (débit)
const COLONNES_DEBIT = [
  ['recu_cash', 'Reçu cash'],
  ['retire_par_cheque', 'Retiré par chèque'],
  ['brq', 'BRQ'],
  ['recolte_non_envoyee', 'Récolte non envoyée'],
  ['pmt', 'Pmt'],
  ['tpe', 'TPE'],
] as const

const COLONNES_CREDIT = [
  ['depense', 'Dépense'],
  ['pmt_vendeur', 'Pmt vendeur'],
  ['transfert_interne', 'Transfert interne'],
  ['v_bancaire', 'V. bancaire'],
] as const

type Champ =
  | (typeof COLONNES_DEBIT)[number][0]
  | (typeof COLONNES_CREDIT)[number][0]
  | 'montant_reel'

const OPTIONS_COMMENTAIRE = [
  { cle: 'general', titre: 'Toute la ligne' },
  ...COLONNES_DEBIT.map(([cle, titre]) => ({ cle: cle as string, titre: titre as string })),
  ...COLONNES_CREDIT.map(([cle, titre]) => ({ cle: cle as string, titre: titre as string })),
  { cle: 'montant_reel', titre: 'Montant réel' },
]

const arrondi = (n: number) => Math.round(n * 100) / 100

// Style commun du bouton rond de l'avis de versement
const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1 h-6 min-w-6 rounded-full px-1.5 text-[11px] font-extrabold leading-none transition-colors'
const NEUTRE =
  'bg-white text-[#6f78a3] border border-[#cfd5ea] hover:bg-entete hover:text-marine'
const VERT = 'bg-[#17653f] text-white'
const ORANGE = 'bg-[#fff3e0] text-[#8a4b00] border border-[#f0c98a]'

// Largeur minimale des colonnes de montants (le trombone demande un peu plus de place)
const LARGEUR = 'min-w-[8.5rem]'
const LARGEUR_AVIS = '!min-w-[10.5rem]'

function Cadenas() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

function IconeBulle() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function IconeTrombone() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3" />
    </svg>
  )
}

function BadgeBrq({ statut }: { statut: StatutBrqJour | undefined }) {
  if (statut === 'recu') return <span className="puce puce-ok">BRQ reçu</span>
  if (statut === 'valide') return <span className="puce puce-attente">BRQ à réceptionner</span>
  if (statut === 'brouillon') return <span className="puce puce-neutre">BRQ en cours</span>
  return <span className="text-xs text-doux">Pas de BRQ</span>
}

// Petit triangle jaune dans le coin d'une case qui a des commentaires
function MarqueCommentaire({
  apercu,
  onClick,
}: {
  apercu: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={apercu}
      aria-label={apercu}
      className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#f5b301] hover:bg-[#d99f00]"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
    />
  )
}

// Bouton « Commenter » de la ligne (un par jour)
function BoutonCommentaireJour({
  n,
  peutCommenter,
  onClick,
}: {
  n: number
  peutCommenter: boolean
  onClick: () => void
}) {
  if (!peutCommenter && n === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 rounded-full px-2.5 text-xs font-bold ${
        n > 0
          ? 'bg-[#f5b301] text-encre'
          : 'bg-white text-[#4a5178] border border-[#cfd5ea] hover:bg-entete'
      }`}
    >
      <IconeBulle />
      {n > 0 ? `${n} commentaire${n > 1 ? 's' : ''}` : 'Commenter'}
    </button>
  )
}

// Bouton des avis de versement (case V. bancaire)
function BoutonAvis({
  n,
  manquant,
  peutAjouter,
  onClick,
}: {
  n: number
  manquant: boolean
  peutAjouter: boolean
  onClick: () => void
}) {
  if (n === 0 && !manquant && !peutAjouter) return null
  const titre =
    n > 0
      ? `${n} avis de versement`
      : manquant
        ? 'Avis de versement manquant'
        : 'Ajouter un avis de versement'
  return (
    <button
      type="button"
      onClick={onClick}
      title={titre}
      aria-label={titre}
      className={`${BASE} ${n > 0 ? VERT : manquant ? ORANGE : NEUTRE}`}
    >
      <IconeTrombone />
      {n > 0 ? n : manquant ? '!' : ''}
    </button>
  )
}

function Demarrage({
  agenceId,
  nom,
  onFait,
}: {
  agenceId: string
  nom: string
  onFait: () => void
}) {
  const [debut, setDebut] = useState(new Date().toISOString().slice(0, 8) + '01')
  const [solde, setSolde] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  async function demarrer() {
    const valeur = Number(solde.replace(/\s/g, '').replace(',', '.'))
    if (!debut || solde.trim() === '' || Number.isNaN(valeur)) {
      setErreur('Indique une date et un solde valides.')
      return
    }
    const { error } = await supabase
      .from('mouvements_caisse')
      .insert({ agence_id: agenceId, date: debut, solde_ouverture: valeur })
    if (error) setErreur(error.message)
    else onFait()
  }

  return (
    <div className="carte max-w-md p-6 space-y-4">
      <h1 className="text-xl font-extrabold">Démarrer le suivi — {nom}</h1>
      <p className="text-sm text-doux">
        Aucun mouvement pour cette agence. Indique le premier jour du suivi et le solde de caisse
        à cette date.
      </p>
      <label className="block text-sm font-bold">
        Date de début
        <input
          type="date"
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
          className="champ mt-1.5 font-medium"
        />
      </label>
      <label className="block text-sm font-bold">
        Solde d'ouverture (DA)
        <input
          type="text"
          inputMode="decimal"
          value={solde}
          onChange={(e) => setSolde(e.target.value)}
          className="champ mt-1.5 font-medium"
        />
      </label>
      {erreur && <p className="text-sm font-semibold text-[#b4232f]">{erreur}</p>}
      <button onClick={demarrer} className="btn btn-marine">
        Démarrer
      </button>
    </div>
  )
}

export default function MouvementCaisse() {
  const { profile } = useAuth()
  const { agence, peutControler } = useAgence()
  const queryClient = useQueryClient()
  const { data: existants = [], isLoading, error } = useMouvements(agence?.id ?? null)
  const { data: verrousData } = useVerrous(agence?.id ?? null)
  const { data: statutsData } = useStatutsBrq(agence?.id ?? null)
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7))
  const [message, setMessage] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<{ date: string; champ: string } | null>(null)
  const [avisOuvert, setAvisOuvert] = useState<string | null>(null)
  const { data: commentairesData } = useCommentaires(agence?.id ?? null, mois)
  const { data: avisData } = useAvis(agence?.id ?? null, mois)

  const verrous = verrousData ?? new Map<string, Verrou>()
  const statuts = statutsData ?? new Map<string, StatutBrqJour>()
  const parCase = commentairesData?.parCase ?? new Map<string, Commentaire[]>()
  const parJour = commentairesData?.parJour ?? new Map<string, Commentaire[]>()
  const avisParJour = avisData ?? new Map<string, Avis[]>()
  const nbAvis = (date: string) => avisParJour.get(date)?.length ?? 0

  const estAdmin = profile?.role === 'admin'
  const peutSaisir = profile?.role === 'agence' || profile?.role === 'suivi' || estAdmin
  const peutVerrouiller = peutControler
  const peutCommenter =
    profile?.role === 'agence' || profile?.role === 'suivi' || profile?.role === 'admin'
  const aujourdhui = new Date().toISOString().slice(0, 10)

  const enregistrer = useMutation({
    mutationFn: async (v: { date: string; champ: Champ; valeur: number | null }) => {
      if (!agence) return
      const { error } = await supabase
        .from('mouvements_caisse')
        .upsert(
          { agence_id: agence.id, date: v.date, [v.champ]: v.valeur },
          { onConflict: 'agence_id,date' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      setMessage(null)
      return queryClient.invalidateQueries({ queryKey: ['mouvements', agence?.id] })
    },
    onError: (e: Error) => setMessage("Erreur d'enregistrement : " + e.message),
  })

  const changerVerrou = useMutation({
    mutationFn: async (v: { date: string; action: 'verrouiller' | 'deverrouiller' }) => {
      const { error } = await supabase.rpc(
        v.action === 'verrouiller' ? 'verrouiller_jour' : 'deverrouiller_jour',
        { p_agence: agence!.id, p_date: v.date },
      )
      if (error) throw error
    },
    onSuccess: () => {
      setMessage(null)
      queryClient.invalidateQueries({ queryKey: ['mouvements', agence?.id] })
      queryClient.invalidateQueries({ queryKey: ['brq-jour'] })
      return queryClient.invalidateQueries({ queryKey: ['verrous', agence?.id] })
    },
    onError: (e: Error) => setMessage(e.message),
  })

  if (!agence || isLoading) return <p className="text-doux">Chargement…</p>
  if (error) return <p className="text-[#b4232f]">Erreur : {error.message}</p>

  if (existants.length === 0) {
    if (!peutSaisir) {
      return (
        <p className="text-doux">Le suivi de caisse n'est pas démarré pour {agence.nom}.</p>
      )
    }
    return (
      <Demarrage
        agenceId={agence.id}
        nom={agence.nom}
        onFait={() => queryClient.invalidateQueries({ queryKey: ['mouvements', agence.id] })}
      />
    )
  }

  const toutes = calculerMouvements(
    completerJours(existants, finDeMois(mois)),
    Number(agence.seuil_alerte),
  )
  const lignes = toutes.filter((l) => l.date.startsWith(mois))
  const premierJour = toutes[0].date

  // Cartes de synthèse (jusqu'à aujourd'hui)
  const jusquaAujourdhui = lignes.filter((l) => l.date <= aujourdhui)
  const refLigne = jusquaAujourdhui[jusquaAujourdhui.length - 1] ?? lignes[0]
  const totalBrq = arrondi(jusquaAujourdhui.reduce((s, l) => s + l.brq, 0))
  const manque = arrondi(jusquaAujourdhui.reduce((s, l) => s + l.ecart_manque, 0))
  const surplus = arrondi(jusquaAujourdhui.reduce((s, l) => s + l.ecart_surplus, 0))
  const nbVerrouilles = lignes.filter((l) => verrous.has(l.date)).length

  const num = 'text-right tabular-nums'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-doux">{agence.nom}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Mouvement de caisse</h1>
        </div>
        <div className="flex items-center gap-3">
          {(enregistrer.isPending || changerVerrou.isPending) && (
            <span className="text-sm text-doux">Enregistrement…</span>
          )}
          {message && <span className="text-sm font-semibold text-[#b4232f]">{message}</span>}
          <input
            type="month"
            value={mois}
            onChange={(e) => e.target.value && setMois(e.target.value)}
            className="champ w-auto h-10 font-bold"
          />
        </div>
      </header>

      {lignes.length === 0 && (
        <p className="text-doux">
          Aucun mouvement pour ce mois (le suivi commence le {formatDate(premierJour)}).
        </p>
      )}

      {lignes.length > 0 && refLigne && (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="carte p-5">
            <p className="text-sm font-semibold text-doux">
              Reste en caisse au {formatDate(refLigne.date)}
            </p>
            <p className="text-2xl font-extrabold mt-1.5 mb-2.5 tabular-nums">
              {format(refLigne.reste)} <span className="text-sm font-semibold text-doux">DA</span>
            </p>
            <span className={`puce ${refLigne.alerte ? 'puce-alerte' : 'puce-ok'}`}>
              {refLigne.alerte ? 'Alerte versement' : 'OK'}
            </span>
          </div>
          <div className="carte p-5">
            <p className="text-sm font-semibold text-doux">Encaissements BRQ du mois</p>
            <p className="text-2xl font-extrabold mt-1.5 mb-2.5 tabular-nums">
              {format(totalBrq)} <span className="text-sm font-semibold text-doux">DA</span>
            </p>
            <span className="puce puce-verrou">
              <Cadenas />
              {nbVerrouilles} jour{nbVerrouilles > 1 ? 's' : ''} verrouillé
              {nbVerrouilles > 1 ? 's' : ''}
            </span>
          </div>
          <div className="carte p-5">
            <p className="text-sm font-semibold text-doux">Manque du mois</p>
            <p
              className={`text-2xl font-extrabold mt-1.5 mb-2.5 tabular-nums ${
                manque > 0 ? 'text-[#b4232f]' : ''
              }`}
            >
              {format(manque)} <span className="text-sm font-semibold text-doux">DA</span>
            </p>
            <span className={`puce ${manque > 0 ? 'puce-alerte' : 'puce-ok'}`}>
              {manque > 0 ? 'À justifier' : 'Aucun écart'}
            </span>
            {surplus > 0 && (
              <span className="ml-2 text-xs font-semibold text-doux">Surplus : {format(surplus)}</span>
            )}
          </div>
        </section>
      )}

      {lignes.length > 0 && (
        <div className="carte overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th colSpan={3} className="!bg-transparent"></th>
                  <th colSpan={6} className="text-center bg-[#e8f5ee] text-[#17653f]">
                    Débit
                  </th>
                  <th colSpan={4} className="text-center bg-[#fdecee] text-[#b4232f]">
                    Crédit
                  </th>
                  <th colSpan={6} className="!bg-transparent"></th>
                </tr>
                <tr>
                  <th className="text-left">Jour</th>
                  <th className="text-left">Date</th>
                  <th className={LARGEUR}>Dispo</th>
                  {COLONNES_DEBIT.map(([cle, titre]) => (
                    <th key={cle} className={LARGEUR}>
                      {titre}
                    </th>
                  ))}
                  {COLONNES_CREDIT.map(([cle, titre]) => (
                    <th key={cle} className={`${LARGEUR} ${cle === 'v_bancaire' ? LARGEUR_AVIS : ''}`}>
                      {titre}
                    </th>
                  ))}
                  <th className={LARGEUR}>Reste</th>
                  <th className="text-left">Notification</th>
                  <th className={LARGEUR}>Écart manque</th>
                  <th className={LARGEUR}>Écart surplus</th>
                  <th className={LARGEUR}>Montant réel</th>
                  <th className="text-left">Contrôle</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const verrou = verrous.get(l.date)
                  const bloque = !!verrou || !peutSaisir
                  const nbJour = parJour.get(l.date)?.length ?? 0

                  const saisir = (champ: Champ) => ({
                    onValider: (valeur: number | null) =>
                      enregistrer.mutate({ date: l.date, champ, valeur }),
                    onInvalide: () =>
                      setMessage('Montant invalide : utilise uniquement des chiffres.'),
                  })

                  // Saisir un écart revient à enregistrer le montant réel correspondant
                  const saisirEcart = (type: 'manque' | 'surplus') => ({
                    onValider: (v: number | null) => {
                      const e = v ?? 0
                      const reel = arrondi(type === 'manque' ? l.reste - e : l.reste + e)
                      enregistrer.mutate({ date: l.date, champ: 'montant_reel', valeur: reel })
                    },
                    onInvalide: () =>
                      setMessage('Montant invalide : utilise uniquement des chiffres.'),
                  })

                  const classeLigne = l.jour_repos
                    ? 'bg-[#fdecee] text-[#b4232f]'
                    : verrou
                      ? 'bg-[#f7f8fc]'
                      : 'hover:bg-[#f9faff]'

                  const editable = !l.jour_repos && !bloque
                  const tdMontant = `${num} ${LARGEUR} ${editable ? '!py-1' : ''}`

                  return (
                    <tr key={l.date} className={classeLigne}>
                      <td className="font-bold capitalize">{nomJour(l.date)}</td>
                      <td className={l.jour_repos ? '' : 'text-doux'}>{formatDate(l.date)}</td>
                      <td className={`${num} ${LARGEUR} ${l.jour_repos ? '' : 'bg-[#f4f1fb]'}`}>
                        {format(l.dispo)}
                      </td>

                      {[...COLONNES_DEBIT, ...COLONNES_CREDIT].map(([cle]) => {
                        const liste = parCase.get(cleCommentaire(l.date, cle)) ?? []
                        const dernier = liste[liste.length - 1]
                        return (
                          <td
                            key={cle}
                            className={`${tdMontant} relative ${cle === 'v_bancaire' ? LARGEUR_AVIS : ''}`}
                          >
                            {l.jour_repos ? (
                              formatOuVide(l[cle])
                            ) : (
                              <>
                                {bloque ? (
                                  formatOuVide(l[cle])
                                ) : (
                                  <CelluleMontant plein valeur={l[cle]} {...saisir(cle)} />
                                )}
                                {cle === 'v_bancaire' && (
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2">
                                    <BoutonAvis
                                      n={nbAvis(l.date)}
                                      manquant={l.v_bancaire > 0 && nbAvis(l.date) === 0}
                                      peutAjouter={peutCommenter}
                                      onClick={() => setAvisOuvert(l.date)}
                                    />
                                  </span>
                                )}
                                {dernier && (
                                  <MarqueCommentaire
                                    apercu={`${liste.length} commentaire${liste.length > 1 ? 's' : ''} — dernier : ${dernier.auteur_nom ?? '—'} : ${dernier.texte.slice(0, 80)}`}
                                    onClick={() => setOuvert({ date: l.date, champ: cle })}
                                  />
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}

                      <td
                        className={`${num} ${LARGEUR} font-extrabold ${l.jour_repos ? '' : 'bg-[#eaf6ef]'}`}
                      >
                        {format(l.reste)}
                      </td>
                      <td>
                        {l.jour_repos ? (
                          <span className="text-xs font-bold">Jour de repos</span>
                        ) : (
                          <span className={`puce ${l.alerte ? 'puce-alerte' : 'puce-ok'}`}>
                            {l.alerte ? 'Alerte versement' : 'OK'}
                          </span>
                        )}
                      </td>

                      <td className={tdMontant}>
                        {l.jour_repos ? null : bloque ? (
                          <span className={l.ecart_manque > 0 ? 'font-bold text-[#b4232f]' : ''}>
                            {formatOuVide(l.ecart_manque)}
                          </span>
                        ) : (
                          <CelluleMontant
                            plein
                            valeur={l.ecart_manque}
                            classe={l.ecart_manque > 0 ? 'font-bold text-[#b4232f]' : ''}
                            {...saisirEcart('manque')}
                          />
                        )}
                      </td>
                      <td className={tdMontant}>
                        {l.jour_repos ? null : bloque ? (
                          formatOuVide(l.ecart_surplus)
                        ) : (
                          <CelluleMontant plein valeur={l.ecart_surplus} {...saisirEcart('surplus')} />
                        )}
                      </td>

                      <td className={tdMontant}>
                        {l.jour_repos ? null : bloque ? (
                          l.montant_reel === null ? '' : format(l.montant_reel)
                        ) : (
                          <CelluleMontant
                            plein
                            nullable
                            valeur={l.montant_reel}
                            {...saisir('montant_reel')}
                          />
                        )}
                      </td>

                      <td>
                        {!l.jour_repos && (
                          <div className="flex flex-wrap items-center gap-2">
                            <BadgeBrq statut={statuts.get(l.date)} />
                            {verrou ? (
                              <>
                                <span
                                  className="puce puce-verrou"
                                  title={`Verrouillé par ${verrou.par ?? '—'}${
                                    verrou.le
                                      ? ' le ' + new Date(verrou.le).toLocaleString('fr-FR')
                                      : ''
                                  }`}
                                >
                                  <Cadenas />
                                  Verrouillé
                                </span>
                                {peutVerrouiller && (
                                  <button
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Déverrouiller le ${formatDate(l.date)} ? L'agence pourra de nouveau modifier cette ligne.`,
                                        )
                                      )
                                        changerVerrou.mutate({
                                          date: l.date,
                                          action: 'deverrouiller',
                                        })
                                    }}
                                    className="text-xs font-bold text-marine underline underline-offset-2"
                                  >
                                    Déverrouiller
                                  </button>
                                )}
                              </>
                            ) : (
                              peutVerrouiller &&
                              l.date <= aujourdhui && (
                                <button
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Verrouiller le ${formatDate(l.date)} ? La ligne ne sera plus modifiable par l'agence.`,
                                      )
                                    )
                                      changerVerrou.mutate({ date: l.date, action: 'verrouiller' })
                                  }}
                                  className="btn btn-marine !min-h-8 !px-3 !text-xs"
                                >
                                  Verrouiller
                                </button>
                              )
                            )}
                            <BoutonCommentaireJour
                              n={nbJour}
                              peutCommenter={peutCommenter}
                              onClick={() => setOuvert({ date: l.date, champ: 'general' })}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lignes.length > 0 && (
        <p className="text-xs text-doux flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3.5 h-3.5 bg-[#f5b301]"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
            />
            Case commentée (survole-la pour lire le dernier commentaire)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`${BASE} ${ORANGE}`}>
              <IconeTrombone />!
            </span>
            Versement saisi sans avis
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`${BASE} ${VERT}`}>
              <IconeTrombone />1
            </span>
            Avis de versement joint
          </span>
        </p>
      )}

      {ouvert && (
        <PanneauCommentaires
          key={ouvert.date + ouvert.champ}
          agenceId={agence.id}
          mois={mois}
          date={ouvert.date}
          champInitial={ouvert.champ}
          options={OPTIONS_COMMENTAIRE}
          commentaires={parJour.get(ouvert.date) ?? []}
          peutCommenter={peutCommenter}
          estAdmin={estAdmin}
          onFermer={() => setOuvert(null)}
        />
      )}

      {avisOuvert && (
        <PanneauAvis
          agenceId={agence.id}
          mois={mois}
          date={avisOuvert}
          avis={avisParJour.get(avisOuvert) ?? []}
          peutAjouter={peutCommenter}
          estAdmin={estAdmin}
          onFermer={() => setAvisOuvert(null)}
        />
      )}
    </div>
  )
}