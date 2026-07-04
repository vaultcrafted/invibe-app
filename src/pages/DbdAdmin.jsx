import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { Save, ChevronDown, Check } from 'lucide-react'

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
        {Array.from({ length: 9 }, (_, i) => i + 1).map(d => (
          <button key={d} onClick={() => setDayNum(d)} style={{
            width: 40, height: 44, borderRadius: 10, flexShrink: 0, cursor: 'pointer', border: 'none',
            background: d === dayNum ? color : 'var(--bg-secondary)',
            color: d === dayNum ? '#fff' : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            fontWeight: d === dayNum ? 700 : 500,
          }}>
            <span style={{ fontSize: 9, opacity: 0.75 }}>Day</span>
            <span style={{ fontSize: 14 }}>{d - 1}</span>
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
          Programma Day {dayNum - 1}
          {shiftNum === 0 && <span style={{ color: 'var(--iv-blue)', marginLeft: 6, fontSize: 10 }}>— vale per tutti i turni</span>}
          {shiftNum > 0 && <span style={{ color: color, marginLeft: 6, fontSize: 10 }}>— solo {shiftLabel(destination, shiftNum)}</span>}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={'Incolla qui il programma del Day ' + (dayNum - 1) + '...\n\nEs:\n10:00: sveglia staff\n10:30: riunione in spiaggia\n...'}
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
