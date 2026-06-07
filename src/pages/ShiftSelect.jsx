import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS } from '../lib/constants'
import Topbar from '../components/Topbar'

export default function ShiftSelect() {
  const { destId } = useParams()
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const dest = DESTINATIONS.find(d => d.id === destId)
  const shifts = SHIFTS[destId] || []

  const assignedNums = isAdmin
    ? shifts.map(s => s.num)
    : (profile?.assigned_shifts || []).filter(s => s.destination === destId).map(s => s.shift_num)

  if (!dest) return <div className="loading-screen"><p>Destinazione non trovata.</p></div>

  const myShifts = shifts.filter(s => assignedNums.includes(s.num))
  const otherShifts = shifts.filter(s => !assignedNums.includes(s.num))

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div style={{ padding: '12px 16px 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {dest.flag} {dest.name} — Seleziona turno
      </div>
      <div className="section-label">I tuoi turni</div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {myShifts.map(shift => (
          <ShiftCard key={shift.num} shift={shift} mine={true} onClick={() => navigate(`/shift/${destId}/${shift.num}`)} />
        ))}
      </div>
      {!isAdmin && otherShifts.length > 0 && (
        <div>
          <div className="section-label">Altri turni</div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherShifts.map(shift => (
              <ShiftCard key={shift.num} shift={shift} mine={false} onClick={null} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftCard({ shift, mine, onClick }) {
  return (
    <button
      className={`card ${mine ? 'active-blue' : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: mine ? 'pointer' : 'default', width: '100%' }}
      onClick={onClick}
      disabled={!mine}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: mine ? 'var(--iv-blue)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: mine ? '#fff' : 'var(--text-tertiary)', flexShrink: 0 }}>
        T{shift.num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: mine ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>Turno {shift.num}</div>
        <div style={{ fontSize: 12, color: mine ? 'var(--text-secondary)' : 'var(--text-tertiary)', marginTop: 1 }}>{shift.label}</div>
      </div>
      {mine ? <span className="badge badge-blue">il tuo</span> : <span className="badge badge-gray">accesso limitato</span>}
    </button>
  )
}
