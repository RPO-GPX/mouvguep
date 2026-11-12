import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import MouvementCaisse from './pages/MouvementCaisse'
import Brq from './pages/Brq'
import BrqImpression from './pages/BrqImpression'
import TableauDeBord from './pages/TableauDeBord'
import Agences from './pages/Agences'
import ArchiveBrq from './pages/ArchiveBrq'
import Comptes from './pages/Comptes'
import Agents from './pages/Agents'


function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <p className="p-6">Chargement…</p>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<MouvementCaisse />} />
        <Route path="brq" element={<Brq />} />
                <Route path="archive" element={<ArchiveBrq />} />
                        <Route path="agents" element={<Agents />} />
                        <Route path="comptes" element={<Comptes />} />
                                <Route path="agences" element={<Agences />} />
                <Route path="brq/imprimer/:date" element={<BrqImpression />} />
                        <Route path="tableau-de-bord" element={<TableauDeBord />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}