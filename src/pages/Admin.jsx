import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Plus, X, ArrowDownCircle, ArrowUpCircle, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { parseTurnoExcel, DESTINATIONS, SHIFTS, shiftLabel, SERVICES, SERVICES_CORFU } from '../lib/constants'
import { CATEGORIE } from './Cassa'
import Topbar from '../components/Topbar'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('import')
  const [importing, setImporting] = useState(false)
  const [importLog, setImportLog] = useState([])
  const [staffList, setStaffList] = useState([])
  const [stats, setStats] = useState(null)
  const [incassiData, setIncassiData] = useState(null)

  useEffect(() => {
    if (tab === 'staff') fetchStaff()
    if (tab === 'stats') fetchStats()
    if (tab === 'incassi') fetchIncassi()
  }, [tab])

  async function fetchStaff() {
    const { data } = await supabase.from('staff_profiles').select('*').order('cognome')
    setStaffList(data || [])
  }

  async function fetchStats() {
    const { data: groups } = await supabase.from('groups').select('destination, shift_num, pkg_escursioni, tassa_soggiorno, pkg_ssp, cauzione')
    const { data: participants } = await supabase.from('participants').select('id')
    setStats({ groups: groups || [], totalParts: participants?.length || 0 })
  }

  async function fetchIncassi() {
    try {
      // Carica tutti i gruppi con paginazione
      let groups = []
      let gFrom = 0
      const pageSize = 1000
      while (true) {
        const { data: page, error } = await supabase
          .from('groups')
          .select('id, capogruppo_display, destination, shift_num, pkg_escursioni, tassa_soggiorno, pkg_ssp, cauzione, qta_escursioni, qta_tassa_soggiorno, qta_ssp, qta_cauzione, qta_pazuzu, qta_barche_paleo, qta_montecristo, qta_mojito2, qta_pranzo_laviron')
          .order('destination').order('shift_num').order('capogruppo_display')
          .range(gFrom, gFrom + pageSize - 1)
        if (error) { console.error(error); setIncassiData([]); return }
        if (!page || page.length === 0) break
        groups = groups.concat(page)
        if (page.length < pageSize) break
        gFrom += pageSize
      }

      // Conta partecipanti con paginazione
      const countMap = {}
      let from = 0
      while (true) {
        const { data: page } = await supabase
          .from('participants')
          .select('group_id, attivo')
          .range(from, from + pageSize - 1)
        if (!page || page.length === 0) break
        page.forEach(p => { if (p.attivo !== false) countMap[p.group_id] = (countMap[p.group_id] || 0) + 1 })
        if (page.length < pageSize) break
        from += pageSize
      }
      setIncassiData(groups.map(g => ({ ...g, num_partecipanti: countMap[g.id] || 0 })))
    } catch (e) {
      console.error(e)
      setIncassiData([])
    }
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
        const nazionalita = row[4] || ''
        const tipoDocumento = row[5] || ''
        const numeroDocumento = row[6] || ''
        const dataEmissione = row[7] ? String(row[7]) : null
        const dataScadenza = row[8] ? String(row[8]) : null
        const cittaPartenza = row[9] || ''
        const pratica = row[10] || ''
        const stato = row[11] || ''
        const turnoRaw = row[13] || ''
        const dataRaw = row[14] ? String(row[14]) : ''
        const destinazioneRaw = row[15] || ''
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
          pratica, stato: String(stato),
          nazionalita: String(nazionalita),
          tipo_documento: String(tipoDocumento),
          numero_documento: String(numeroDocumento),
          data_emissione: dataEmissione || null,
          data_scadenza: dataScadenza || null,
          citta_partenza: String(cittaPartenza),
          turno_raw: String(turnoRaw),
          data_raw: dataRaw,
          destinazione_raw: String(destinazioneRaw),
          escursioni: escFlag ?? false,
          navetta: navFlag ?? false,
          assicurazione: assFlag ?? false,
          iscrizione: iscFlag ?? false,
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
        <button className={'tab ' + (tab === 'premi' ? 'active' : '')} onClick={() => setTab('premi')}>🏆 Premi</button>
        <button className={'tab ' + (tab === 'incassi' ? 'active' : '')} onClick={() => setTab('incassi')}>💰 Incassi</button>
        <button className={'tab ' + (tab === 'cassa' ? 'active' : '')} onClick={() => setTab('cassa')}>👛 Cassa</button>
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
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(30,107,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="var(--iv-blue)" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Log importazione</div>
              </div>
              {importLog.map((line, i) => {
                const isSuccess = line.trim().startsWith('✅')
                const isError = line.trim().startsWith('❌')
                const clean = line.replace(/^[✅❌]\s*/, '')
                const isLast = i === importLog.length - 1
                const dotColor = isSuccess ? '#16A34A' : isError ? '#DC2626' : 'var(--iv-blue)'
                const dotBg = isSuccess ? 'rgba(22,163,74,0.12)' : isError ? 'rgba(220,38,38,0.12)' : 'rgba(30,107,241,0.08)'
                const textColor = isSuccess ? '#16A34A' : isError ? '#DC2626' : 'var(--text-secondary)'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
                    {!isLast && <div style={{ position: 'absolute', left: 11, top: 24, bottom: -2, width: 2, background: 'var(--border)' }} />}
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: dotBg, color: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, zIndex: 1 }}>
                      {isSuccess ? '✓' : isError ? '✕' : i + 1}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: (isSuccess || isError) ? 700 : 500, color: textColor, paddingTop: 2 }}>{clean}</div>
                  </div>
                )
              })}
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
      {tab === 'premi' && <PremiTab />}
      {tab === 'incassi' && <IncassiTab data={incassiData} loading={!incassiData} />}
      {tab === 'cassa' && <CassaTab />}
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
  { key: 'pkg_escursioni', label: 'Escursioni',           color: '#1E6BF1', emoji: '🏄' },
  { key: 'tassa_soggiorno', label: 'Tassa di soggiorno',  color: '#059669', emoji: '🏨' },
  { key: 'pkg_ssp',        label: 'SSP',                  color: '#D97706', emoji: '📋' },
  { key: 'cauzione',       label: 'Cauzione',             color: '#7C3AED', emoji: '🔒' },
]

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

