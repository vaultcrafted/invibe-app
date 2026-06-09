import { useEffect, useState } from 'react'
import { Search, Grid, List, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { useNavigate } from 'react-router-dom'
import VotePanel from '../components/VotePanel'

const RUOLO_COLORS = {
  CM: '#1E6BF1', ACM: '#2E86C1', CA: '#8E44AD', SUPERVISOR: '#D4AC0D',
  ARM: '#E67E22', RM: '#16A085', DJ: '#C0392B', FOTO: '#2ECC71',
  VIDEO: '#E74C3C', VOCALIST: '#9B59B6', BALLERINO: '#1ABC9C',
  BALLERINA: '#F39C12', ACA: '#27AE60', 'STAFF U': '#5D6D7E',
  'STAFF D': '#7F8C8D', UFFICIO: '#2C3E50',
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
const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}
const DEST_IMAGES = {
  pag: '/Pag.png', corfu: '/Corfu.png', zante: '/Zante.png',
  gallipoli: '/Gallipoli.png', sardegna: '/Sardegna.png',
}

export default function StaffList() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedDest, setSelectedDest] = useState(null) // destination id
  const [selectedShift, setSelectedShift] = useState(null) // shift_num

  useEffect(() => {
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      setStaff(data || [])
      setLoading(false)
    })
  }, [])

  // Turni accessibili a questo utente
  const myShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  // Destinazioni accessibili (con almeno un turno)
  const myDests = DESTINATIONS.filter(d =>
    myShifts.some(s => s.destination === d.id)
  )

  // Turni per la destinazione selezionata
  const shiftsForDest = selectedDest
    ? myShifts.filter(s => s.destination === selectedDest).map(s => s.shift_num).sort((a, b) => a - b)
    : []

  // Membri del turno selezionato
  const members = (selectedDest && selectedShift !== null)
    ? staff
        .filter(s =>
          (s.assigned_shifts || []).some(a => a.destination === selectedDest && a.shift_num === selectedShift)
          && (!s.ruolo || !s.ruolo.toUpperCase().includes('UFFICIO'))
        )
        .filter(s => {
          if (!search) return true
          return `${s.nome} ${s.cognome}`.toLowerCase().includes(search.toLowerCase())
        })
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''))
    : []

  const color = selectedDest ? DEST_COLORS[selectedDest] : 'var(--iv-blue)'
  const destObj = DESTINATIONS.find(d => d.id === selectedDest)

  function goBack() {
    if (selectedShift !== null) { setSelectedShift(null); setSearch('') }
    else { setSelectedDest(null) }
  }

  if (loading) return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  // ── LIVELLO 3: lista staff del turno ──
  if (selectedDest && selectedShift !== null) {
    return (
      <div className="page">
        <Topbar showBack={false} showAvatar={false} />
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goBack} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={16} color="var(--text-secondary)" />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{destObj?.name} · <span style={{ color }}>{shiftLabel(selectedDest, selectedShift)}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{members.length} membri</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('list')} style={{ padding: '6px 10px', background: viewMode === 'list' ? color : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}><List size={14} /></button>
            <button onClick={() => setViewMode('grid')} style={{ padding: '6px 10px', background: viewMode === 'grid' ? color : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}><Grid size={14} /></button>
          </div>
        </div>
        <div style={{ padding: '10px 16px 0' }}>
          <div className="search-bar" style={{ margin: 0 }}>
            <Search size={15} color="var(--text-tertiary)" />
            <input placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>}
          </div>
        </div>
        <div style={{ padding: '10px 16px 32px' }}>
          <VotePanel
            destination={selectedDest}
            shiftNum={selectedShift}
            members={members}
            currentUserId={profile?.id}
            isAdmin={isAdmin}
            profile={profile}
            renderList={(votableMembers, hasVoted, currentVote, castVote, voteCounts, isAdminView) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(s => (
                  <StaffRowCard
                    key={s.id}
                    s={s}
                    isAdmin={isAdmin}
                    navigate={navigate}
                    votable={s.id !== profile?.id && votableMembers.some(m => m.id === s.id)}
                    isVoted={currentVote === s.id}
                    hasVoted={hasVoted}
                    voteCount={isAdminView ? (voteCounts[s.id] || 0) : null}
                    onVote={() => castVote(s.id)}
                  />
                ))}
              </div>
            )}
          />
        </div>
      </div>
    )
  }

  // ── LIVELLO 2: turni della destinazione ──
  if (selectedDest) {
    return (
      <div className="page">
        <Topbar showBack={false} showAvatar={false} />
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goBack} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={16} color="var(--text-secondary)" />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{destObj?.name}</div>
        </div>
        <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shiftsForDest.map(sNum => {
            const count = staff.filter(s =>
              (s.assigned_shifts || []).some(a => a.destination === selectedDest && a.shift_num === sNum)
              && (!s.ruolo || !s.ruolo.toUpperCase().includes('UFFICIO'))
            ).length
            const shiftInfo = SHIFTS[selectedDest]?.find(s => s.num === sNum)
            return (
              <button key={sNum} className="card"
                onClick={() => setSelectedShift(sNum)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {shiftLabel(selectedDest, sNum)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{shiftLabel(selectedDest, sNum)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{shiftInfo?.label} · {count} membri</div>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── LIVELLO 1: lista destinazioni ──
  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div style={{ padding: '16px 16px 4px' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Staff</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Seleziona una destinazione</div>
      </div>
      <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {myDests.map(dest => {
          const col = DEST_COLORS[dest.id]
          const destShifts = myShifts.filter(s => s.destination === dest.id)
          return (
            <button key={dest.id} className="card"
              onClick={() => setSelectedDest(dest.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
              {/* Immagine laterale */}
              <div style={{ width: 72, height: 72, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                <img src={DEST_IMAGES[dest.id]} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: col + '44' }} />
              </div>
              <div style={{ flex: 1, padding: '0 4px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{dest.name}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                  {destShifts.map(s => (
                    <span key={s.shift_num} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: col + '18', color: col, border: '0.5px solid ' + col + '44' }}>
                      {shiftLabel(dest.id, s.shift_num)}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ marginRight: 12, flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StaffRowCard({ s, isAdmin, navigate, votable, isVoted, hasVoted, voteCount, onVote }) {
  const color = getRuoloColor(s.ruolo)
  return (
    <div className="card"
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: (isAdmin || votable) ? 'pointer' : 'default',
        background: isVoted ? '#FEF9C3' : 'var(--bg-primary)',
        border: isVoted ? '1px solid #FDE047' : '0.5px solid var(--border)',
      }}
      onClick={() => {
        if (votable && !hasVoted && onVote) onVote()
        else if (isAdmin && navigate) navigate(`/staff/${s.id}`)
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: color + '22', border: '1.5px solid ' + color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{s.nome} {s.cognome}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {s.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, color: '#D4AC0D' }}>⭐ Admin</span>}
          {s.ruolo && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: color + '18', color, border: '0.5px solid ' + color + '44' }}>
              {s.ruolo}
            </span>
          )}
        </div>
      </div>

      {/* Admin: badge voti */}
      {voteCount > 0 && (
        <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#D4AC0D', color: '#fff', flexShrink: 0 }}>
          {voteCount} ⭐
        </div>
      )}

      {/* Checkbox voto (solo se votabile) */}
      {votable && (
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: '1.5px solid ' + (isVoted ? '#D4AC0D' : hasVoted ? 'var(--border)' : 'var(--text-tertiary)'),
          background: isVoted ? '#D4AC0D' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hasVoted && !isVoted ? 0.35 : 1,
        }}>
          {isVoted && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      )}

      {/* Freccia admin (solo se non votabile) */}
      {isAdmin && !votable && (
        <ChevronRight size={14} color="var(--text-tertiary)" />
      )}
    </div>
  )
}

function StaffGridCard({ s, isAdmin, navigate }) {
  const color = getRuoloColor(s.ruolo)
  return (
    <div className="card" onClick={() => isAdmin && navigate(`/staff/${s.id}`)}
      style={{ textAlign: 'center', padding: '12px 8px', cursor: isAdmin ? 'pointer' : 'default' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', margin: '0 auto 8px', background: color + '22', border: '1.5px solid ' + color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{s.nome} {s.cognome}</div>
      {s.role === 'admin' && <div style={{ fontSize: 9, fontWeight: 700, color: '#D4AC0D', marginTop: 4 }}>⭐</div>}
      {s.ruolo && (
        <div style={{ marginTop: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: color + '18', color, border: '0.5px solid ' + color + '44' }}>
            {s.ruolo}
          </span>
        </div>
      )}
    </div>
  )
}
