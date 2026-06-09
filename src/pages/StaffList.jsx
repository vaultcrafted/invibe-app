import { useEffect, useState } from 'react'
import { Search, Grid, List, ChevronDown, X } from 'lucide-react'
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

function FilterChip({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: active ? (color || 'var(--iv-blue)') : 'var(--bg-secondary)',
      color: active ? '#fff' : 'var(--text-secondary)',
      border: '0.5px solid ' + (active ? (color || 'var(--iv-blue)') : 'var(--border)'),
      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s'
    }}>
      {label}
    </button>
  )
}

export default function StaffList() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDest, setFilterDest] = useState(null)
  const [filterRuolo, setFilterRuolo] = useState(null)
  const [filterAccount, setFilterAccount] = useState(null) // 'admin' | 'staff' | null
  const [viewMode, setViewMode] = useState('list')
  const [showDestFilter, setShowDestFilter] = useState(false)
  const [showRuoloFilter, setShowRuoloFilter] = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      setStaff(data || [])
      setLoading(false)
    })
  }, [])

  // Ruoli presenti nel dataset, ordinati per RUOLI_ORDER poi alfabetico
  const allRuoli = [...new Set(staff.map(s => s.ruolo).filter(Boolean))].sort((a, b) => {
    const ia = RUOLI_ORDER.indexOf(a.toUpperCase())
    const ib = RUOLI_ORDER.indexOf(b.toUpperCase())
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })

  const filtered = staff
    .filter(s => {
      const matchSearch = !search || `${s.nome} ${s.cognome}`.toLowerCase().includes(search.toLowerCase())
      const matchDest = !filterDest || (s.assigned_shifts || []).some(a => a.destination === filterDest)
      const matchRuolo = !filterRuolo || (s.ruolo && s.ruolo.toUpperCase().includes(filterRuolo.toUpperCase()))
      const matchAccount = !filterAccount ||
        (filterAccount === 'admin' && s.role === 'admin') ||
        (filterAccount === 'staff' && s.role !== 'admin')
      return matchSearch && matchDest && matchRuolo && matchAccount
    })
    .sort((a, b) => {
      const ca = (a.cognome || '').toLowerCase()
      const cb = (b.cognome || '').toLowerCase()
      if (ca < cb) return -1
      if (ca > cb) return 1
      return (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase())
    })

  const activeFiltersCount = [filterDest, filterRuolo, filterAccount].filter(Boolean).length

  if (!isAdmin) return null

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <style>{`
        .staff-grid { grid-template-columns: repeat(2, 1fr) !important; }
        @media (min-width: 768px) { .staff-grid { grid-template-columns: repeat(4, 1fr) !important; } }
        .filter-scroll::-webkit-scrollbar { display: none; }
        .filter-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Staff</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{filtered.length} di {staff.length} membri</div>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <List size={15} />
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--iv-blue)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <Grid size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 0' }}>
        <div className="search-bar" style={{ margin: 0 }}>
          <Search size={15} color="var(--text-tertiary)" />
          <input placeholder="Cerca per nome o cognome..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>
      </div>

      {/* Filter pills row */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Account type */}
        <div className="filter-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
          <FilterChip label="Tutti" active={!filterAccount} onClick={() => setFilterAccount(null)} />
          <FilterChip label="⭐ Admin" active={filterAccount === 'admin'} onClick={() => setFilterAccount(filterAccount === 'admin' ? null : 'admin')} color="#D4AC0D" />
          <FilterChip label="Staff" active={filterAccount === 'staff'} onClick={() => setFilterAccount(filterAccount === 'staff' ? null : 'staff')} />
        </div>
      </div>

      {/* Destination + Ruolo dropdowns */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8 }}>

        {/* Destinazione */}
        <div style={{ position: 'relative', flex: 1 }}>
          <button
            onClick={() => { setShowDestFilter(v => !v); setShowRuoloFilter(false) }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: filterDest ? 'var(--iv-blue)' : 'var(--bg-secondary)',
              color: filterDest ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (filterDest ? 'var(--iv-blue)' : 'var(--border)'),
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6
            }}
          >
            <span>{filterDest ? DESTINATIONS.find(d => d.id === filterDest)?.name : 'Destinazione'}</span>
            <ChevronDown size={13} style={{ transform: showDestFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showDestFilter && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
              background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden'
            }}>
              <button onClick={() => { setFilterDest(null); setShowDestFilter(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: !filterDest ? 'var(--iv-blue)' : 'var(--text-primary)', fontWeight: !filterDest ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
                Tutte le destinazioni
              </button>
              {DESTINATIONS.map(d => (
                <button key={d.id} onClick={() => { setFilterDest(d.id); setShowDestFilter(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: filterDest === d.id ? 'var(--iv-blue)' : 'var(--text-primary)', fontWeight: filterDest === d.id ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{d.flag}</span> {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ruolo */}
        <div style={{ position: 'relative', flex: 1 }}>
          <button
            onClick={() => { setShowRuoloFilter(v => !v); setShowDestFilter(false) }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: filterRuolo ? getRuoloColor(filterRuolo) : 'var(--bg-secondary)',
              color: filterRuolo ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (filterRuolo ? getRuoloColor(filterRuolo) : 'var(--border)'),
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6
            }}
          >
            <span>{filterRuolo || 'Ruolo'}</span>
            <ChevronDown size={13} style={{ transform: showRuoloFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showRuoloFilter && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
              background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
              maxHeight: 280, overflowY: 'auto'
            }}>
              <button onClick={() => { setFilterRuolo(null); setShowRuoloFilter(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: !filterRuolo ? 'var(--iv-blue)' : 'var(--text-primary)', fontWeight: !filterRuolo ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
                Tutti i ruoli
              </button>
              {allRuoli.map(r => {
                const c = getRuoloColor(r)
                return (
                  <button key={r} onClick={() => { setFilterRuolo(r); setShowRuoloFilter(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: filterRuolo === r ? c : 'var(--text-primary)', fontWeight: filterRuolo === r ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    {r}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Clear all */}
        {activeFiltersCount > 0 && (
          <button onClick={() => { setFilterDest(null); setFilterRuolo(null); setFilterAccount(null) }} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--danger-light)', border: '0.5px solid #FECACA', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            <X size={12} /> {activeFiltersCount}
          </button>
        )}
      </div>

      {/* List */}
      {/* Backdrop to close dropdowns */}
      {(showDestFilter || showRuoloFilter) && (
        <div onClick={() => { setShowDestFilter(false); setShowRuoloFilter(false) }} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Nessuno staff trovato.</p></div>
      ) : viewMode === 'list' ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => <StaffRowCard key={s.id} s={s} />)}
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className='staff-grid'>
          {filtered.map(s => <StaffGridCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}

function StaffRowCard({ s }) {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const assigned = s.assigned_shifts || []
  const color = getRuoloColor(s.ruolo)
  const turniStr = assigned.length > 0
    ? assigned.map(a => {
        const d = DESTINATIONS.find(d => d.id === a.destination)
        return (d?.name || a.destination)[0].toUpperCase() + a.shift_num
      }).join(' · ')
    : s.role === 'admin' ? 'tutti i turni' : 'nessun turno'

  return (
    <div className="card" onClick={() => isAdmin && navigate(`/staff/${s.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: isAdmin ? 'pointer' : 'default' }}>
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
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const color = getRuoloColor(s.ruolo)
  const assigned = s.assigned_shifts || []

  return (
    <div className="card staff-grid-card" onClick={() => isAdmin && navigate(`/staff/${s.id}`)} style={{ textAlign: 'center', padding: 10, cursor: isAdmin ? 'pointer' : 'default' }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', margin: '0 auto 8px',
        background: color + '22', border: '1.5px solid ' + color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: color
      }}>
        {getInitials(s.nome, s.cognome)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{s.nome} {s.cognome}</div>
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
