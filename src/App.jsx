import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Destinations from './pages/Destinations'
import ShiftSelect from './pages/ShiftSelect'
import GroupList from './pages/GroupList'
import GroupDetail from './pages/GroupDetail'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--iv-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>IV</div>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Destinations /></ProtectedRoute>} />
        <Route path="/destination/:destId" element={<ProtectedRoute><ShiftSelect /></ProtectedRoute>} />
        <Route path="/shift/:destId/:shiftNum" element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
        <Route path="/group/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
