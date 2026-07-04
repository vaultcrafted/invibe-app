import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, getInitials, SERVICES, SERVICES_CORFU, getServices, shiftLabel, capogruppoCode, prebookKeyForService } from '../lib/constants'
import Topbar from '../components/Topbar'

function prebookedCount(g, sv) {
  const k = prebookKeyForService(sv.id)
  return k && g.prebook && g.prebook[k] != null ? Number(g.prebook[k]) : 0
}
function isServiceOn(g, sv) {
  return (g[sv.id] || 0) > 0 || prebookedCount(g, sv) > 0
}
function isPrebookedEsc(g) {
  return g.prebook && g.prebook.escursioni != null && Number(g.prebook.escursioni) > 0
}
function groupServices(g) {
  return getServices(g.destination)
}

export default function GroupList() {
  const { destId, shiftNum } = useParams()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [svcFilter, setSvcFilter] = useState(null)   // id servizio da filtrare, o 'prebook_esc'

  const dest = DESTINATIONS.find(d => d.id === destId)
  const shift = SHIFTS[destId]?.find(s => s.num === parseInt(shiftNum))

  useEffect(() => {
    fetchGroups()
    const channel = supabase.channel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [destId, shiftNum])

  async function fetchGroups() {
    setLoading(true)
    const { data } = await supabase
      .from('groups')
      .select('*, participants(id, nome, cognome, sesso, nascita)')
      .eq('destination', destId)
      .eq('shift_num', parseInt(shiftNum))
      .order('capogruppo_display')
    setGroups(data || [])
    setLoading(false)
  }

  const totalPeople = groups.reduce((s, g) => s + (g.participants?.length || 0), 0)

  const filtered = groups
    .filter(g => {
      if (!search) return true
      const q = search.toLowerCase()
      return g.capogruppo_display?.toLowerCase().includes(q) || String(g.capogruppo_code || '').toLowerCase().includes(q)
    })
    .filter(g => {
      if (!svcFilter) return true
      if (svcFilter === 'prebook_esc') return isPrebookedEsc(g)
      const sv = getServices(destId).find(s => s.id === svcFilter)
      return sv ? isServiceOn(g, sv) : true
    })
    .sort((a, b) => {
      const na = parseInt(capogruppoCode(a.capogruppo_code)) || Infinity
      const nb = parseInt(capogruppoCode(b.capogruppo_code)) || Infinity
      if (na !== nb) return na - nb
      return (a.capogruppo_display || '').localeCompare(b.capogruppo_display || '')
    })

  if (!dest || !shift) return <div className="loading-screen"><p>Turno non trovato.</p></div>

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div style={{ padding: '12px 16px 2px', fontSize: 13, fontWeight: 600 }}>{dest.name} · {shiftLabel(destId, parseInt(shiftNum))}</div>
      <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{shift.label} · {totalPeople} partecipanti</div>
      <div className="search-bar">
        <Search size={15} color="var(--text-tertiary)" />
        <input placeholder="Cerca capogruppo o codice..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>}
      </div>
      <div style={{ padding: '2px 16px 8px' }}>
        <div style={{ position: 'relative' }}>
          <select
            value={svcFilter || ''}
            onChange={e => setSvcFilter(e.target.value || null)}
            style={{
              width: '100%', appearance: 'none', WebkitAppearance: 'none',
              padding: '11px 38px 11px 14px', borderRadius: 12,
              border: '0.5px solid ' + (svcFilter ? 'var(--iv-blue)' : 'var(--border)'),
              background: svcFilter ? 'var(--iv-blue-light)' : 'var(--bg-secondary)',
              color: svcFilter ? 'var(--iv-blue)' : 'var(--text-secondary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Filtra per servizio — tutti i gruppi</option>
            <option value="prebook_esc">Escursioni prenotate (prebooking)</option>
            {getServices(destId).map(sv => (
              <option key={sv.id} value={sv.id}>{sv.label}</option>
            ))}
          </select>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path d="M6 9l6 6 6-6" stroke={svcFilter ? 'var(--iv-blue)' : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '0 16px 4px', fontSize: 11, color: 'var(--text-secondary)' }}>{filtered.length} gruppi{svcFilter ? ' · filtro attivo' : ''}</div>
      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Nessun gruppo trovato.</p></div>
      ) : (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(group => (
            <GroupCard key={group.id} group={group} onClick={() => navigate(`/group/${group.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function chipStyle(active, color, bgActive) {
  return {
    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
    background: active ? bgActive : 'var(--bg-secondary)',
    color: active ? color : 'var(--text-secondary)',
    border: '0.5px solid ' + (active ? color : 'var(--border)'),
  }
}

function GroupCard({ group, onClick }) {
  const participants = group.participants || []
  const males = participants.filter(p => p.sesso === 'M').length
  const females = participants.filter(p => p.sesso === 'F').length
  const initials = getInitials(group.capogruppo_display)
  return (
    <button className="card" style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="initials" style={{ width: 36, height: 36, fontSize: 12 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {capogruppoCode(group.capogruppo_code) && <span className="code-chip">{capogruppoCode(group.capogruppo_code)}</span>}
            <span style={{ fontSize: 14, fontWeight: 600 }}>{group.capogruppo_display}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {participants.length} persone · <span className="dot-m">{males}M</span> <span className="dot-f">{females}F</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {groupServices(group).map(sv => {
          const pb = prebookKeyForService(sv.id) === 'escursioni' && prebookedCount(group, sv) > 0
          return (
            <span key={sv.id} className={`flag-chip ${isServiceOn(group, sv) ? 'on' : ''}`} style={pb ? { background: '#FEF3C7', color: '#B45309', borderColor: '#FCD9A5' } : undefined}>
              <span className="dot" style={pb ? { background: '#D97706' } : undefined} />{sv.label}
            </span>
          )
        })}
      </div>
      {group.alloggio && <div className="alloggio-tag">🏠 {group.alloggio}</div>}
    </button>
  )
}
