import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAgence } from '../contexts/AgenceContext'
import { useConfirmer } from '../components/ConfirmProvider'

type RoleCompte = 'agence' | 'suivi' | 'regional'

type Compte = {
  id: string
  nom: string | null
  email: string | null
  role: 'agence' | 'regional' | 'suivi' | 'admin'
  agence_id: string | null
  region: string | null
  actif: boolean
}

type Recap = { titre: string; nom: string; email: string; mot_de_passe: string }

const ROLES: Record<string, string> = {
  agence: 'Caissier',
  suivi: 'Chargé de suivi',
  regional: 'Directeur régional',
  admin: 'Administrateur',
}
const REGIONS = ['Est', 'Ouest', 'Centre', 'Sud']

function genererMotDePasse(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const octets = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')
}

// Appelle la fonction serveur et remonte le vrai message d'erreur
async function appeler(corps: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('gerer-comptes', { body: corps })
  if (error) {
    let detail = error.message
    const contexte = (error as { context?: Response }).context
    if (contexte && typeof contexte.json === 'function') {
      try {
        const j = await contexte.json()
        if (j?.erreur) detail = j.erreur
      } catch {
        // on garde le message générique
      }
    }
    throw new Error(detail)
  }
  if (data?.erreur) throw new Error(data.erreur)
  return data
}

