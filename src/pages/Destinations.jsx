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
      <div className="topbar">
        <img src="/Logotipo.png" alt="Invibe" style={{ height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <img src="/Logo.png" alt="Invibe" style={{ height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <button className="topbar-avatar" onClick={() => navigate('/account')} title="Il mio account">
          {initials.toUpperCase()}
        </button>
      </div>

      <div style={{ padding: '16px 16px 4px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Seleziona meta
      </div>

      {/* Mobile: griglia 2 colonne — Desktop: riga singola centrata */}
      <style>{`
        .dest-grid-responsive {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 8px 16px 16px;
        }
        @media (min-width: 768px) {
          .dest-grid-responsive {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            flex-wrap: nowrap;
            gap: 10px;
            padding: 16px;
          }
          .dest-card-responsive {
            width: 130px !important;
            height: 130px !important;
            flex-shrink: 0;
          }
        }
      `}</style>

      <div className="dest-grid-responsive">
        {visibleDests.map(dest => (
          <button
            key={dest.id}
            className="dest-card dest-card-responsive"
            style={{ aspectRatio: '1/1', position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0 }}
            onClick={() => navigate(`/destination/${dest.id}`)}
          >
            <img
              src={DEST_IMAGES[dest.id]}
              alt={dest.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(160deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)'
            }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)', lineHeight: 1.1 }}>
                {dest.name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: 500 }}>
                {dest.turni} turni
              </div>
            </div>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div style={{ padding: '0 16px 16px' }}>
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
