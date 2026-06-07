import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, getInitials } from '../lib/constants'
import { SERVICES } from '../lib/constants'

export default function GroupList() {
  const { destId, shiftNum } = useParams()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tutti')
  const [search, setSearch] = useState('')

  const dest = DESTINATIONS.find(d => d.id === destId)
  const shift = SHIFTS[destId]?.find(s => s.num === parseInt(shiftNum))

  useEffect(() => {
    fetchGroups()
    // Realtime subscription
    const channel = supabase
      .channel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [destId, shiftNum])

  async function fetchGroups() {
    setLoading(true)
    const { data, error } = await supabase
      .from('groups')
      .select('*, participants(id, nome, cognome, sesso, nascita)')
      .eq('destination', destId)
      .eq('shift_num', parseInt(shiftNum))
      .order('capogruppo_display')
    if (!error) setGroups(data || [])
    setLoading(false)
  }

  const totalPeople = groups.reduce((s, g) => s + (g.participants?.length || 0), 0)

  function isComplete(g) {
    return SERVICES.every(sv => g[sv.id])
  }
  function hasMissing(g) {
    return SERVICES.some(sv => !g[sv.id])
  }

  const filtered = groups
    .filter(g => {
      if (tab === 'completi') return isComplete(g)
      if (tab === 'mancanti') return hasMissing(g)
      return true
    })
    .filter(g => !search || g.capogruppo_display?.toLowerCase().includes(search.toLowerCase()))

  if (!dest || !shift) return <div className="loading-screen"><p>Turno non trovato.</p></div>

  return (
    <div className="page">
      <Topbar showBack={true} />
      </div>

      <div className="tabs">
        {['tutti', 'mancanti', 'completi'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <Search size={15} color="var(--text-tertiary)" />
        <input
          placeholder="Cerca capogruppo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>
        )}
      </div>

      <div style={{ padding: '4px 16px 4px', fontSize: 11, color: 'var(--text-secondary)' }}>
        {filtered.length} gruppi
      </div>

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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {group.capogruppo_display}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {participants.length} {participants.length === 1 ? 'persona' : 'persone'}
            {' · '}
            <span className="dot-m">{males}M</span>
            {' '}
            <span className="dot-f">{females}F</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {SERVICES.map(sv => (
          <span key={sv.id} className={`flag-chip ${group[sv.id] ? 'on' : ''}`}>
            <span className="dot" />
            {sv.label}
          </span>
        ))}
      </div>

      {group.alloggio && (
        <div className="alloggio-tag">
          🏠 {group.alloggio}
        </div>
      )}
    </button>
  )
}
