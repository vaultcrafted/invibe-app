import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'

export default function Destinations() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const assignedDests = profile?.assigned_shifts
    ? [...new Set(profile.assigned_shifts.map(s => s.destination))]
    : []

  const visibleDests = isAdmin
    ? DESTINATIONS
    : DESTINATIONS.filter(d => assignedDests.includes(d.id))

  const initials = profile
    ? (profile.nome?.[0] || '') + (profile.cognome?.[0] || '')
    : '?'

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-logo">IV</div>
        <div className="topbar-info">
          <div className="topbar-title">Invibe Staff</div>
          <div className="topbar-sub">Summer 2026</div>
        </div>
        <button className="topbar-avatar" onClick={signOut} title="Esci">
          {initials.toUpperCase()}
        </button>
      </div>

      <div className="section-label">Seleziona meta</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px 16px' }}>
        {visibleDests.map(dest => (
          <button
            key={dest.id}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer', transition: 'transform 0.1s' }}
            onClick={() => navigate(`/destination/${dest.id}`)}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: 26 }}>{dest.flag}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>{dest.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{dest.turni} turni</div>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div style={{ padding: '0 16px' }}>
          <button
            className="btn-outline"
            style={{ width: '100%' }}
            onClick={() => navigate('/admin')}
          >
            Pannello Admin
          </button>
        </div>
      )}

      {!isAdmin && visibleDests.length === 0 && (
        <div className="empty-state">
          <p>Non hai ancora turni assegnati.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Contatta un admin per l'assegnazione.</p>
        </div>
      )}
    </div>
  )
}
