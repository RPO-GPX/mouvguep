import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Options = {
  titre: string
  message?: string
  confirmer?: string
  annuler?: string
  danger?: boolean
}

type Demande = Options & { resoudre: (ok: boolean) => void }

type Confirmer = (options: Options) => Promise<boolean>

const ConfirmContext = createContext<Confirmer | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [demande, setDemande] = useState<Demande | null>(null)

  const confirmer = useCallback<Confirmer>(
    (options) =>
      new Promise<boolean>((resoudre) => {
        setDemande((precedente) => {
          precedente?.resoudre(false)
          return { ...options, resoudre }
        })
      }),
    [],
  )

  const fermer = (ok: boolean) => {
    demande?.resoudre(ok)
    setDemande(null)
  }

  // La touche Échap annule
  useEffect(() => {
    if (!demande) return
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        demande.resoudre(false)
        setDemande(null)
      }
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [demande])

  return (
    <ConfirmContext.Provider value={confirmer}>
      {children}
      {demande && (
        <div
          className="fixed inset-0 z-[60] bg-marine-fonce/40 flex items-center justify-center p-4"
          onClick={() => fermer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-titre"
            className="carte shadow-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-titre" className="text-lg font-extrabold">
              {demande.titre}
            </h2>
            {demande.message && (
              <p className="text-sm text-doux whitespace-pre-line">{demande.message}</p>
            )}
            <div className="flex justify-end gap-2 pt-3">
              <button className="btn btn-clair" onClick={() => fermer(false)}>
                {demande.annuler ?? 'Annuler'}
              </button>
              <button
                autoFocus
                className={`btn ${demande.danger ? 'btn-rouge' : 'btn-marine'}`}
                onClick={() => fermer(true)}
              >
                {demande.confirmer ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmer() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmer doit être utilisé dans ConfirmProvider')
  return ctx
}