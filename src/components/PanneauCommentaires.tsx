import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Commentaire } from '../hooks/useCommentaires'
import { formatDate } from '../lib/dates'

const ROLES: Record<string, string> = {
  agence: 'Caissier',
  suivi: 'Chargé de suivi',
  regional: 'Directeur régional',
  admin: 'Administrateur',
}

type Props = {
  agenceId: string
  mois: string
  date: string
  champ: string
  titreChamp: string
  commentaires: Commentaire[]
  peutCommenter: boolean
  estAdmin: boolean
  onFermer: () => void
}

export default function PanneauCommentaires({
  agenceId,
  mois,
  date,
  champ,
  titreChamp,
  commentaires,
  peutCommenter,
  estAdmin,
  onFermer,
}: Props) {
  const queryClient = useQueryClient()
  const [texte, setTexte] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const rafraichir = () =>
    queryClient.invalidateQueries({ queryKey: ['commentaires', agenceId, mois] })

  const ajouter = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('commentaires_mouvement')
        .insert({ agence_id: agenceId, date, champ, texte: texte.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setTexte('')
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commentaires_mouvement').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setMessage(null)
      return rafraichir()
    },
    onError: (e: Error) => setMessage(e.message),
  })

  return (
    <div
      className="fixed inset-0 z-50 bg-marine-fonce/40 flex items-center justify-center p-4"
      onClick={onFermer}
    >
      <div
        className="carte shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Commentaires"
      >
        <div className="flex items-start justify-between p-5 border-b border-bord">
          <div>
            <p className="font-extrabold">Commentaires — {titreChamp}</p>
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
          {commentaires.length === 0 && (
            <p className="text-sm text-doux">Aucun commentaire sur cette case.</p>
          )}
          {commentaires.map((c) => (
            <div key={c.id} className="bg-fond rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-doux">
                <span>
                  <b className="text-encre">{c.auteur_nom ?? '—'}</b>
                  {c.auteur_role && ` · ${ROLES[c.auteur_role] ?? c.auteur_role}`}
                </span>
                <span>{new Date(c.cree_le).toLocaleString('fr-FR')}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.texte}</p>
              {estAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm('Supprimer ce commentaire ?')) supprimer.mutate(c.id)
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
          {peutCommenter ? (
            <>
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Ajouter un commentaire…"
                className="champ !h-auto py-2.5 text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => ajouter.mutate()}
                  disabled={ajouter.isPending || texte.trim() === ''}
                  className="btn btn-marine"
                >
                  Ajouter
                </button>
                <span className="text-xs text-doux">
                  Un commentaire ne peut plus être modifié après l'envoi.
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-doux">Lecture seule : tu ne peux pas commenter.</p>
          )}
          {message && <p className="text-sm font-semibold text-[#b4232f]">{message}</p>}
        </div>
      </div>
    </div>
  )
}