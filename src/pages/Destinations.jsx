import Topbar from '../components/Topbar'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'

const DEST_IMAGES = {
  pag: '/Pag.png',
  corfu: '/Corfu.png',
  zante: '/Zante.png',
  gallipoli: '/Gallipoli.png',
  sardegna: '/Sardegna.png',
}

export default function Destinations() {
  const { profile, isAdmin } = useAuth()
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
      <Topbar showBack={false} />
          </button>
        ))}
      </div>

      {isAdmin && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'var(--iv-blue)', color: '#fff',
              borderRadius: 14, fontSize: 15, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(30,107,241,0.35)',
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" fill="rgba(255,255,255,0.2)"/>
            </svg>
            Pannello Admin
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ marginLeft: 'auto' }}>
              <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