function ServiceBar({ label, count, total, color, emoji }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>{emoji} {label}</span>
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

function PremiTab() {
  const [votes, setVotes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDest, setSelectedDest] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from('votes').select('voted_for_id, type, destination, shift_num'),
        supabase.from('staff_profiles').select('id, nome, cognome, ruolo'),
      ])
      setVotes(v || [])
      setProfiles(p || [])
      setLoading(false)
    }
    load()
  }, [])

  function getProfile(id) { return profiles.find(p => p.id === id) }

  function getRanking(destId, sNum, type) {
    const filtered = votes.filter(v => v.destination === destId && v.shift_num === sNum && v.type === type)
    const counts = {}
    filtered.forEach(v => { counts[v.voted_for_id] = (counts[v.voted_for_id] || 0) + 1 })
    return Object.entries(counts).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }

  const availableShifts = selectedDest
    ? [...new Set(votes.filter(v => v.destination === selectedDest).map(v => v.shift_num))].sort((a, b) => a - b)
    : []

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Carico...</div>

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Selettore destinazione */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DESTINATIONS.map(dest => {
          const hasVotes = votes.some(v => v.destination === dest.id)
          if (!hasVotes) return null
          const col = DEST_COLORS[dest.id]
          const active = selectedDest === dest.id
          return (
            <button key={dest.id} onClick={() => { setSelectedDest(active ? null : dest.id); setSelectedShift(null) }} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (active ? col : 'var(--border)'),
            }}>
              {dest.name}
            </button>
          )
        })}
        {!votes.length && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora registrato</div>}
      </div>

      {/* Selettore turno */}
      {selectedDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {availableShifts.map(sNum => {
            const active = selectedShift === sNum
            const col = DEST_COLORS[selectedDest]
            return (
              <button key={sNum} onClick={() => setSelectedShift(active ? null : sNum)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (active ? col : 'var(--border)'),
              }}>
                {shiftLabel(selectedDest, sNum)}
              </button>
            )
          })}
        </div>
      )}

      {/* Classifiche */}
      {selectedDest && selectedShift && (() => {
        const dailyRank = getRanking(selectedDest, selectedShift, 'daily')
        const weeklyRank = getRanking(selectedDest, selectedShift, 'weekly')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Daily */}
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                ⭐ Migliori del giorno — {shiftLabel(selectedDest, selectedShift)}
              </div>
              {dailyRank.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora</div>
                : dailyRank.map((v, i) => {
                    const p = getProfile(v.id)
                    if (!p) return null
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < dailyRank.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <div style={{ width: 28, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                          {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                          {v.count} ⭐
                        </div>
                      </div>
                    )
                  })
              }
            </div>
            {/* Weekly */}
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                🏆 Migliore della settimana — {shiftLabel(selectedDest, selectedShift)}
              </div>
              {weeklyRank.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora</div>
                : weeklyRank.map((v, i) => {
                    const p = getProfile(v.id)
                    if (!p) return null
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < weeklyRank.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <div style={{ width: 28, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                          {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                          {v.count} 🏆
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      })()}

      {selectedDest && !selectedShift && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Seleziona un turno per vedere la classifica
        </div>
      )}
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

function IncassiTab({ data, loading }) {
  const [filterDest, setFilterDest] = useState(null)
  const [filterShift, setFilterShift] = useState(null)
  const [viewMode, setViewMode] = useState('euro') // 'euro' | 'quantita'

  if (loading || !data) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Carico incassi...</div>

  const isCorfuView = filterDest === 'corfu'
  const SV = isCorfuView ? SERVICES_CORFU : SERVICES // [{id, label, prezzo}]
  const isQty = viewMode === 'quantita'

  // Quantità di un servizio per un gruppo: per Corfù è il numero diretto, per le altre mete è 0/pax (booleano)
  function svQty(g, sv) {
    if (isCorfuView) return g[sv.id] || 0
    return g[sv.id] ? (g.num_partecipanti || 0) : 0
  }
  // Valore in € (quantità × prezzo)
  function svValue(g, sv) {
    return sv.prezzo * svQty(g, sv)
  }
  // Cella mostrata: € o numero secondo la vista scelta
  function svCell(g, sv) {
    return isQty ? svQty(g, sv) : svValue(g, sv)
  }

  // Filtra gruppi
  const groups = data.filter(g => {
    if (filterDest && g.destination !== filterDest) return false
    if (filterShift && g.shift_num !== filterShift) return false
    return true
  })

  // Struttura: per meta → per turno → gruppi
  const dests = [...new Set(groups.map(g => g.destination))]
  const availableShifts = filterDest
    ? [...new Set(data.filter(g => g.destination === filterDest).map(g => g.shift_num))].sort((a, b) => a - b)
    : []

  // Calcola totale riga
  function rowTotal(g) {
    return SV.reduce((t, sv) => t + svCell(g, sv), 0)
  }

  // Calcola totale colonna per un set di gruppi
  function colTotal(gs, sv) {
    return gs.reduce((t, g) => t + svCell(g, sv), 0)
  }

  function grandTotal(gs) {
    return gs.reduce((t, g) => t + rowTotal(g), 0)
  }

  const thStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)', background: 'var(--bg-secondary)' }
  const thLeftStyle = { ...thStyle, textAlign: 'left' }
  const tdStyle = { fontSize: 12, padding: '9px 10px', textAlign: 'right', borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' }
  const tdLeftStyle = { ...tdStyle, textAlign: 'left', color: 'var(--text-primary)', fontWeight: 500 }
  const subtotalStyle = { background: 'var(--bg-secondary)', fontWeight: 700, fontSize: 12 }
  const grandStyle = { background: 'var(--iv-blue)', color: '#fff', fontWeight: 800 }

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vista:</span>
        <button onClick={() => setViewMode('euro')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !isQty ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !isQty ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!isQty ? 'var(--iv-blue)' : 'var(--border)') }}>
          € Importi
        </button>
        <button onClick={() => setViewMode('quantita')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: isQty ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: isQty ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (isQty ? 'var(--iv-blue)' : 'var(--border)') }}>
          # Quantità
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Meta:</span>
        <button onClick={() => { setFilterDest(null); setFilterShift(null) }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterDest ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !filterDest ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterDest ? 'var(--iv-blue)' : 'var(--border)') }}>
          Tutte
        </button>
        {DESTINATIONS.map(d => {
          const hasData = data.some(g => g.destination === d.id)
          if (!hasData) return null
          const col = DEST_COLORS[d.id]
          const active = filterDest === d.id
          return (
            <button key={d.id} onClick={() => { setFilterDest(active ? null : d.id); setFilterShift(null) }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? col : 'var(--border)') }}>
              {d.name}
            </button>
          )
        })}
      </div>

      {filterDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Turno:</span>
          <button onClick={() => setFilterShift(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterShift ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: !filterShift ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterShift ? DEST_COLORS[filterDest] : 'var(--border)') }}>Tutti</button>
          {availableShifts.map(sNum => (
            <button key={sNum} onClick={() => setFilterShift(filterShift === sNum ? null : sNum)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: filterShift === sNum ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--border)') }}>
              {shiftLabel(filterDest, sNum)}
            </button>
          ))}
        </div>
      )}

      {/* Tabella pivot */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '0.5px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thLeftStyle, minWidth: 140 }}>Capogruppo</th>
              <th style={{ ...thStyle, minWidth: 60 }}>Pax</th>
              {SV.map(sv => <th key={sv.id} style={{ ...thStyle, minWidth: 90 }}>{sv.label}</th>)}
              <th style={{ ...thStyle, minWidth: 80, color: 'var(--iv-blue)' }}>{isQty ? 'Tot. servizi' : 'Totale'}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={3 + SV.length} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Nessun dato</td></tr>
            ) : (() => {
              const rows = []
              // Raggruppa per dest → shift
              const byDest = {}
              groups.forEach(g => {
                if (!byDest[g.destination]) byDest[g.destination] = {}
                if (!byDest[g.destination][g.shift_num]) byDest[g.destination][g.shift_num] = []
                byDest[g.destination][g.shift_num].push(g)
              })

              Object.entries(byDest).forEach(([destId, shifts]) => {
                const dest = DESTINATIONS.find(d => d.id === destId)
                const destColor = DEST_COLORS[destId]
                const allDestGroups = Object.values(shifts).flat()

                Object.entries(shifts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([sNum, sGroups]) => {
                  // Header turno
                  rows.push(
                    <tr key={`h-${destId}-${sNum}`}>
                      <td colSpan={3 + SV.length} style={{ padding: '8px 12px', background: destColor + '15', borderBottom: '0.5px solid var(--border)', borderTop: '1px solid ' + destColor + '33' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: destColor }}>{dest?.name} · {shiftLabel(destId, Number(sNum))}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{sGroups.length} gruppi</span>
                      </td>
                    </tr>
                  )
                  // Righe gruppo
                  sGroups.forEach(g => {
                    const n = g.num_partecipanti || 0
                    const tot = rowTotal(g)
                    rows.push(
                      <tr key={g.id}>
                        <td style={tdLeftStyle}>{g.capogruppo_display}</td>
                        <td style={tdStyle}>{n}</td>
                        {SV.map(sv => {
                          const val = svCell(g, sv)
                          return <td key={sv.id} style={{ ...tdStyle, color: val > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{val > 0 ? (isQty ? val : `€${val}`) : '—'}</td>
                        })}
                        <td style={{ ...tdStyle, fontWeight: 700, color: tot > 0 ? 'var(--iv-blue)' : 'var(--text-tertiary)' }}>{tot > 0 ? (isQty ? tot : `€${tot}`) : '—'}</td>
                      </tr>
                    )
                  })
                  // Subtotale turno
                  rows.push(
                    <tr key={`sub-${destId}-${sNum}`} style={subtotalStyle}>
                      <td style={{ ...tdLeftStyle, ...subtotalStyle }}>Subtotale {shiftLabel(destId, Number(sNum))}</td>
                      <td style={{ ...tdStyle, ...subtotalStyle }}>{sGroups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                      {SV.map(sv => <td key={sv.id} style={{ ...tdStyle, ...subtotalStyle }}>{isQty ? colTotal(sGroups, sv) : `€${colTotal(sGroups, sv)}`}</td>)}
                      <td style={{ ...tdStyle, ...subtotalStyle, color: 'var(--iv-blue)' }}>{isQty ? grandTotal(sGroups) : `€${grandTotal(sGroups)}`}</td>
                    </tr>
                  )
                })

                // Subtotale meta (solo se >1 turno)
                if (Object.keys(shifts).length > 1) {
                  rows.push(
                    <tr key={`dest-${destId}`} style={{ background: destColor + '20' }}>
                      <td style={{ ...tdLeftStyle, background: 'transparent', color: destColor, fontWeight: 800 }}>TOTALE {dest?.name?.toUpperCase()}</td>
                      <td style={{ ...tdStyle, background: 'transparent', fontWeight: 700 }}>{allDestGroups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                      {SV.map(sv => <td key={sv.id} style={{ ...tdStyle, background: 'transparent', fontWeight: 700 }}>{isQty ? colTotal(allDestGroups, sv) : `€${colTotal(allDestGroups, sv)}`}</td>)}
                      <td style={{ ...tdStyle, background: 'transparent', fontWeight: 800, color: destColor }}>{isQty ? grandTotal(allDestGroups) : `€${grandTotal(allDestGroups)}`}</td>
                    </tr>
                  )
                }
              })

              // Totale generale
              rows.push(
                <tr key="grand" style={grandStyle}>
                  <td style={{ ...tdLeftStyle, ...grandStyle, color: '#fff', fontSize: 13 }}>TOTALE GENERALE</td>
                  <td style={{ ...tdStyle, ...grandStyle, color: '#fff' }}>{groups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                  {SV.map(sv => <td key={sv.id} style={{ ...tdStyle, ...grandStyle, color: '#fff' }}>{isQty ? colTotal(groups, sv) : `€${colTotal(groups, sv)}`}</td>)}
                  <td style={{ ...tdStyle, ...grandStyle, color: '#fff', fontSize: 15 }}>{isQty ? grandTotal(groups) : `€${grandTotal(groups)}`}</td>
                </tr>
              )

              return rows
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatsTab({ stats }) {
  const [filterDest, setFilterDest] = useState(null)
  const [filterShift, setFilterShift] = useState(null)

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

function CassaTab() {
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null) // { destination, shift_num }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    let all = [], from = 0
    const pageSize = 1000
    while (true) {
      const { data } = await supabase.from('cassa_movimenti').select('*').range(from, from + pageSize - 1)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    setMovimenti(all)
    setLoading(false)
  }

  if (selectedRow) {
    return <CassaTurnoDetail destination={selectedRow.destination} shiftNum={selectedRow.shift_num} onBack={() => { setSelectedRow(null); fetchAll() }} />
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Carico cassa...</div>

  const filtered = filterDest ? movimenti.filter(m => m.destination === filterDest) : movimenti

  // Raggruppa per destinazione + turno
  const groupKey = (dest, shift) => `${dest}__${shift}`
  const byShift = {}
  filtered.forEach(m => {
    const k = groupKey(m.destination, m.shift_num)
    if (!byShift[k]) byShift[k] = { destination: m.destination, shift_num: m.shift_num, entrate: 0, uscite: 0, count: 0 }
    if (m.tipo === 'entrata') byShift[k].entrate += Number(m.importo)
    else byShift[k].uscite += Number(m.importo)
    byShift[k].count++
  })

  // Aggiunge tutti i turni esistenti (anche a zero movimenti) per la/le meta selezionate
  const destsToShow = filterDest ? [filterDest] : DESTINATIONS.map(d => d.id)
  destsToShow.forEach(destId => {
    (SHIFTS[destId] || []).forEach(s => {
      const k = groupKey(destId, s.num)
      if (!byShift[k]) byShift[k] = { destination: destId, shift_num: s.num, entrate: 0, uscite: 0, count: 0 }
    })
  })

  const shiftRows = Object.values(byShift).sort((a, b) => a.destination.localeCompare(b.destination) || a.shift_num - b.shift_num)

  const totEntrate = filtered.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totUscite = filtered.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Meta:</span>
        <button onClick={() => setFilterDest(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterDest ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !filterDest ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterDest ? 'var(--iv-blue)' : 'var(--border)') }}>Tutte</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => setFilterDest(d.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filterDest === d.id ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: filterDest === d.id ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (filterDest === d.id ? 'var(--iv-blue)' : 'var(--border)') }}>{d.name}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#ECFDF5', border: '1px solid #16A34A33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Entrate totali</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>€{totEntrate.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Uscite totali</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>€{totUscite.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--iv-blue-light)', border: '1px solid var(--iv-blue)33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--iv-blue)', textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--iv-blue)', marginTop: 4 }}>€{(totEntrate - totUscite).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', padding: '10px 16px', background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          <div>Turno</div><div>Movimenti</div><div>Entrate</div><div>Uscite</div><div>Saldo</div>
        </div>
        {shiftRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento registrato</div>
        ) : shiftRows.map((r, i) => {
          const dest = DESTINATIONS.find(d => d.id === r.destination)
          const saldoTurno = r.entrate - r.uscite
          return (
            <div key={i} onClick={() => setSelectedRow({ destination: r.destination, shift_num: r.shift_num })}
              style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', padding: '11px 16px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600, color: 'var(--iv-blue)' }}>{dest?.name || r.destination} · {shiftLabel(r.destination, r.shift_num)}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{r.count}</div>
              <div style={{ color: '#16A34A' }}>€{r.entrate.toFixed(2)}</div>
              <div style={{ color: '#DC2626' }}>€{r.uscite.toFixed(2)}</div>
              <div style={{ fontWeight: 700 }}>€{saldoTurno.toFixed(2)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CassaTurnoDetail({ destination, shiftNum, onBack }) {
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })

  const dest = DESTINATIONS.find(d => d.id === destination)

  useEffect(() => { load() }, [destination, shiftNum])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cassa_movimenti')
      .select('*').eq('destination', destination).eq('shift_num', shiftNum)
      .order('data', { ascending: false }).order('created_at', { ascending: false })
    setMovimenti(data || [])
    setLoading(false)
  }

  function openForm() {
    setForm({ categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })
    setShowForm(true)
  }

  async function handleSave() {
    const signed = parseFloat(form.importo)
    if (!signed) return
    setSaving(true)
    await supabase.from('cassa_movimenti').insert({
      destination, shift_num: shiftNum, data: form.data,
      tipo: signed >= 0 ? 'entrata' : 'uscita',
      categoria: form.categoria, importo: Math.abs(signed),
      descrizione: form.descrizione || null, inserito_da: 'Ufficio',
    })
    setSaving(false); setShowForm(false); load()
  }

  async function handleDelete(id) {
    await supabase.from('cassa_movimenti').delete().eq('id', id)
    load()
  }

  const totEntrate = movimenti.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totUscite = movimenti.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--iv-blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, width: 'fit-content' }}>
        <ChevronLeft size={16} /> Tutti i turni
      </button>

      <div style={{ fontSize: 20, fontWeight: 800 }}>{dest?.name || destination} · {shiftLabel(destination, shiftNum)}</div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#ECFDF5', border: '1px solid #16A34A33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Entrate</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>€{totEntrate.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Uscite</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>€{totUscite.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--iv-blue-light)', border: '1px solid var(--iv-blue)33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--iv-blue)', textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--iv-blue)', marginTop: 4 }}>€{(totEntrate - totUscite).toFixed(2)}</div>
        </div>
      </div>

      <button onClick={openForm} style={{ padding: '12px', borderRadius: 12, background: 'var(--iv-blue)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', width: 'fit-content', paddingLeft: 20, paddingRight: 20 }}>
        <Plus size={16} /> Nuovo movimento
      </button>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : movimenti.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento per questo turno</div>
        ) : movimenti.map((m, i) => {
          const isEntrata = m.tipo === 'entrata'
          const dataFmt = new Date(m.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
              {isEntrata ? <ArrowDownCircle size={18} color="#16A34A" style={{ flexShrink: 0 }} /> : <ArrowUpCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.categoria}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {dataFmt}{m.descrizione ? ` · ${m.descrizione}` : ''}{m.inserito_da ? ` · ${m.inserito_da}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isEntrata ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                {isEntrata ? '+' : '-'}€{Number(m.importo).toFixed(2)}
              </div>
              <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Nuovo movimento</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importo (€) — positivo = entrata, negativo = uscita</label>
                <input type="number" step="0.01" placeholder="es. 7100 oppure -25" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 18, fontWeight: 700, marginTop: 4, color: form.importo && parseFloat(form.importo) < 0 ? '#DC2626' : '#16A34A' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, marginTop: 4 }}>
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrizione (opzionale)</label>
                <input type="text" placeholder="es. tax Lavrion c2-c3-c4" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>
              <button onClick={handleSave} disabled={saving || !form.importo}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, border: 'none', background: form.importo && parseFloat(form.importo) < 0 ? '#DC2626' : '#16A34A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.importo ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={16} /> {saving ? 'Salvo...' : 'Aggiungi movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
