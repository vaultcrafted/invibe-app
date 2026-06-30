import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { Save, ChevronDown, Check, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

const DAY_LABELS = ['Venerdì', 'Sabato', 'Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì']

export default function DbdAdmin() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [destination, setDestination] = useState('corfu')
  const [shiftNum, setShiftNum] = useState(0) // 0 = tutti i turni
  const [dayNum, setDayNum] = useState(1)
  const [dayLabel, setDayLabel] = useState(DAY_LABELS[0])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [entryId, setEntryId] = useState(null)
  const [showDestDrop, setShowDestDrop] = useState(false)
  const [showShiftDrop, setShowShiftDrop] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importLog, setImportLog] = useState([])

  // Normalizza il nome meta dal file -> id destinazione
  function normDest(v) {
    const s = String(v || '').toLowerCase().trim()
    if (s.startsWith('corf')) return 'corfu'
    if (s.startsWith('pag') || s.includes('isola di pag')) return 'pag'
    if (s.startsWith('zant')) return 'zante'
    if (s.startsWith('galli')) return 'gallipoli'
    if (s.startsWith('sard')) return 'sardegna'
    return null
  }
  // Trova una colonna per nome (accetta varianti)
  function pick(row, names) {
    for (const k of Object.keys(row)) {
      const kn = k.toLowerCase().trim()
      if (names.some(n => kn === n || kn.includes(n))) return row[k]
    }
    return undefined
  }

  async function handleDbdImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportLog(['Lettura del file…'])
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (!rows.length) { setImportLog(['Nessuna riga trovata nel file.']); setImporting(false); e.target.value=''; return }

      // prefetch esistenti
      const { data: existing } = await supabase.from('dbd_entries').select('id, destination, shift_num, day_num')
      const byKey = {}
      ;(existing || []).forEach(en => { byKey[`${en.destination}|${en.shift_num}|${en.day_num}`] = en.id })

      let ins = 0, upd = 0, errs = 0
      const errSamples = []
      for (const r of rows) {
        const dest = normDest(pick(r, ['meta', 'destinazione', 'destination']))
        const dayNumRaw = pick(r, ['giorno', 'day_num', 'day'])
        const day = parseInt(dayNumRaw, 10)
        if (!dest || !day) { errs++; if (errSamples.length < 5) errSamples.push(`Riga saltata (meta/giorno non validi): ${JSON.stringify(r).slice(0,60)}`); continue }
        let shift = pick(r, ['turno', 'shift_num', 'shift'])
        shift = (shift === '' || shift == null) ? 0 : parseInt(shift, 10)
        if (isNaN(shift)) shift = 0
        const dayLabelV = String(pick(r, ['titolo', 'day_label', 'etichetta']) || '').trim()
        const contentV = String(pick(r, ['contenuto', 'content', 'programma']) || '')

        const payload = { destination: dest, shift_num: shift, day_num: day, day_label: dayLabelV, content: contentV, updated_at: new Date().toISOString() }
        const key = `${dest}|${shift}|${day}`
        try {
          if (byKey[key]) {
            const { error } = await supabase.from('dbd_entries').update(payload).eq('id', byKey[key])
            if (error) throw error
            upd++
          } else {
            const { data, error } = await supabase.from('dbd_entries').insert(payload).select('id').single()
            if (error) throw error
            byKey[key] = data.id
            ins++
          }
        } catch (err) { errs++; if (errSamples.length < 5) errSamples.push(err.message) }
      }
      const log = [`Lette ${rows.length} righe`, `✓ ${ins} nuove, ${upd} aggiornate`]
      if (errs) { log.push(`⚠️ ${errs} righe con problemi`); errSamples.forEach(s => log.push('• ' + s)) }
      log.push('Fatto.')
      setImportLog(log)
    } catch (err) {
      setImportLog(['❌ Errore: ' + err.message])
    }
    setImporting(false)
    e.target.value = ''
  }

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
  }, [])

  useEffect(() => {
    loadEntry()
  }, [destination, shiftNum, dayNum])

  useEffect(() => {
    setDayLabel(DAY_LABELS[dayNum - 1] || '')
  }, [dayNum])

  async function loadEntry() {
    setLoading(true)
    setSaved(false)
    const { data } = await supabase
      .from('dbd_entries')
      .select('*')
      .eq('destination', destination)
      .eq('shift_num', shiftNum)
      .eq('day_num', dayNum)
      .maybeSingle()
    if (data) {
      setContent(data.content)
      setDayLabel(data.day_label || DAY_LABELS[dayNum - 1] || '')
      setEntryId(data.id)
    } else {
      setContent('')
      setDayLabel(DAY_LABELS[dayNum - 1] || '')
      setEntryId(null)
    }
    setLoading(false)
  }

  async function handleSave() {
    setLoading(true)
    const payload = { destination, shift_num: shiftNum, day_num: dayNum, day_label: dayLabel, content, updated_at: new Date().toISOString() }
    if (entryId) {
      await supabase.from('dbd_entries').update(payload).eq('id', entryId)
    } else {
      const { data } = await supabase.from('dbd_entries').insert(payload).select().single()
      if (data) setEntryId(data.id)
    }
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!isAdmin) return null

  const dest = DESTINATIONS.find(d => d.id === destination)
  const shifts = SHIFTS[destination] || []
  const color = DEST_COLORS[destination] || 'var(--iv-blue)'

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Editor DBD</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Modifica il programma giornaliero per ogni destinazione</div>
      </div>

      {/* Import da file */}
      <div style={{ padding: '14px 16px 0' }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Upload size={16} color="var(--iv-blue)" />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Importa DBD da file</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
            File Excel con colonne: <b>meta</b>, <b>turno</b> (0 = tutti i turni), <b>giorno</b> (1-8), <b>titolo</b>, <b>contenuto</b>. Le righe già presenti vengono aggiornate.
          </div>
          <label style={{ display: 'inline-block', padding: '9px 18px', background: importing ? 'var(--bg-secondary)' : 'var(--iv-blue)', color: importing ? 'var(--text-secondary)' : '#fff', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: importing ? 'default' : 'pointer' }}>
            {importing ? 'Importazione…' : 'Seleziona file'}
            <input type="file" accept=".xlsx,.xls" onChange={handleDbdImport} disabled={importing} style={{ display: 'none' }} />
          </label>

          {importLog.length > 0 && (
            <div style={{ marginTop: 12, background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {importLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      </div>

      {/* Selettori */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>

        {/* Destinazione */}
        <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Destinazione</div>
          <button onClick={() => { setShowDestDrop(v => !v); setShowShiftDrop(false) }} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: color + '15', color, border: `1.5px solid ${color}44`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span>{dest?.flag} {dest?.name}</span>
            <ChevronDown size={13} style={{ transform: showDestDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showDestDrop && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              {DESTINATIONS.map(d => (
                <button key={d.id} onClick={() => { setDestination(d.id); setShiftNum(0); setShowDestDrop(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: destination === d.id ? DEST_COLORS[d.id] : 'var(--text-primary)', fontWeight: destination === d.id ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {d.flag} {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Turno */}
        <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Turno</div>
          <button onClick={() => { setShowShiftDrop(v => !v); setShowDestDrop(false) }} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span>{shiftNum === 0 ? '🔁 Tutti i turni' : shiftLabel(destination, shiftNum)}</span>
            <ChevronDown size={13} style={{ transform: showShiftDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showShiftDrop && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <button onClick={() => { setShiftNum(0); setShowShiftDrop(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: shiftNum === 0 ? 'var(--iv-blue)' : 'var(--text-primary)', fontWeight: shiftNum === 0 ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
                🔁 Tutti i turni (default)
              </button>
              {shifts.map(s => (
                <button key={s.num} onClick={() => { setShiftNum(s.num); setShowShiftDrop(false) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: shiftNum === s.num ? 'var(--iv-blue)' : 'var(--text-primary)', fontWeight: shiftNum === s.num ? 700 : 400, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
                  Turno {shiftLabel(destination, s.num)} — {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop dropdowns */}
      {(showDestDrop || showShiftDrop) && (
        <div onClick={() => { setShowDestDrop(false); setShowShiftDrop(false) }} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}

      {/* Navigazione giorni */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {Array.from({ length: 8 }, (_, i) => i + 1).map(d => (
          <button key={d} onClick={() => setDayNum(d)} style={{
            width: 40, height: 44, borderRadius: 10, flexShrink: 0, cursor: 'pointer', border: 'none',
            background: d === dayNum ? color : 'var(--bg-secondary)',
            color: d === dayNum ? '#fff' : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            fontWeight: d === dayNum ? 700 : 500,
          }}>
            <span style={{ fontSize: 9, opacity: 0.75 }}>Day</span>
            <span style={{ fontSize: 14 }}>{d}</span>
          </button>
        ))}
      </div>

      {/* Day label */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Giorno:</div>
        <input
          className="input-field"
          style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
          placeholder="es. Venerdì"
          value={dayLabel}
          onChange={e => setDayLabel(e.target.value)}
        />
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {shiftNum > 0
            ? (() => { const s = shifts.find(sh => sh.num === shiftNum); if (!s) return ''; const d = new Date(s.start); d.setDate(d.getDate() + dayNum - 1); return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) })()
            : ''}
        </div>
      </div>

      {/* Textarea contenuto */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Programma Day {dayNum}
          {shiftNum === 0 && <span style={{ color: 'var(--iv-blue)', marginLeft: 6, fontSize: 10 }}>— vale per tutti i turni</span>}
          {shiftNum > 0 && <span style={{ color: color, marginLeft: 6, fontSize: 10 }}>— solo {shiftLabel(destination, shiftNum)}</span>}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={'Incolla qui il programma del Day ' + dayNum + '...\n\nEs:\n10:00: sveglia staff\n10:30: riunione in spiaggia\n...'}
          style={{
            width: '100%', minHeight: 320, padding: 14, borderRadius: 12, fontSize: 13, lineHeight: 1.6,
            background: 'var(--bg-secondary)', border: '1.5px solid var(--border)',
            color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Save button */}
      <div style={{ padding: '12px 16px 32px' }}>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700,
            background: saved ? 'var(--success, #059669)' : color,
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.3s'
          }}
        >
          {saved ? <><Check size={18} /> Salvato!</> : loading ? 'Salvo...' : <><Save size={18} /> Salva programma</>}
        </button>
        {shiftNum === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
            💡 Salvando con "Tutti i turni" il programma sarà valido per tutti i turni di {dest?.name}, a meno che un turno specifico non abbia una versione personalizzata
          </div>
        )}
      </div>
    </div>
  )
}
