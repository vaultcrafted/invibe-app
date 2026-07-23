import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navigation from './components/Navigation'
import InstallPrompt from './components/InstallPrompt'
import SyncIndicator from './components/SyncIndicator'
import AiAssistantFab from './components/AiAssistantFab'
import Login from './pages/Login'
import Destinations from './pages/Destinations'
import ShiftSelect from './pages/ShiftSelect'
import GroupList from './pages/GroupList'
import GroupDetail from './pages/GroupDetail'
import Admin from './pages/Admin'
import Account from './pages/Account'
import Dbd from './pages/Dbd'
import DbdAdmin from './pages/DbdAdmin'
import Cassa from './pages/Cassa'
import StaffList from './pages/StaffList'
import StaffProfile from './pages/StaffProfile'
import WeeklyVote from './pages/WeeklyVote'
import StaffInfo from './pages/StaffInfo'
import SyncLog from './pages/SyncLog'

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

function AppShell() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  return (
    <div className="app-shell">
      {!isLogin && <Navigation />}
      <div className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Destinations /></ProtectedRoute>} />
          <Route path="/mie-info" element={<ProtectedRoute><StaffInfo /></ProtectedRoute>} />
          <Route path="/log" element={<ProtectedRoute><SyncLog /></ProtectedRoute>} />
          <Route path="/destination/:destId" element={<ProtectedRoute><ShiftSelect /></ProtectedRoute>} />
          <Route path="/shift/:destId/:shiftNum" element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
          <Route path="/group/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/dbd" element={<ProtectedRoute><Dbd /></ProtectedRoute>} />
          <Route path="/dbd-admin" element={<AdminRoute><DbdAdmin /></AdminRoute>} />
          <Route path="/cassa" element={<AdminRoute><Cassa /></AdminRoute>} />
          <Route path="/staff-list" element={<ProtectedRoute><StaffList /></ProtectedRoute>} />
          <Route path="/staff/:staffId" element={<ProtectedRoute><StaffProfile /></ProtectedRoute>} />
          <Route path="/weekly-vote/:destId/:shiftNum" element={<ProtectedRoute><WeeklyVote /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          {/* redirect vecchio /calendario */}
          <Route path="/calendario" element={<Navigate to="/dbd" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isLogin && <InstallPrompt />}
      {!isLogin && <SyncIndicator />}
      {!isLogin && <AiAssistantFab />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
