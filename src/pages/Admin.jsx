import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Users, BarChart2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { parseTurnoExcel, DESTINATIONS, SHIFTS } from '../lib/constants'

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

      const header = rows[0]
      const dataRows = rows.slice(1).filter(r => r.some(c => c))

      let imported = 0, skipped = 0, errors = 0
      const groupsMap = {}

      for (const row of dataRows) {
        const cognome = row[0] || ''
        const nome = row[1] || ''
        const sesso = row[2] || ''
        const nascita = row[3] ? new Date(row[3]) : null
        const pratica = row[10] || ''
        const stato = row[11] || ''
        const turnoRaw = row[13] || ''
        const capogruppoCod = row[16] || ''

        const parsed = parseTurnoExcel(turnoRaw)
        if (!parsed) { skipped++; continue }

        const { destination, shift_num } = parsed
        const cgKey = `${capogruppoCod}__${destination}__${shift_num}`

        if (!groupsMap[cgKey]) {
          groupsMap[cgKey] = {
            capogruppo_code: capogruppoCod,
            capogruppo_display: formatCapogruppo(capogruppoCod),
            destination,
            shift_num,
            pratica,
            participants: []
          }
        }
        groupsMap[cgKey].participants.push({
          cognome: cognome.toUpperCase(),
          nome: nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase(),
          sesso: sesso.toUpperCase(),
          nascita: nascita ? nascita.toISOString().split('T')[0] : null,
          pratica,
          stato
        })
      }

      const groups = Object.values(groupsMap)
      log(`Trovati ${groups.length} gruppi da ${dataRows.length} righe`)

      for (const g of groups) {
        // Upsert group (don't overwrite flags/alloggio/note)
        const { data: existing } = await supabase
          .from('groups')
          .select('id, escursioni, navetta, assicurazione, iscrizione, alloggio, note')
          .eq('capogruppo_code', g.capogruppo_code)
          .eq('destination', g.destination)
          .eq('shift_num', g.shift_num)
          .maybeSingle()

        let groupId
        if (existing) {
          groupId = existing.id
          // Only update non-flag fields
          await supabase.from('groups').update({
            capogruppo_display: g.capogruppo_display,
            pratica: g.pratica
          }).eq('id', groupId)
        } else {
          const { data: newG, error } = await supabase.from('groups').insert({
            capogruppo_code: g.capogruppo_code,
            capogruppo_display: g.capogruppo_display,
            destination: g.destination,
            shift_num: g.shift_num,
            pratica: g.pratica,
            escursioni: false, navetta: false, assicurazione: false, iscrizione: false
          }).select().single()
          if (error) { errors++; continue }
          groupId = newG.id
        }

        // Delete old participants and reinsert
        await supabase.from('participants').delete().eq('group_id', groupId)
        const parts = g.participants.map(p => ({ ...p, group_id: groupId }))
        await supabase.from('participants').insert(parts)
        imported++
      }

      log(`✅ Importati: ${imported} gruppi`)
      if (skipped) log(`⚠️ Righe saltate (turno non riconosciuto): ${skipped}`)
      if (errors) log(`❌ Errori: ${errors}`)
    } catch (err) {
      log(`❌ Errore: ${err.message}`)
    }
    setImporting(false)
    e.target.value = ''
  }

  function log(msg) {
    setImportLog(prev => [...prev, msg])
  }

  function formatCapogruppo(code) {
    // "101ROSSI" → "Rossi" or keep code as fallback
    const match = code.match(/^\d+(.+)$/)
    if (match) {
      const surname = match[1]
      return surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase()
    }
    return code
  }

  async function toggleAssignment(staffId, destination, shiftNum) {
    const staff = staffList.find(s => s.id === staffId)
    const current = staff.assigned_shifts || []
    const key = `${destination}_${shiftNum}`
    const exists = current.some(s => s.destination === destination && s.shift_num === shiftNum)
    let updated
    if (exists) {
      updated = current.filter(s => !(s.destination === destination && s.shift_num === shiftNum))
    } else {
      updated = [...current, { destination, shift_num: shiftNum }]
    }
    await supabase.from('staff_profiles').update({ assigned_shifts: updated }).eq('id', staffId)
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, assigned_shifts: updated } : s))
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="topbar-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="topbar-info">
          <div className="topbar-title">Pannello Admin</div>
          <div className="topbar-sub">Gestione staff e dati</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
          Import Excel
        </button>
        <button className={`tab ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>
          Staff
        </button>
        <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          Statistiche
        </button>
      </div>

      {tab === 'import' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <Upload size={32} color="var(--iv-blue)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Carica file Excel partecipanti</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Formato: FILE_CM_2026.xlsx — stesso formato del 2025
            </div>
            <label style={{
              display: 'inline-block', padding: '10px 20px',
              background: 'var(--iv-blue)', color: '#fff',
              borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>
              {importing ? 'Importazione...' : 'Seleziona file'}
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} disabled={importing} />
            </label>
          </div>

          {importLog.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Log importazione</div>
              {importLog.map((line, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', padding: '3px 0', borderBottom: i < importLog.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  {line}
                </div>
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
          {staffList.length === 0 && (
            <div className="empty-state"><p>Nessuno staff registrato.</p></div>
          )}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="stat-box">
              <div className="stat-label">Gruppi totali</div>
              <div className="stat-val">{stats.groups.length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Partecipanti</div>
              <div className="stat-val">{stats.totalParts}</div>
            </div>
          </div>
          {DESTINATIONS.map(dest => {
            const dGroups = stats.groups.filter(g => g.destination === dest.id)
            if (!dGroups.length) return null
            const complete = dGroups.filter(g => g.escursioni && g.navetta && g.assicurazione && g.iscrizione).length
            return (
              <div key={dest.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{dest.flag} {dest.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>{dGroups.length} gruppi</span>
                  <span style={{ color: 'var(--success)' }}>{complete} completi</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StaffCard({ staff, onToggle }) {
  const [open, setOpen] = useState(false)
  const assigned = staff.assigned_shifts || []

  return (
    <div className="card">
      <button style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setOpen(o => !o)}>
        <div className="initials" style={{ width: 36, height: 36, fontSize: 12 }}>
          {(staff.nome?.[0] || '') + (staff.cognome?.[0] || '')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{staff.nome} {staff.cognome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {staff.role === 'admin' ? 'Admin' : `${assigned.length} turni assegnati`}
          </div>
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>{open ? '▲' : '▼'}</div>
      </button>

      {open && staff.role !== 'admin' && (
        <div style={{ marginTop: 12, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DESTINATIONS.map(dest => (
            <div key={dest.id}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {dest.flag} {dest.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SHIFTS[dest.id].map(s => {
                  const isOn = assigned.some(a => a.destination === dest.id && a.shift_num === s.num)
                  return (
                    <button
                      key={s.num}
                      onClick={() => onToggle(staff.id, dest.id, s.num)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: isOn ? 'var(--iv-blue)' : 'var(--bg-tertiary)',
                        color: isOn ? '#fff' : 'var(--text-secondary)',
                        border: `0.5px solid ${isOn ? 'var(--iv-blue)' : 'var(--border)'}`,
                        cursor: 'pointer'
                      }}
                    >
                      T{s.num}
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
