import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, getInitials, SERVICES, SERVICES_CORFU, getServices, shiftLabel, capogruppoCode, prebookKeyForService, isPrebookingPagato } from '../lib/constants'
import Topbar from '../components/Topbar'

function prebookedCount(g, sv) {
  const k = prebookKeyForService(sv.id)
  return k && g.prebook && g.prebook[k] != null ? Number(g.prebook[k]) : 0
}
function isServiceOn(g, sv) {
  return (g[sv.id] || 0) > 0 || prebookedCount(g, sv) > 0
}
// "Pagato" = giallo nella card: pagato in meta, oppure escursioni prenotate (già pagate).
function isPaid(g, sv) {
  const paidMeta = (g[sv.id] || 0) > 0
  const isEsc = prebookKeyForService(sv.id) === 'escursioni'
  return paidMeta || (isEsc && prebookedCount(g, sv) > 0)
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
  const [filterOpen, setFilterOpen] = useState(false)

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

  const filtered = groups
    .filter(g => {
      if (!search) return true
      const q = search.toLowerCase()
      return g.capogruppo_display?.toLowerCase().includes(q) || String(g.capogruppo_code || '').toLowerCase().includes(q)
    })
    .filter(g => {
      if (!svcFilter) return true
      if (svcFilter === 'prebook_esc') return g.prebook && Number(g.prebook.escursioni) > 0
      if (svcFilter === 'prebook_ssp') return g.prebook && Number(g.prebook.ssp) > 0
      const negate = svcFilter.startsWith('no:')
      const svId = svcFilter.replace(/^(has:|no:)/, '')
      const sv = getServices(destId).find(s => s.id === svId)
      if (!sv) return true
      return negate ? !isServiceOn(g, sv) : isPaid(g, sv)
    })
    .sort((a, b) => {
      const na = parseInt(capogruppoCode(a.capogruppo_code)) || Infinity
      const nb = parseInt(capogruppoCode(b.capogruppo_code)) || Infinity
      if (na !== nb) return na - nb
      return (a.capogruppo_display || '').localeCompare(b.capogruppo_display || '')
    })

  if (!dest || !shift) return <div className="loading-screen"><p>Turno non trovato.</p></div>

  // Conteggi sui gruppi attualmente visibili (rispettano ricerca + filtro servizio)
  const fPeople = filtered.reduce((s, g) => s + (g.participants?.length || 0), 0)
  const fMales = filtered.reduce((s, g) => s + (g.participants?.filter(p => p.sesso === 'M').length || 0), 0)
  const fFemales = filtered.reduce((s, g) => s + (g.participants?.filter(p => p.sesso === 'F').length || 0), 0)

  // Quantità EFFETTIVA di un servizio per un gruppo:
  // - se pagato in prebooking (escursioni sempre, SSP bonifico) -> quantità prenotata (o confermata per escursioni)
  // - altrimenti -> quantità incassata in meta
  const svQty = (g, sv) => {
    const pk = prebookKeyForService(sv.id)
    const prebooked = (pk && g.prebook && g.prebook[pk] != null) ? Number(g.prebook[pk]) : null
    if (prebooked != null && isPrebookingPagato(sv.id, g.destination, g.shift_num)) {
      if (pk === 'escursioni' && g.escursioni_conf != null) return Number(g.escursioni_conf) || 0
      return prebooked
    }
    return Number(g[sv.id]) || 0
  }

  // Conteggio del filtro: per i filtri su un servizio conta la QUANTITÀ effettiva
  // (prenotazioni/incassi reali), non la dimensione dei gruppi.
  let filterCount = null, countLabel = ''
  if (svcFilter === 'prebook_esc') { filterCount = filtered.reduce((s, g) => s + (Number(g.prebook?.escursioni) || 0), 0); countLabel = 'prenotate' }
  else if (svcFilter === 'prebook_ssp') { filterCount = filtered.reduce((s, g) => s + (Number(g.prebook?.ssp) || 0), 0); countLabel = 'prenotate' }
  else if (svcFilter && svcFilter.startsWith('has:')) {
    const sv = getServices(destId).find(s => s.id === svcFilter.replace('has:', ''))
    if (sv) { filterCount = filtered.reduce((s, g) => s + svQty(g, sv), 0); countLabel = 'presi' }
  }

  return (
    <div className="page">
      <div className="sticky-header">
      <Topbar showBack={true} showAvatar={false} />
      <div style={{ padding: '12px 16px 2px', fontSize: 13, fontWeight: 600 }}>{dest.name} · {shiftLabel(destId, parseInt(shiftNum))}</div>
      <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{shift.label} · {filtered.length} gruppi · {filterCount != null
        ? <>{filterCount} {countLabel}</>
        : <>{fPeople} persone</>} · <span className="dot-m">{fMales}M</span> <span className="dot-f">{fFemales}F</span>{svcFilter ? ' · filtro attivo' : ''}</div>
      <div className="search-bar">
        <Search size={15} color="var(--text-tertiary)" />
        <input placeholder="Cerca capogruppo o codice..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>}
      </div>
      <div style={{ padding: '2px 16px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setFilterOpen(true)} style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
          background: svcFilter ? 'var(--iv-blue-light)' : 'var(--bg-secondary)',
          border: '0.5px solid ' + (svcFilter ? 'var(--iv-blue)' : 'var(--border)'),
          color: svcFilter ? 'var(--iv-blue)' : 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5h16M7 12h10M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{ flex: 1, textAlign: 'left' }}>{svcFilter ? filterLabel(svcFilter, destId) : 'Filtra per servizio'}</span>
          {svcFilter && <span onClick={e => { e.stopPropagation(); setSvcFilter(null) }} style={{ fontSize: 17, lineHeight: 1, color: 'var(--iv-blue)' }}>×</span>}
        </button>
      </div>
      {/* Legenda colori */}
      <div style={{ borderTop: '0.5px solid var(--border)', padding: '7px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--iv-blue)' }} />Prebooking pagato</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />Incassato</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626' }} />Da incassare</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8' }} />Assente</span>
      </div>
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

      {filterOpen && (
        <FilterSheet
          destId={destId}
          current={svcFilter}
          onPick={(v) => { setSvcFilter(v); setFilterOpen(false) }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}

function filterLabel(v, destId) {
  if (!v) return 'Filtra per servizio'
  if (v === 'prebook_esc') return 'Escursioni prebooking'
  if (v === 'prebook_ssp') return 'SSP prebooking'
  const id = v.replace(/^(has:|no:)/, '')
  const sv = getServices(destId).find(s => s.id === id)
  const name = sv ? sv.label : id
  return v.startsWith('no:') ? 'Senza ' + name : name
}

function FilterSheet({ destId, current, onPick, onClose }) {
  const svcList = getServices(destId)
  const Pill = ({ value, label, tone }) => {
    const active = current === value
    const c = tone === 'green' ? '#15803D' : tone === 'red' ? '#B91C1C' : tone === 'grey' ? '#64748B' : 'var(--iv-blue)'
    const bg = tone === 'green' ? '#DCFCE7' : tone === 'red' ? '#FEE2E2' : tone === 'grey' ? '#F1F5F9' : 'var(--iv-blue-light)'
    return (
      <button onClick={() => onPick(value)} style={{
        padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
        background: active ? c : bg + '99', color: active ? '#fff' : c,
        border: '0.5px solid ' + (active ? c : bg),
      }}>{label}</button>
    )
  }
  const Group = ({ title, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn .15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-primary)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '10px 20px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.18)', animation: 'sheetUp .22s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ width: 38, height: 4, borderRadius: 4, background: 'var(--border-mid)', margin: '4px auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Filtra i gruppi</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--bg-secondary)', border: 'none', borderRadius: 10, width: 32, height: 32, fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>

        <button onClick={() => onPick(null)} style={{
          width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, marginBottom: 18, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          background: !current ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !current ? '#fff' : 'var(--text-primary)', border: 'none',
        }}>Tutti i gruppi</button>

        <Group title="Prenotazioni">
          <Pill value="prebook_esc" label="Escursioni prebooking" tone="blue" />
          <Pill value="prebook_ssp" label="SSP prebooking" tone="red" />
        </Group>
        <Group title="Chi ha preso (pagato)">
          {svcList.map(sv => <Pill key={'h' + sv.id} value={'has:' + sv.id} label={sv.label} tone="green" />)}
        </Group>
        <Group title="Chi non ha preso">
          {svcList.map(sv => <Pill key={'n' + sv.id} value={'no:' + sv.id} label={'Senza ' + sv.label} tone="grey" />)}
        </Group>
      </div>
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
          const paidMeta = (group[sv.id] || 0) > 0            // incassato in meta
          const prebooked = prebookedCount(group, sv) > 0     // prenotato in prebooking
          const prebPagato = isPrebookingPagato(sv.id, group.destination, group.shift_num)
          // Colori: blu = prebooking già pagato (escursioni sempre, SSP turni bonifico),
          //         verde = incassato in meta, rosso = prebooking da incassare (SSP cash), grigio = assente.
          let st
          if (prebooked && prebPagato) st = { background: 'var(--iv-blue-light)', color: 'var(--iv-blue)', borderColor: 'var(--iv-blue-mid)' }
          else if (paidMeta)           st = { background: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' }
          else if (prebooked)          st = { background: '#FEE2E2', color: '#B91C1C', borderColor: '#FECACA' }
          else                         st = undefined   // assente -> chip grigio di base
          return (
            <span key={sv.id} className="flag-chip" style={st}>
              <span className="dot" />{sv.label}
            </span>
          )
        })}
      </div>
      {group.alloggio && <div className="alloggio-tag">🏠 {group.alloggio}</div>}
    </button>
  )
}
