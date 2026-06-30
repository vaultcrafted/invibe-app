import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Topbar({ showBack = false, showAvatar = true }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const initials = ((profile?.nome?.[0] || '') + (profile?.cognome?.[0] || '')).toUpperCase()

  return (
    <div className="topbar">
      {showBack ? (
        <button className="topbar-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} color="#fff" />
        </button>
      ) : (
        <div style={{ width: 32 }} />
      )}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <img src="/Logo.png" alt="Invibe" onClick={() => navigate('/')} style={{ height: 26, objectFit: 'contain', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
      </div>
      {showAvatar ? (
        <button className="topbar-avatar" onClick={() => navigate('/account')} title="Account">
          {initials}
        </button>
      ) : (
        <div style={{ width: 34 }} />
      )}
    </div>
  )
}