export default function Comptes() {
  const { profile } = useAuth()
  const { agences } = useAgence()
  const queryClient = useQueryClient()
  const confirmer = useConfirmer()

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [role, setRole] = useState<RoleCompte>('agence')
  const [agenceId, setAgenceId] = useState('')
  const [region, setRegion] = useState('Est')
  const [edition, setEdition] = useState<Compte | null>(null)
  const [reinit, setReinit] = useState<Compte | null>(null)
  const [mdpReinit, setMdpReinit] = useState('')
  const [voir, setVoir] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [recap, setRecap] = useState<Recap | null>(null)
  const [copie, setCopie] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtreRole, setFiltreRole] = useState('')

  const { data: comptes = [], isLoading, error } = useQuery({
    queryKey: ['comptes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, email, role, agence_id, region, actif')
        .order('nom')
      if (error) throw error
      return data as Compte[]
    },
  })

  const viderFormulaire = () => {
    setNom('')
    setEmail('')
    setMotDePasse('')
    setRole('agence')
    setAgenceId('')
    setRegion('Est')
    setEdition(null)
  }

  const action = useMutation({
    mutationFn: appeler,
    onSuccess: (_data, corps) => {
      setMessage(null)
      if (corps.action === 'creer') {
        setCopie(false)
        setRecap({
          titre: 'Compte créé',
          nom: String(corps.nom ?? ''),
          email: String(corps.email ?? ''),
          mot_de_passe: String(corps.mot_de_passe ?? ''),
        })
        viderFormulaire()
      }
      if (corps.action === 'reinitialiser') {
        const c = comptes.find((x) => x.id === corps.user_id)
        setCopie(false)
        setRecap({
          titre: 'Mot de passe modifié',
          nom: c?.nom ?? '',
          email: c?.email ?? '',
          mot_de_passe: String(corps.mot_de_passe ?? ''),
        })
        setReinit(null)
        setMdpReinit('')
      }
      if (corps.action === 'modifier') viderFormulaire()
      return queryClient.invalidateQueries({ queryKey: ['comptes'] })
    },
    onError: (e: Error) => setMessage(e.message),
  })

  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  const nomAgence = (id: string | null) => agences.find((a) => a.id === id)?.nom ?? '—'

  function enregistrer(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!edition && motDePasse.length < 8) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    const identite = {
      nom: nom.trim(),
      role,
      agence_id: role === 'agence' ? agenceId || null : null,
      region: role === 'regional' ? region : null,
    }
    if (edition) action.mutate({ action: 'modifier', user_id: edition.id, ...identite })
    else
      action.mutate({
        action: 'creer',
        email: email.trim(),
        mot_de_passe: motDePasse,
        ...identite,
      })
  }

  function validerReinit() {
    if (!reinit) return
    if (mdpReinit.length < 8) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setMessage(null)
    action.mutate({ action: 'reinitialiser', user_id: reinit.id, mot_de_passe: mdpReinit })
  }

  function commencerEdition(c: Compte) {
    setEdition(c)
    setNom(c.nom ?? '')
    setEmail(c.email ?? '')
    setRole(c.role === 'admin' ? 'agence' : c.role)
    setAgenceId(c.agence_id ?? '')
    setRegion(c.region ?? 'Est')
    setReinit(null)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function copier(texte: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
    } catch {
      setMessage('Copie impossible : recopie le mot de passe à la main.')
    }
  }

  const t = recherche.trim().toLowerCase()
  const liste = comptes.filter(
    (c) =>
      (!t || (c.nom ?? '').toLowerCase().includes(t) || (c.email ?? '').toLowerCase().includes(t)) &&
      (!filtreRole || c.role === filtreRole),
  )

  const etiquette = 'block text-xs font-bold text-doux mb-1'
  const lienAction = 'text-xs font-bold text-marine underline underline-offset-2'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Comptes utilisateurs</h1>
        <p className="text-sm font-semibold text-doux">
          Crée les accès, choisis les mots de passe et désactive les comptes qui partent.
        </p>
      </header>

      {recap && (
        <div className="rounded-2xl border border-[#f0d9a8] bg-[#fff8e8] p-4 space-y-2">
          <p className="font-extrabold">{recap.titre}</p>
          <p className="text-sm">
            <b>{recap.nom}</b> · E-mail : <b>{recap.email}</b>
          </p>
          <p className="text-sm">
            Mot de passe :{' '}
            <span className="font-mono text-lg bg-white border border-bord rounded-lg px-2.5 py-1 select-all">
              {recap.mot_de_passe}
            </span>
          </p>
          <p className="text-xs text-[#8a4b00]">
            Transmets-le à la personne. Ce récapitulatif disparaît quand tu fermes cet encadré ou la
            page : le mot de passe n'est conservé nulle part dans l'application. En cas d'oubli, tu
            peux toujours le réinitialiser.
          </p>
          <div className="flex gap-2">
            <button onClick={() => copier(recap.mot_de_passe)} className="btn btn-marine !min-h-9">
              {copie ? 'Copié ✓' : 'Copier le mot de passe'}
            </button>
            <button onClick={() => setRecap(null)} className="btn btn-clair !min-h-9">
              Fermer
            </button>
          </div>
        </div>
      )}

      <form onSubmit={enregistrer} autoComplete="off" className="carte p-5 space-y-4">
        <h2 className="font-extrabold">
          {edition ? `Modifier : ${edition.email}` : 'Nouveau compte'}
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={etiquette}>Nom complet</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="off"
              className="champ font-medium"
            />
          </div>
          <div>
            <label className={etiquette}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!edition}
              autoComplete="off"
              className="champ font-medium disabled:bg-entete"
            />
          </div>

          {!edition && (
            <div>
              <label className={etiquette}>Mot de passe (8 caractères min.)</label>
              <div className="flex gap-1.5">
                <input
                  type={voir ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="new-password"
                  className="champ font-medium"
                />
                <button
                  type="button"
                  onClick={() => setVoir(!voir)}
                  className="btn btn-clair !px-3"
                  title="Afficher / masquer"
                >
                  {voir ? 'Masquer' : 'Voir'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMotDePasse(genererMotDePasse())
                    setVoir(true)
                  }}
                  className="btn btn-clair !px-3"
                  title="Générer un mot de passe"
                >
                  Générer
                </button>
              </div>
            </div>
          )}

          <div>
            <label className={etiquette}>Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleCompte)}
              className="champ font-medium"
            >
              <option value="agence">Caissier</option>
              <option value="suivi">Chargé de suivi de caisse</option>
              <option value="regional">Directeur régional</option>
            </select>
          </div>
          {role === 'agence' && (
            <div>
              <label className={etiquette}>Agence</label>
              <select
                value={agenceId}
                onChange={(e) => setAgenceId(e.target.value)}
                className="champ font-medium"
              >
                <option value="">— Choisir —</option>
                {agences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === 'regional' && (
            <div>
              <label className={etiquette}>Région</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="champ font-medium"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {role === 'suivi' && (
          <p className="text-xs text-doux">
            Le chargé de suivi voit et contrôle toutes les agences (niveau direction générale).
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={action.isPending} className="btn btn-rouge">
            {edition ? 'Enregistrer' : 'Créer le compte'}
          </button>
          {edition && (
            <button type="button" onClick={viderFormulaire} className="btn btn-clair">
              Annuler
            </button>
          )}
          {action.isPending && <span className="text-sm text-doux">En cours…</span>}
          {message && <span className="text-sm font-semibold text-[#b4232f]">{message}</span>}
        </div>
      </form>

      {reinit && (
        <div className="carte p-5 space-y-3 !border-marine/30">
          <p className="font-extrabold">Nouveau mot de passe pour {reinit.nom ?? reinit.email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type={voir ? 'text' : 'password'}
              value={mdpReinit}
              onChange={(e) => setMdpReinit(e.target.value)}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              className="champ w-64 font-medium"
            />
            <button type="button" onClick={() => setVoir(!voir)} className="btn btn-clair">
              {voir ? 'Masquer' : 'Voir'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMdpReinit(genererMotDePasse())
                setVoir(true)
              }}
              className="btn btn-clair"
            >
              Générer
            </button>
            <button
              type="button"
              onClick={validerReinit}
              disabled={action.isPending}
              className="btn btn-rouge"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => {
                setReinit(null)
                setMdpReinit('')
              }}
              className="btn btn-clair"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={etiquette}>Rechercher</label>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou e-mail"
            autoComplete="off"
            className="champ w-64 h-10 font-medium"
          />
        </div>
        <div>
          <label className={etiquette}>Rôle</label>
          <select
            value={filtreRole}
            onChange={(e) => setFiltreRole(e.target.value)}
            className="champ w-auto h-10 font-medium"
          >
            <option value="">Tous</option>
            <option value="agence">Caissiers</option>
            <option value="suivi">Chargés de suivi</option>
            <option value="regional">Directeurs régionaux</option>
            <option value="admin">Administrateurs</option>
          </select>
        </div>
        <span className="text-sm font-semibold text-doux pb-2.5">{liste.length} compte(s)</span>
      </div>

      {isLoading && <p className="text-doux">Chargement…</p>}
      {error && <p className="text-[#b4232f]">Erreur : {error.message}</p>}

      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr>
              <th className="text-left">Nom</th>
              <th className="text-left">E-mail</th>
              <th className="text-left">Rôle</th>
              <th className="text-left">Agence / Région</th>
              <th className="text-left">Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.id} className={c.actif ? 'hover:bg-[#f9faff]' : 'bg-[#f7f8fc] text-doux'}>
                <td className="font-bold">{c.nom ?? '—'}</td>
                <td>{c.email ?? '—'}</td>
                <td>{ROLES[c.role]}</td>
                <td>
                  {c.role === 'agence' && nomAgence(c.agence_id)}
                  {c.role === 'regional' && `Région ${c.region ?? '—'}`}
                  {(c.role === 'suivi' || c.role === 'admin') && 'Toutes les agences'}
                </td>
                <td>
                  {c.actif ? (
                    <span className="puce puce-ok">Actif</span>
                  ) : (
                    <span className="puce puce-alerte">Désactivé</span>
                  )}
                </td>
                <td>
                  {c.role !== 'admin' && (
                    <div className="flex items-center gap-4">
                      <button onClick={() => commencerEdition(c)} className={lienAction}>
                        Modifier
                      </button>
                      <button
                        onClick={() => {
                          setReinit(c)
                          setMdpReinit('')
                          setEdition(null)
                          setMessage(null)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={lienAction}
                      >
                        Mot de passe
                      </button>
                      <button
                                                onClick={async () => {
                          const desactiver = c.actif
                          const ok = await confirmer({
                            titre: desactiver
                              ? `Désactiver le compte de ${c.nom ?? c.email} ?`
                              : `Réactiver le compte de ${c.nom ?? c.email} ?`,
                            message: desactiver
                              ? "Il ne pourra plus se connecter (une session déjà ouverte peut rester active jusqu'à une heure)."
                              : undefined,
                            confirmer: desactiver ? 'Désactiver' : 'Réactiver',
                            danger: desactiver,
                          })
                          if (ok)
                            action.mutate({
                              action: desactiver ? 'desactiver' : 'reactiver',
                              user_id: c.id,
                            })
                        }}
                        className={`text-xs font-bold underline underline-offset-2 ${
                          c.actif ? 'text-[#b4232f]' : 'text-[#17653f]'
                        }`}
                      >
                        {c.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}