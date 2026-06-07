import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'

// Watercolor images per destination (Unsplash watercolor style)
const DEST_IMAGES = {
  pag: 'https://images.unsplash.com/photo-1555990793-da11153b6a71?w=400&q=80',
  corfu: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&q=80',
  zante: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400&q=80',
  gallipoli: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=400&q=80',
  sardegna: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
}

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
        <button className="topbar-avatar" onClick={() => navigate('/account')} title="Il mio account">
          {initials.toUpperCase()}
        </button>
      </div>

      <div style={{ padding: '16px 16px 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
        Seleziona meta
      </div>

      <div className="dest-grid">
        {visibleDests.map(dest => (
          <button
            key={dest.id}
            className="dest-card"
            onClick={() => navigate(`/destination/${dest.id}`)}
          >
            <img
              className="dest-card-img"
              src={DEST_IMAGES[dest.id]}
              alt={dest.name}
              onError={e => { e.target.style.background = '#1E6BF1'; e.target.style.display = 'block' }}
            />
            <div className="dest-card-overlay" />
            <div className="dest-card-content">
              <div className="dest-card-name">{dest.name}</div>
              <div className="dest-card-turns">{dest.turni} turni</div>
            </div>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div style={{ padding: '4px 16px 16px' }}>
          <button className="btn-outline" style={{ width: '100%' }} onClick={() => navigate('/admin')}>
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
