import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { useVotes } from '../components/VotePanel'
import Topbar from '../components/Topbar'
import { Trophy } from 'lucide-react'

const DEST_COLORS = { pag: '#1E6BF1', corfu: '#059669', zante: '#D97706', gallipoli: '#DC2626', sardegna: '#7C3AED' }
const RUOLO_COLORS = {
  CM: '#1E6BF1', ACM: '#2E86C1', CA: '#8E44AD', SUPERVISOR: '#D4AC0D',
  ARM: '#E67E22', RM: '#16A085', DJ: '#C0392B', FOTO: '#2ECC71',
  VIDEO: '#E74C3C', VOCALIST: '#9B59B6', BALLERINO: '#1ABC9C',
  BALLERINA: '#F39C12', ACA: '#27AE60', 'STAFF U': '#5D6D7E', 'STAFF D': '#7F8C8D',
}
function getRuoloColor(ruolo) {
  if (!ruolo) return '#5D6D7E'
  for (const key of Object.keys(RUOLO_COLORS)) {
    if (ruolo.toUpperCase().includes(key)) return RUOLO_COLORS[key]
  }
  return '#5D6D7E'
}
function getInitials(nome, cognome) {
  return ((nome?.[0] || '') + (cognome?.[0] || '')).toUpperCase()
}

export default function WeeklyVote() {
  const { destId, shiftNum } = useParams()
  const { isAdmin, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const { weeklyVote, weeklyVoteCounts, castWeeklyVote, canSeeVotes, voting } = useVotes({
    destination: destId,
    shiftNum: parseInt(shiftNum),
    currentUserId: profile?.id,
    isAdmin,
    profile,
  })

  const dest = DESTINATIONS.find(d => d.id === destId)
  const color = DEST_COLORS[destId] || 'var(--iv-blue)'

  useEffect(() => {
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      const filtered = (data || []).filter(s =>
        (s.assigned_shifts || []).some(a => a.destination === destId && a.shift_num === parseInt(shiftNum))
        && s.id !== profile?.id
        && (!s.ruolo || !s.ruolo.toUpperCase().includes('UFFICIO'))
      )
      setMembers(filtered)
      setLoading(false)
    })
  }, [])

  // Ordina per voti se canSeeVotes
  const sortedMembers = canSeeVotes
    ? [...members].sort((a, b) => (weeklyVoteCounts[b.id] || 0) - (weeklyVoteCounts[a.id] || 0))
    : members

  if (loading) return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Migliore della settimana</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          {dest?.name} · {shiftLabel(destId, parseInt(shiftNum))}
        </div>
        {weeklyVote && (
          <div style={{ marginTop: 12, padding: '8px 16px', background: '#FEF9C3', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #FDE047' }}>
            <Trophy size={13} color="#D4AC0D" fill="#D4AC0D" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#854D0E' }}>
              Hai votato: {members.find(m => m.id === weeklyVote)?.nome} {members.find(m => m.id === weeklyVote)?.cognome}
            </span>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedMembers.map((s, i) => {
          const ruoloColor = getRuoloColor(s.ruolo)
          const isVoted = weeklyVote === s.id
          const count = weeklyVoteCounts[s.id] || 0

          return (
            <div key={s.id}
              onClick={() => !voting && castWeeklyVote(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 12, cursor: 'pointer',
                background: isVoted ? '#FEF9C3' : 'var(--bg-secondary)',
                border: '1px solid ' + (isVoted ? '#FDE047' : 'var(--border)'),
                transition: 'all 0.15s',
              }}>
              {/* Posizione se admin vede voti */}
              {canSeeVotes && count > 0 && (
                <div style={{ width: 24, fontSize: 13, fontWeight: 800, color: i === 0 ? '#D4AC0D' : 'var(--text-tertiary)', textAlign: 'center', flexShrink: 0 }}>
                  {i + 1}°
                </div>
              )}
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: ruoloColor + '22', border: '1.5px solid ' + ruoloColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: ruoloColor }}>
                {getInitials(s.nome, s.cognome)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.nome} {s.cognome}</div>
                {s.ruolo && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{s.ruolo}</div>}
              </div>
              {/* Badge voti admin */}
              {canSeeVotes && count > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: isVoted ? '#D4AC0D' : 'var(--bg-primary)', color: isVoted ? '#fff' : 'var(--text-secondary)', border: '1px solid ' + (isVoted ? '#D4AC0D' : 'var(--border)') }}>
                  {count} ⭐
                </div>
              )}
              {/* Checkbox */}
              <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: '1.5px solid ' + (isVoted ? '#D4AC0D' : 'var(--text-tertiary)'), background: isVoted ? '#D4AC0D' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isVoted && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
