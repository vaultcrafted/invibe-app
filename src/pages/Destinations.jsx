import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'
import Topbar from '../components/Topbar'

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

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={true} />
      <div style={{ padding: '16px 16px 4px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Seleziona meta
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '8px 16px 16px' }}>
        {visibleDests.map(dest => (
          <button
            key={dest.id}
            onClick={() => navigate(`/destination/${dest.id}`)}
            style={{ aspectRatio: '1/1', position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, display: 'block' }}
          >
            <img src={DEST_IMAGES[dest.id]} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)', lineHeight: 1.1 }}>{dest.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: 500 }}>{dest.turni} turni</div>
            </div>
          </button>
        ))}
      </div>
      {isAdmin && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ width: '100%', padding: '14px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(30,107,241,0.35)' }}
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
        </div>
      )}
    </div>
  )
}
