import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { parseTurnoExcel, DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('import')
  const [importing, setImporting] = useState(false)
  const [importLog, setImportLog] = useState([])
  const [staffList, setStaffList] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (tab === 'staff') fetchStaff()
    if (tab === 'stats') fetchStats()
  }, [tab])

  async function fetchStaff() {
    const { data } = await supabase.from('staff_profiles').select('*').order('cognome')
    setStaffList(data || [])
  }

  async function fetchStats() {
    const { data: groups } = await supabase.from('groups').select('destination, shift_num, escursioni, navetta, assicurazione, iscrizione')
    const { data: participants } = await supabase.from('participants').select('id')
    setStats({ groups: groups || [], totalParts: participants?.length || 0 })
  }

  function log(msg) { setImportLog(prev => [...prev, msg]) }

  function formatCapogruppo(code) {
    const match = code.match(/^\d+(.+)$/)
    if (match) {
      const s = match[1].trim()
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    }
    return code
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportLog([])
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const header = rows[0] || []
      const dataRows = rows.slice(1).filter(r => r.some(c => c))
      const hasFlags = header.length >= 21 && String(header[17]).toLowerCase().includes('escursioni')
      log('Trovati ' + dataRows.length + ' righe — formato ' + (hasFlags ? 'con flag' : 'base'))
      const groupsMap = {}
      for (const row of dataRows) {
        const cognome = row[0] || ''
        const nome = row[1] || ''
        const sesso = row[2] || ''
        const nascita = row[3] ? String(row[3]) : null
        const pratica = row[10] || ''
        const stato = row[11] || ''
        const turnoRaw = row[13] || ''
        const capogruppoCod = row[16] || ''
        const escFlag = hasFlags ? String(row[17] || '0').trim() === '1' : null
        const navFlag = hasFlags ? String(row[18] || '0').trim() === '1' : null
        const assFlag = hasFlags ? String(row[19] || '0').trim() === '1' : null
        const iscFlag = hasFlags ? String(row[20] || '0').trim() === '1' : null
        const parsed = parseTurnoExcel(turnoRaw)
        if (!parsed) continue
        const { destination, shift_num } = parsed
        const cgKey = capogruppoCod + '__' + destination + '__' + shift_num
        if (!groupsMap[cgKey]) {
          groupsMap[cgKey] = {
            capogruppo_code: capogruppoCod,
            capogruppo_display: formatCapogruppo(capogruppoCod),
            destination, shift_num, pratica,
            escursioni: escFlag, navetta: navFlag, assicurazione: assFlag, iscrizione: iscFlag,
            participants: []
          }
        }
        if (hasFlags) {
          if (escFlag !== null) groupsMap[cgKey].escursioni = escFlag
          if (navFlag !== null) groupsMap[cgKey].navetta = navFlag
          if (assFlag !== null) groupsMap[cgKey].assicurazione = assFlag
          if (iscFlag !== null) groupsMap[cgKey].iscrizione = iscFlag
        }
        groupsMap[cgKey].participants.push({
          cognome: String(cognome).toUpperCase(),
          nome: String(nome).charAt(0).toUpperCase() + String(nome).slice(1).toLowerCase(),
          sesso: String(sesso).toUpperCase(),
          nascita: nascita || null,
          pratica, stato: String(stato)
        })
      }
      const groups = Object.values(groupsMap)
      log('Trovati ' + groups.length + ' gruppi da ' + dataRows.length + ' righe')
      let imported = 0, errors = 0
      for (const g of groups) {
        const { data: existing } = await supabase.from('groups').select('id').eq('capogruppo_code', g.capogruppo_code).eq('destination', g.destination).eq('shift_num', g.shift_num).maybeSingle()
        let groupId
        if (existing) {
          groupId = existing.id
          const updateData = { capogruppo_display: g.capogruppo_display, pratica: g.pratica }
          if (g.escursioni !== null) updateData.escursioni = g.escursioni
          if (g.navetta !== null) updateData.navetta = g.navetta
          if (g.assicurazione !== null) updateData.assicurazione = g.assicurazione
          if (g.iscrizione !== null) updateData.iscrizione = g.iscrizione
          await supabase.from('groups').update(updateData).eq('id', groupId)
        } else {
          const { data: newG, error } = await supabase.from('groups').insert({
            capogruppo_code: g.capogruppo_code, capogruppo_display: g.capogruppo_display,
            destination: g.destination, shift_num: g.shift_num, pratica: g.pratica,
            escursioni: g.escursioni ?? false, navetta: g.navetta ?? false,
            assicurazione: g.assicurazione ?? false, iscrizione: g.iscrizione ?? false
          }).select().single()
          if (error) { errors++; continue }
          groupId = newG.id
        }
        await supabase.from('participants').delete().eq('group_id', groupId)
        await supabase.from('participants').insert(g.participants.map(p => ({ ...p, group_id: groupId })))
        imported++
      }
      log('✅ Importati: ' + imported + ' gruppi')
      if (errors) log('❌ Errori: ' + errors)
    } catch (err) {
      log('❌ Errore: ' + err.message)
    }
    setImporting(false)
    e.target.value = ''
  }

  async function toggleAssignment(staffId, destination, shiftNum) {
    const staff = staffList.find(s => s.id === staffId)
    const current = staff.assigned_shifts || []
    const exists = current.some(s => s.destination === destination && s.shift_num === shiftNum)
    const updated = exists
      ? current.filter(s => !(s.destination === destination && s.shift_num === shiftNum))
      : [...current, { destination, shift_num: shiftNum }]
    await supabase.from('staff_profiles').update({ assigned_shifts: updated }).eq('id', staffId)
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, assigned_shifts: updated } : s))
  }

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div className="tabs">
        <button className={'tab ' + (tab === 'import' ? 'active' : '')} onClick={() => setTab('import')}>Import Excel</button>
        <button className={'tab ' + (tab === 'staff' ? 'active' : '')} onClick={() => setTab('staff')}>Staff</button>
        <button className={'tab ' + (tab === 'stats' ? 'active' : '')} onClick={() => setTab('stats')}>Statistiche</button>
      </div>

      {tab === 'import' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <Upload size={32} color="var(--iv-blue)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Carica file Excel partecipanti</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>Formato: FILE_CM_2026.xlsx</div>
            <label style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {importing ? 'Importazione...' : 'Seleziona file'}
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} disabled={importing} />
            </label>
          </div>
          {importLog.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Log importazione</div>
              {importLog.map((line, i) => (
                <div key={i} style={{ fontSize: 13, padding: '3px 0', borderBottom: i < importLog.length - 1 ? '0.5px solid var(--border)' : 'none' }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'staff' && (
        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staffList.map(staff => (
            <StaffCard key={staff.id} staff={staff} onToggle={toggleAssignment} />
          ))}
          {staffList.length === 0 && <div className="empty-state"><p>Nessuno staff registrato.</p></div>}
        </div>
      )}

      {tab === 'stats' && stats && <StatsTab stats={stats} />}
    </div>
  )
}

function StaffCard({ staff, onToggle }) {
  const [open, setOpen] = useState(false)
  const assigned = staff.assigned_shifts || []
  const initials = ((staff.nome?.[0] || '') + (staff.cognome?.[0] || '')).toUpperCase()
  return (
    <div className="card">
      <button style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setOpen(o => !o)}>
        <div className="initials" style={{ width: 36, height: 36, fontSize: 12 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{staff.nome} {staff.cognome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{staff.role === 'admin' ? 'Admin' : assigned.length + ' turni assegnati'}</div>
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>{open ? '▲' : '▼'}</div>
      </button>
      {open && staff.role !== 'admin' && (
        <div style={{ marginTop: 12, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DESTINATIONS.map(dest => (
            <div key={dest.id}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{dest.flag} {dest.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SHIFTS[dest.id].map(s => {
                  const isOn = assigned.some(a => a.destination === dest.id && a.shift_num === s.num)
                  return (
                    <button key={s.num} onClick={() => onToggle(staff.id, dest.id, s.num)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isOn ? 'var(--iv-blue)' : 'var(--bg-tertiary)', color: isOn ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (isOn ? 'var(--iv-blue)' : 'var(--border)'), cursor: 'pointer' }}>
                      {shiftLabel(dest.id, s.num)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SERVICES_META = [
  { key: 'escursioni',   label: 'Escursioni',   color: '#1E6BF1', emoji: '🏄' },
  { key: 'navetta',      label: 'Navetta',       color: '#059669', emoji: '🚌' },
  { key: 'assicurazione',label: 'Assicurazione', color: '#D97706', emoji: '🛡️' },
  { key: 'iscrizione',   label: 'Iscrizione',    color: '#7C3AED', emoji: '📋' },
]

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

      {/* Sezione voti */}
      <VotesSection voteData={voteData} staffProfiles={staffProfiles} loading={loadingVotes} filterDest={filterDest} filterShift={filterShift} />

    </div>
  )
}

function VotesSection({ voteData, staffProfiles, loading, filterDest, filterShift }) {
  function getProfile(id) { return staffProfiles.find(p => p.id === id) }

  // Filtra per dest/shift se attivi
  const filtered = voteData.filter(v => {
    if (filterDest && v.destination !== filterDest) return false
    if (filterShift && v.shift_num !== filterShift) return false
    return true
  })

  // Aggrega per staff (somma tutti i turni se no filtro)
  const byStaff = {}
  filtered.forEach(v => {
    if (!byStaff[v.staffId]) byStaff[v.staffId] = { staffId: v.staffId, daily: 0, weekly: 0 }
    byStaff[v.staffId].daily += v.daily
    byStaff[v.staffId].weekly += v.weekly
  })
  const dailyRanking = Object.values(byStaff).filter(v => v.daily > 0).sort((a, b) => b.daily - a.daily).slice(0, 10)
  const weeklyRanking = Object.values(byStaff).filter(v => v.weekly > 0).sort((a, b) => b.weekly - a.weekly).slice(0, 10)

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>Carico voti...</div>
  )

  if (dailyRanking.length === 0 && weeklyRanking.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🏆</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora registrato</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Migliori del giorno */}
      {dailyRanking.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            ⭐ Migliori del giorno — classifica
          </div>
          {dailyRanking.map((v, i) => {
            const p = getProfile(v.staffId)
            if (!p) return null
            return (
              <div key={v.staffId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < dailyRanking.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? '#D4AC0D' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--text-tertiary)', flexShrink: 0 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                  {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                  {v.daily} ⭐
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Migliori della settimana */}
      {weeklyRanking.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            🏆 Migliori della settimana — classifica
          </div>
          {weeklyRanking.map((v, i) => {
            const p = getProfile(v.staffId)
            if (!p) return null
            return (
              <div key={v.staffId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < weeklyRanking.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? '#D4AC0D' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--text-tertiary)', flexShrink: 0 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                  {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                  {v.weekly} 🏆
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {emoji} {label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 700, color }}>{count}</span> / {total}
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-tertiary, #f0f0f0)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function StatsTab({ stats }) {
  const [filterDest, setFilterDest] = useState(null)
  const [filterShift, setFilterShift] = useState(null)
  const [voteData, setVoteData] = useState([]) // { staffId, nome, cognome, ruolo, dailyCount, weeklyCount, destination, shift_num }
  const [staffProfiles, setStaffProfiles] = useState([])
  const [loadingVotes, setLoadingVotes] = useState(true)

  useEffect(() => {
    async function loadVotes() {
      const [{ data: votes }, { data: profiles }] = await Promise.all([
        supabase.from('votes').select('voted_for_id, type, destination, shift_num'),
        supabase.from('staff_profiles').select('id, nome, cognome, ruolo'),
      ])
      setStaffProfiles(profiles || [])
      if (votes) {
        // Aggrega per staff + dest + shift + type
        const map = {}
        votes.forEach(v => {
          const key = `${v.voted_for_id}__${v.destination}__${v.shift_num}`
          if (!map[key]) map[key] = { staffId: v.voted_for_id, destination: v.destination, shift_num: v.shift_num, daily: 0, weekly: 0 }
          if (v.type === 'daily') map[key].daily++
          else map[key].weekly++
        })
        setVoteData(Object.values(map))
      }
      setLoadingVotes(false)
    }
    loadVotes()
  }, [])

  const groups = stats.groups

  // Turni disponibili per la destinazione selezionata
  const availableShifts = filterDest
    ? [...new Set(groups.filter(g => g.destination === filterDest).map(g => g.shift_num))].sort((a, b) => a - b)
    : []

  // Gruppi filtrati
  const filtered = groups.filter(g => {
    if (filterDest && g.destination !== filterDest) return false
    if (filterShift && g.shift_num !== filterShift) return false
    return true
  })

  const total = filtered.length

  // Totali globali
  const totalGroups = groups.length
  const totalParts = stats.totalParts

  // Servizi sul filtered
  const svcTotals = {}
  SERVICES_META.forEach(s => {
    svcTotals[s.key] = filtered.filter(g => g[s.key]).length
  })

  // Per destinazione (solo se non filtrata)
  const destRows = DESTINATIONS.map(dest => {
    const dg = groups.filter(g => g.destination === dest.id)
    if (!dg.length) return null
    return {
      dest,
      groups: dg.length,
      services: SERVICES_META.map(s => ({ ...s, count: dg.filter(g => g[s.key]).length }))
    }
  }).filter(Boolean)

  // Per turno (quando filtro dest attivo)
  const shiftRows = filterDest
    ? availableShifts.map(sNum => {
        const sg = groups.filter(g => g.destination === filterDest && g.shift_num === sNum)
        return {
          sNum,
          groups: sg.length,
          services: SERVICES_META.map(s => ({ ...s, count: sg.filter(g => g[s.key]).length }))
        }
      })
    : []

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPI globali */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--iv-blue)' }}>{totalGroups}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gruppi totali</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--iv-blue)' }}>{totalParts}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Partecipanti</div>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DESTINATIONS.map(dest => {
          const active = filterDest === dest.id
          const col = DEST_COLORS[dest.id]
          return (
            <button key={dest.id} onClick={() => { setFilterDest(active ? null : dest.id); setFilterShift(null) }} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: active ? col : 'var(--bg-secondary)',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (active ? col : 'var(--border)')
            }}>
              {dest.flag} {dest.name}
            </button>
          )
        })}
        {filterDest && (
          <button onClick={() => { setFilterDest(null); setFilterShift(null) }} style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-light)', color: 'var(--danger)', border: '0.5px solid #FECACA' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Filtro turni (quando dest selezionata) */}
      {filterDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterShift(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterShift ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: !filterShift ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterShift ? DEST_COLORS[filterDest] : 'var(--border)') }}>
            Tutti
          </button>
          {availableShifts.map(sNum => (
            <button key={sNum} onClick={() => setFilterShift(filterShift === sNum ? null : sNum)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: filterShift === sNum ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--border)') }}>
              {shiftLabel(filterDest, sNum)}
            </button>
          ))}
        </div>
      )}

      {/* Servizi venduti — sezione filtrata */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          Servizi venduti
          {filterDest && <span style={{ color: DEST_COLORS[filterDest], marginLeft: 6 }}>
            — {DESTINATIONS.find(d => d.id === filterDest)?.name}{filterShift ? ' ' + shiftLabel(filterDest, filterShift) : ''}
          </span>}
          <span style={{ float: 'right', fontWeight: 500, color: 'var(--text-tertiary)', fontSize: 10 }}>{total} gruppi</span>
        </div>
        {SERVICES_META.map(s => (
          <ServiceBar key={s.key} label={s.label} emoji={s.emoji} count={svcTotals[s.key]} total={total} color={s.color} />
        ))}
      </div>

      {/* Breakdown per destinazione (se no filtro) */}
      {!filterDest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {destRows.map(({ dest, groups: dg, services }) => (
            <div key={dest.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{dest.flag} {dest.name}</div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dg} gruppi</span>
              </div>
              {services.map(s => (
                <ServiceBar key={s.key} label={s.label} emoji={s.emoji} count={s.count} total={dg} color={s.color} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Breakdown per turno (se filtro dest attivo, no turno) */}
      {filterDest && !filterShift && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shiftRows.map(({ sNum, groups: sg, services }) => (
            <div key={sNum} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: DEST_COLORS[filterDest] }}>{shiftLabel(filterDest, sNum)}</div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sg} gruppi</span>
              </div>
              {services.map(s => (
                <ServiceBar key={s.key} label={s.label} emoji={s.emoji} count={s.count} total={sg} color={s.color} />
              ))}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
