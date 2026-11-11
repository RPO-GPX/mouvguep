import { useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BUCKET_AVIS, type Avis } from '../hooks/useAvis'
import { formatDate } from '../lib/dates'

const ROLES: Record<string, string> = {
  agence: 'Caissier',
  suivi: 'Chargé de suivi',
  regional: 'Directeur régional',
  admin: 'Administrateur',
}

const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX = 5 * 1024 * 1024

const taille = (octets: number) =>
  octets >= 1024 * 1024
    ? (octets / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo'
    : Math.max(1, Math.round(octets / 1024)) + ' Ko'

type Props = {
  agenceId: string
  mois: string
  date: string
  avis: Avis[]
  peutAjouter: boolean
  estAdmin: boolean
  onFermer: () => void
}

export default function PanneauAvis({
  agenceId,
  mois,
  date,
  avis,
  peutAjouter,
  estAdmin,
  onFermer,
}: Props) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ['avis', agenceId, mois] })

  const televerser = useMutation({
    mutationFn: async (fichier: File) => {
      if (!TYPES.includes(fichier.type)) {
        throw new Error('Format non accepté : PDF, JPG, PNG ou WebP uniquement.')
      }
      if (fichier.size > MAX) throw new Error('Fichier trop lourd : 5 Mo maximum.')

      const propre = fichier.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
      const chemin = `${agenceId}/${date}/${crypto.randomUUID()}-${propre}`

      const { error: e1 } = await supabase.storage
        .from(BUCKET_AVIS)
        .upload(chemin, fichier, { contentType: fichier.type })
      if (e1) throw new Error(e1.message)

      const { error: e2 } = await supabase.from('avis_versement').insert({
        agence_id: agenceId,
        date,
        chemin,
        nom_fichier: fichier.name,
        type_mime: fichier.type,
        taille: fichier.size,
      })
      if (e2) {
        await supabase.storage.from(BUCKET_AVIS).remove([chemin])
        throw new Error(e2.message)
      }
    },
    onSuccess: () => {
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  const supprimer = useMutation({
    mutationFn: async (a: Avis) => {
      const { error: e1 } = await supabase.storage.from(BUCKET_AVIS).remove([a.chemin])
      if (e1) throw new Error(e1.message)
      const { error: e2 } = await supabase.from('avis_versement').delete().eq('id', a.id)
      if (e2) throw new Error(e2.message)
    },
    onSuccess: () => {
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const champ = e.target
    const fichier = champ.files?.[0]
    if (fichier) televerser.mutate(fichier)
    champ.value = ''
  }

  // Ouvre le fichier dans un nouvel onglet via un lien temporaire (2 minutes)
  async function ouvrir(a: Avis) {
    const fenetre = window.open('', '_blank')
    const { data, error } = await supabase.storage.from(BUCKET_AVIS).createSignedUrl(a.chemin, 120)
    if (error || !data) {
      fenetre?.close()
      setMessage("Impossible d'ouvrir le fichier.")
      return
    }
    if (fenetre) fenetre.location.href = data.signedUrl
    else setMessage("Le navigateur a bloqué l'ouverture : autorise les fenêtres pour ce site.")
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-marine-fonce/40 flex items-center justify-center p-4"
      onClick={onFermer}
    >
      <div
        className="carte shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Avis de versement"
      >
        <div className="flex items-start justify-between p-5 border-b border-bord">
          <div>
            <p className="font-extrabold">Avis de versement</p>
            <p className="text-sm font-semibold text-doux">{formatDate(date)}</p>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="text-doux hover:text-encre text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {avis.length === 0 && (
            <p className="text-sm text-doux">Aucun avis de versement pour ce jour.</p>
          )}
          {avis.map((a) => (
            <div key={a.id} className="bg-fond rounded-xl p-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => ouvrir(a)}
                  className="text-left text-sm font-bold text-marine underline underline-offset-2 break-all"
                >
                  {a.nom_fichier}
                </button>
                <span className="text-xs text-doux whitespace-nowrap">{taille(a.taille)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-doux">
                <span>
                  <b className="text-encre">{a.auteur_nom ?? '—'}</b>
                  {a.auteur_role && ` · ${ROLES[a.auteur_role] ?? a.auteur_role}`}
                </span>
                <span>{new Date(a.cree_le).toLocaleString('fr-FR')}</span>
              </div>
              {estAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement « ${a.nom_fichier} » ?`))
                      supprimer.mutate(a)
                  }}
                  className="text-xs font-bold text-[#b4232f] underline underline-offset-2"
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-bord space-y-2">
          {peutAjouter ? (
            <>
              <label
                className={`btn btn-marine cursor-pointer ${
                  televerser.isPending ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {televerser.isPending ? 'Envoi en cours…' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={choisir}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-doux">
                PDF, JPG, PNG ou WebP · 5 Mo maximum. Seul l'administrateur peut supprimer un avis.
              </p>
            </>
          ) : (
            <p className="text-xs text-doux">Lecture seule : tu ne peux pas ajouter d'avis.</p>
          )}
          {message && <p className="text-sm font-semibold text-[#b4232f]">{message}</p>}
        </div>
      </div>
    </div>
  )
}