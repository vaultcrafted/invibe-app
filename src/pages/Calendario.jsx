import Topbar from '../components/Topbar'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS } from '../lib/constants'

const DEST_COLORS = {
  pag: '#1E6BF1',
  corfu: '#059669',
  zante: '#D97706',
  gallipoli: '#DC2626',
  sardegna: '#7C3AED',
}

const MONTHS = [
  { name: 'Luglio', num: 7, days: 31 },
  { name: 'Agosto', num: 8, days: 31 },
]

export default function Calendario() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const assignedShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  // Build events from assigned shifts
  const events = assignedShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const shift = SHIFTS[destination]?.find(s => s.num === shift_num)
    if (!dest || !shift) return null
    return {
      destination,
      shift_num,
      destName: dest.name,
      flag: dest.flag,
      label: shift.label,
      start: new Date(shift.start),
      end: new Date(shift.end),
      color: DEST_COLORS[destination],
    }
  }).filter(Boolean)

  return (
    <div className="page">
      <Topbar showBack={true} />
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <p>Nessun turno assegnato.</p>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Timeline visuale */}
          {MONTHS.map(month => {
            const monthEvents = events.filter(e =>
              e.start.getMonth() + 1 === month.num || e.end.getMonth() + 1 === month.num
            )
            return (
              <div key={month.num}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
                  {month.name} 2026
                </div>

                {/* Righe giorni */}
                <div style={{ position: 'relative', background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 8px', overflow: 'hidden' }}>
                  {/* Giorni */}
                  <div style={{ display: 'flex', marginBottom: 8 }}>
                    {Array.from({ length: month.days }, (_, i) => i + 1).map(day => (
                      <div key={day} style={{
                        flex: 1, textAlign: 'center',
                        fontSize: day % 5 === 0 || day === 1 ? 9 : 0,
                        color: 'var(--text-tertiary)',
                        fontWeight: 500,
                      }}>
                        {day % 5 === 0 || day === 1 ? day : ''}
                      </div>
                    ))}
                  </div>

                  {/* Barre turni */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {monthEvents.map((ev, idx) => {
                      const startDay = ev.start.getMonth() + 1 === month.num ? ev.start.getDate() : 1
                      const endDay = ev.end.getMonth() + 1 === month.num ? ev.end.getDate() : month.days
                      const leftPct = ((startDay - 1) / month.days) * 100
                      const widthPct = ((endDay - startDay) / month.days) * 100

                      return (
                        <div key={idx} style={{ position: 'relative', height: 28 }}>
                          <div style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: '100%',
                            background: ev.color,
                            borderRadius: 6,
                            display: 'flex', alignItems: 'center',
                            padding: '0 8px',
                            overflow: 'hidden',
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.flag} {ev.destName} T{ev.shift_num}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Lista turni */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>I tuoi turni</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((ev, idx) => (
                <button
                  key={idx}
                  className="card"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', cursor: 'pointer' }}
                  onClick={() => navigate(`/shift/${ev.destination}/${ev.shift_num}`)}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: ev.color,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 16 }}>{ev.flag}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>T{ev.shift_num}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ev.destName} — Turno {ev.shift_num}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.label}</div>
                  </div>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
