import { useEffect, useState } from 'react'
import { Search, Grid, List } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { useNavigate } from 'react-router-dom'

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

export default function StaffList() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('list')

  useEffect(() => {
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      setStaff(data || [])
      setLoading(false)
    })
  }, [])

  // Turni dello staff loggato (o tutti se admin)
  const myShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  // Raggruppa per turno: per ogni turno mio, trova tutti gli staff assegnati a quel turno
  const groups = myShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const members = staff
      .filter(s =>
        (s.assigned_shifts || []).some(a => a.destination === destination && a.shift_num === shift_num)
        || s.role === 'admin'  // gli admin appaiono in ogni turno
      )
      .filter(s => {
        if (!search) return true
        return `${s.nome} ${s.cognome}`.toLowerCase().includes(search.toLowerCase())
      })
      .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''))

    return { destination, shift_num, dest, members }
  }).filter(g => g.dest) // rimuovi eventuali destinazioni non trovate

  // Per admin: rimuovi duplicati di turno (stessa dest+shift)
  const seen = new Set()
  const dedupedGroups = groups.filter(g => {
    const key = g.destination + '_' + g.shift_num
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const totalVisible = [...new Set(dedupedGroups.flatMap(g => g.members.map(m => m.id)))].length

  if (loading) return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Staff</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{totalVisible} colleghi</div>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
            <List size={15} />
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
            <Grid size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 0' }}>
        <div className="search-bar" style={{ margin: 0 }}>
          <Search size={15} color="var(--text-tertiary)" />
          <input placeholder="Cerca per nome o cognome..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>}
        </div>
      </div>

      {/* Gruppi per turno */}
      <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {dedupedGroups.length === 0 && (
          <div className="empty-state"><p>Nessun turno assegnato.</p></div>
        )}
        {dedupedGroups.map(({ destination, shift_num, dest, members }) => {
          const color = DEST_COLORS[destination] || 'var(--iv-blue)'
          const label = shiftLabel(destination, shift_num)
          if (members.length === 0 && search) return null

          return (
            <div key={destination + '_' + shift_num}>
              {/* Intestazione turno */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {label}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{dest.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{members.length} membri</div>
                </div>
              </div>

              {/* Cards */}
              {members.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '10px 0' }}>Nessun risultato</div>
              ) : viewMode === 'list' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(s => <StaffRowCard key={s.id} s={s} isAdmin={isAdmin} navigate={navigate} color={color} />)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {members.map(s => <StaffGridCard key={s.id} s={s} isAdmin={isAdmin} navigate={navigate} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StaffRowCard({ s, isAdmin, navigate, color }) {
  const ruoloColor = getRuoloColor(s.ruolo)
  return (
    <div className="card" onClick={() => isAdmin && navigate(`/staff/${s.id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: isAdmin ? 'pointer' : 'default' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: ruoloColor + '22', border: '1.5px solid ' + ruoloColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: ruoloColor }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{s.nome} {s.cognome}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {s.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, color: '#D4AC0D' }}>⭐ Admin</span>}
          {s.ruolo && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: ruoloColor + '18', color: ruoloColor, border: '0.5px solid ' + ruoloColor + '44' }}>
              {s.ruolo}
            </span>
          )}
        </div>
      </div>
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
      {s.role === 'admin' && <div style={{ fontSize: 9, fontWeight: 700, color: '#D4AC0D', marginTop: 4 }}>⭐ Admin</div>}
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
