import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'

// Watercolor SVG backgrounds per destination
const DEST_WATERCOLORS = {
  pag: {
    bg: '#B8D4E8',
    colors: ['#7BAFD4', '#4A8DB5', '#2E6E9E', '#B8D4E8', '#D4E8F5'],
    emoji: '🏖️'
  },
  corfu: {
    bg: '#A8C8A0',
    colors: ['#6BA368', '#4A8B47', '#2D6E2A', '#A8C8A0', '#D0E8CE'],
    emoji: '🌿'
  },
  zante: {
    bg: '#F5D98B',
    colors: ['#E8C05A', '#D4A030', '#B88020', '#F5D98B', '#FFF0B8'],
    emoji: '☀️'
  },
  gallipoli: {
    bg: '#E8B8B8',
    colors: ['#D48080', '#C05050', '#A03030', '#E8B8B8', '#F5D5D5'],
    emoji: '🌊'
  },
  sardegna: {
    bg: '#C8B8E8',
    colors: ['#9878C8', '#7850B0', '#582898', '#C8B8E8', '#E8D8F8'],
    emoji: '🏔️'
  },
}

function WatercolorCard({ destId, name, turni, onClick }) {
  const wc = DEST_WATERCOLORS[destId] || DEST_WATERCOLORS.pag
  const id = `wc-${destId}`

  return (
    <button className="dest-card" onClick={onClick} style={{ aspectRatio: '1/1' }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`blur-${destId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed={destId.length * 7} result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <radialGradient id={`rg1-${destId}`} cx="30%" cy="30%" r="60%">
            <stop offset="0%" stopColor={wc.colors[0]} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={wc.colors[1]} stopOpacity="0.5"/>
          </radialGradient>
          <radialGradient id={`rg2-${destId}`} cx="70%" cy="70%" r="50%">
            <stop offset="0%" stopColor={wc.colors[2]} stopOpacity="0.7"/>
            <stop offset="100%" stopColor={wc.colors[3]} stopOpacity="0.3"/>
          </radialGradient>
        </defs>
        <rect width="200" height="200" fill={wc.bg}/>
        <ellipse cx="70" cy="70" rx="90" ry="80" fill={`url(#rg1-${destId})`} filter={`url(#blur-${destId})`} opacity="0.85"/>
        <ellipse cx="140" cy="130" rx="70" ry="65" fill={`url(#rg2-${destId})`} filter={`url(#blur-${destId})`} opacity="0.75"/>
        <ellipse cx="100" cy="100" rx="50" ry="45" fill={wc.colors[4]} filter={`url(#blur-${destId})`} opacity="0.4"/>
        {/* Paper texture lines */}
        {[20,60,100,140,180].map((y, i) => (
          <line key={i} x1="0" y1={y} x2="200" y2={y + 5} stroke="rgba(255,255,255,0.08)" strokeWidth="8"/>
        ))}
      </svg>
      <div className="dest-card-overlay" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.45) 100%)' }} />
      <div className="dest-card-content">
        <div style={{ fontSize: 22, marginBottom: 4 }}>{wc.emoji}</div>
        <div className="dest-card-name">{name}</div>
        <div className="dest-card-turns">{turni} turni</div>
      </div>
    </button>
  )
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

      <div style={{ padding: '16px 16px 4px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Seleziona meta
      </div>

      {/* Card grid — max 2 col, dimensioni fisse su desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        padding: '8px 16px 16px',
        maxWidth: 430,
      }}>
        {visibleDests.map(dest => (
          <WatercolorCard
            key={dest.id}
            destId={dest.id}
            name={dest.name}
            turni={dest.turni}
            onClick={() => navigate(`/destination/${dest.id}`)}
          />
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
