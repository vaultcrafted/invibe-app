import { useEffect, useState } from 'react'
import { Search, Grid, List } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'
import Topbar from '../components/Topbar'
import { useNavigate } from 'react-router-dom'

const RUOLI_ORDER = ['CM','ACM','CA','SUPERVISOR','ARM','RM','DJ','FOTO','VIDEO','VOCALIST','BALLERINO','BALLERINA','ACA','STAFF U','STAFF D','UFFICIO']

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

export default function StaffList() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('tutti')
  const [viewMode, setViewMode] = useState('list')

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      setStaff(data || [])
      setLoading(false)
    })
  }, [])

  const allRuoli = [...new Set(staff.map(s => s.ruolo).filter(Boolean))].sort()

  const filtered = staff.filter(s => {
    const matchSearch = !search || `${s.nome} ${s.cognome}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'tutti' || 
      (filterRole === 'admin' && s.role === 'admin') ||
      (filterRole === 'staff' && s.role === 'staff') ||
      (s.ruolo && s.ruolo.toUpperCase().includes(filterRole.toUpperCase()))
    return matchSearch && matchRole
  })

  if (!isAdmin) return null

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Staff</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{filtered.length} di {staff.length} membri</div>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="search-bar" style={{ margin: 0 }}>
          <Search size={15} color="var(--text-tertiary)" />
          <input placeholder="Cerca per nome o cognome..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Role filter */}
          <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 6, paddingBottom: 2 }}>
            {['tutti', 'admin', 'staff'].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: filterRole === r ? 'var(--iv-blue)' : 'var(--bg-secondary)',
                color: filterRole === r ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (filterRole === r ? 'var(--iv-blue)' : 'var(--border)'),
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
              }}>
                {r === 'tutti' ? 'Tutti' : r === 'admin' ? '⭐ Admin' : 'Staff'}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
            <button onClick={() => setViewMode('list')} style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <List size={15} />
            </button>
            <button onClick={() => setViewMode('grid')} style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <Grid size={15} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Nessuno staff trovato.</p></div>
      ) : viewMode === 'list' ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => <StaffRowCard key={s.id} s={s} />)}
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map(s => <StaffGridCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}

function StaffRowCard({ s }) {
  const assigned = s.assigned_shifts || []
  const color = getRuoloColor(s.ruolo)
  const turniStr = assigned.length > 0
    ? assigned.map(a => {
        const d = DESTINATIONS.find(d => d.id === a.destination)
        return (d?.name || a.destination)[0].toUpperCase() + a.shift_num
      }).join(' · ')
    : s.role === 'admin' ? 'tutti i turni' : 'nessun turno'

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: color + '22', border: '1.5px solid ' + color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: color
      }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.nome} {s.cognome}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {s.role === 'admin' && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#D4AC0D' }}>⭐ Admin</span>
          )}
          {s.ruolo && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: color + '18', color: color, border: '0.5px solid ' + color + '44' }}>
              {s.ruolo}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{turniStr}</span>
        </div>
      </div>
    </div>
  )
}

function StaffGridCard({ s }) {
  const color = getRuoloColor(s.ruolo)
  const assigned = s.assigned_shifts || []

  return (
    <div className="card" style={{ textAlign: 'center', padding: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px',
        background: color + '22', border: '1.5px solid ' + color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: color
      }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{s.nome} {s.cognome}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
        {s.role === 'admin' && <span style={{ fontSize: 9, fontWeight: 700, color: '#D4AC0D' }}>⭐</span>}
        {s.ruolo && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: color + '18', color: color, border: '0.5px solid ' + color + '44' }}>
            {s.ruolo}
          </span>
        )}
      </div>
      {assigned.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 5 }}>
          {assigned.map(a => {
            const d = DESTINATIONS.find(d => d.id === a.destination)
            return (d?.name || a.destination)[0].toUpperCase() + a.shift_num
          }).join(' · ')}
        </div>
      )}
    </div>
  )
}
