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
  const { profile, isAdmin, isFullAccess } = useAuth()
  const navigate = useNavigate()

  const assignedDests = profile?.assigned_shifts
    ? [...new Set(profile.assigned_shifts.map(s => s.destination))]
    : []

  return (
    <div className="page">
      <div className="sticky-header">
        <Topbar showBack={false} showAvatar={true} />
      </div>
      <div style={{ padding: '16px 16px 4px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Seleziona meta
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 16px 16px', justifyContent: 'center' }}>
        {DESTINATIONS.map(dest => {
          const personalMode = !isFullAccess && assignedDests.length > 0
          const isMine = assignedDests.includes(dest.id)
          const highlight = personalMode && isMine
          const dim = personalMode && !isMine
          return (
            <button
              key={dest.id}
              onClick={() => navigate('/destination/' + dest.id)}
              style={{
                width: 150, height: 150, position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', padding: 0, flexShrink: 0,
                border: highlight ? '2.5px solid var(--iv-blue)' : '2.5px solid transparent',
                opacity: dim ? 0.5 : 1,
                filter: dim ? 'saturate(0.7)' : 'none',
                transform: dim ? 'scale(0.94)' : 'scale(1)',
                boxShadow: highlight ? '0 6px 20px rgba(30,107,241,0.28)' : 'none',
                transition: 'transform .15s, opacity .15s',
              }}
            >
              <img src={DEST_IMAGES[dest.id]} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)' }} />
              {highlight && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--iv-blue)', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                  Tuo turno
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)', lineHeight: 1.1 }}>{dest.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: 500 }}>{dest.turni} turni</div>
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <button
          onClick={() => navigate('/mie-info')}
          style={{ width: '100%', padding: '16px 18px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg, var(--iv-blue) 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="#fff" strokeWidth="2"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>La mia settimana</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Programma, alloggi, locali & market, rooming</div>
          </div>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
    </div>
  )
}
