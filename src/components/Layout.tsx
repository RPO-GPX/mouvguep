import type { ReactElement } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AgenceProvider, useAgence } from '../contexts/AgenceContext'

const ICONES: Record<string, ReactElement> = {
  caisse: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  brq: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h7" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11h14V8M10 12h4" />
    </>
  ),
  tableau: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  agences: (
    <>
      <path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M3 21h18" />
      <path d="M8 8h2M8 12h2M8 16h2" />
    </>
  ),
  comptes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M17 5a3 3 0 010 6M21.5 20c-.3-2.5-1.5-4.2-3.5-5" />
    </>
  ),
}

function Icone({ nom }: { nom: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONES[nom]}
    </svg>
  )
}

const ROLES: Record<string, string> = {
  agence: 'Caissier',
  suivi: 'Chargé de suivi',
  regional: 'Directeur régional',
  admin: 'Administrateur',
}

function Cadre() {
  const { profile, signOut } = useAuth()
  const { agences, agenceId, agence, setAgenceId, chargees } = useAgence()

  const items = [
    { to: '/', titre: 'Mouvement de caisse', icone: 'caisse', visible: true },
    { to: '/brq', titre: 'BRQ', icone: 'brq', visible: true },
    { to: '/archive', titre: 'Archive BRQ', icone: 'archive', visible: true },
    {
      to: '/tableau-de-bord',
      titre: 'Tableau de bord',
      icone: 'tableau',
      visible: !!profile && profile.role !== 'agence',
    },
    { to: '/agences', titre: 'Agences', icone: 'agences', visible: profile?.role === 'admin' },
    { to: '/comptes', titre: 'Comptes', icone: 'comptes', visible: profile?.role === 'admin' },
  ]

  const lien = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
      isActive ? 'bg-marine text-white' : 'text-[#4a5178] hover:bg-fond'
    }`

  const initiales = (profile?.nom ?? '?')
    .split(/\s+/)
    .map((m) => m[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const agenceIndisponible = profile?.role === 'agence' && chargees && !agence

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="print:hidden bg-white border-b lg:border-b-0 lg:border-r border-bord lg:w-60 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 flex flex-col gap-3 lg:gap-7 p-4 lg:p-5">
        <img src="/logo-guepex.png" alt="GUEPEX Express Delivery" className="h-9 w-auto self-start ml-1" />

        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {items
            .filter((i) => i.visible)
            .map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === '/'} className={lien}>
                <Icone nom={i.icone} />
                {i.titre}
              </NavLink>
            ))}
        </nav>

        <div className="lg:mt-auto flex flex-col gap-3">
          <div className="hidden lg:flex items-center gap-3 rounded-2xl bg-fond p-3">
            <div className="w-9 h-9 shrink-0 rounded-full bg-rouge-bouton text-white flex items-center justify-center text-sm font-extrabold">
              {initiales}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-bold truncate">{profile?.nom}</div>
              <div className="text-xs text-doux truncate">{ROLES[profile?.role ?? 'agence']}</div>
            </div>
          </div>
          <button onClick={signOut} className="btn btn-clair">
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="print:hidden flex items-center justify-end gap-3 px-6 lg:px-8 pt-5">
          {profile?.role !== 'agence' ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-doux">
              Agence
              <select
                value={agenceId ?? ''}
                onChange={(e) => setAgenceId(e.target.value)}
                className="champ w-auto min-w-56 h-10"
              >
                {agences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-sm font-semibold text-doux">{agence?.nom}</span>
          )}
        </div>
        <main className="flex-1 px-6 lg:px-8 py-5 print:p-0">
          {agenceIndisponible ? (
            <div className="carte max-w-lg p-6 space-y-2">
              <h1 className="text-xl font-extrabold">Agence indisponible</h1>
              <p className="text-sm text-doux">
                Ton agence est désactivée ou ne t'est pas encore affectée. Contacte l'administrateur.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <AgenceProvider>
      <Cadre />
    </AgenceProvider>
  )
}