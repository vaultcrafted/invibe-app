import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

// Calcola il giorno del turno (1-8) dato una data e le date di start/end del turno
function getCurrentDayNum(shiftStart, today = new Date()) {
  const start = new Date(shiftStart)
  start.setHours(0, 0, 0, 0)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  const diff = Math.floor((t - start) / (1000 * 60 * 60 * 24)) + 1
  return diff
}

export default function Dbd() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [entries, setEntries] = useState([]) // tutti i DBD caricati
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState(null) // { destination, shift_num, destName, color, start, end }
  const [selectedDay, setSelectedDay] = useState(1)

  // Turni dello staff (o tutti se admin)
  const assignedShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  const shiftObjects = assignedShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const shift = SHIFTS[destination]?.find(s => s.num === shift_num)
    if (!dest || !shift) return null
    return {
      destination, shift_num,
      destName: dest.name, flag: dest.flag,
      color: DEST_COLORS[destination],
      start: shift.start, end: shift.end, label: shift.label,
    }
  }).filter(Boolean)

  // Trova il turno attivo oggi
  function detectActiveShift() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const s of shiftObjects) {
      const start = new Date(s.start)
      const end = new Date(s.end)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      if (today >= start && today <= end) return s
    }
    // Se nessuno attivo, prendi il prossimo
    const future = shiftObjects.filter(s => new Date(s.start) > today).sort((a, b) => new Date(a.start) - new Date(b.start))
    if (future.length) return future[0]
    // Altrimenti l'ultimo
    return shiftObjects[shiftObjects.length - 1] || null
  }

  useEffect(() => {
    if (shiftObjects.length > 0) {
      const active = detectActiveShift()
      setSelectedShift(active)
      if (active) {
        const dayNum = getCurrentDayNum(active.start)
        setSelectedDay(Math.max(1, Math.min(dayNum, 8)))
      }
    }
    loadEntries()
  }, [profile])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase.from('dbd_entries').select('*')
    setEntries(data || [])
    setLoading(false)
  }

  // Trova il contenuto DBD per il giorno selezionato
  function getContent() {
    if (!selectedShift) return null
    const { destination, shift_num } = selectedShift
    // Prima cerca versione specifica per questo turno
    const specific = entries.find(e => e.destination === destination && e.shift_num === shift_num && e.day_num === selectedDay)
    if (specific) return specific
    // Poi cerca versione generica (shift_num = 0)
    return entries.find(e => e.destination === destination && e.shift_num === 0 && e.day_num === selectedDay) || null
  }

  const content = getContent()
  const totalDays = 8

  // Calcola giorno della settimana per navigazione
  function getDayDate(shift, dayNum) {
    if (!shift) return ''
    const d = new Date(shift.start)
    d.setDate(d.getDate() + dayNum - 1)
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function isToday(shift, dayNum) {
    if (!shift) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(shift.start)
    d.setDate(d.getDate() + dayNum - 1)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }

  if (loading) return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  if (shiftObjects.length === 0) return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div className="empty-state"><p>Nessun turno assegnato.</p></div>
    </div>
  )

  const color = selectedShift?.color || 'var(--iv-blue)'

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <style>{`.day-nav::-webkit-scrollbar { display: none; }`}</style>

      {/* Selettore turno (se più di uno) */}
      {shiftObjects.length > 1 && (
        <div style={{ paddingTop: 10, paddingBottom: 4, paddingLeft: 16, paddingRight: 16, overflowX: 'auto', overflowY: 'visible', display: 'flex', gap: 8, scrollbarWidth: 'none', msOverflowStyle: 'none', minHeight: 36 }}>
          {shiftObjects.map((s, i) => (
            <button key={i} onClick={() => { setSelectedShift(s); setSelectedDay(Math.max(1, Math.min(getCurrentDayNum(s.start), 8))) }}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                background: selectedShift?.destination === s.destination && selectedShift?.shift_num === s.shift_num ? s.color : 'var(--bg-secondary)',
                color: selectedShift?.destination === s.destination && selectedShift?.shift_num === s.shift_num ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (selectedShift?.destination === s.destination && selectedShift?.shift_num === s.shift_num ? s.color : 'var(--border)'),
              }}>
              {s.destName} {shiftLabel(s.destination, s.shift_num)}
            </button>
          ))}
        </div>
      )}

      {/* Header giorno */}
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {selectedShift ? `${selectedShift.destName} · ${shiftLabel(selectedShift.destination, selectedShift.shift_num)}` : 'DBD'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
            {content?.day_label ? `Day ${selectedDay} — ${content.day_label}` : `Day ${selectedDay}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} />
            {getDayDate(selectedShift, selectedDay)}
            {isToday(selectedShift, selectedDay) && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: color + '20', color }}>OGGI</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => navigate('/dbd-admin')} style={{ padding: '7px 13px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            ✏️ Modifica
          </button>
        )}
      </div>

      {/* Navigazione giorni */}
      <div className="day-nav" style={{ display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'visible', paddingTop: 12, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none', msOverflowStyle: 'none', minHeight: 64 }}>
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
          const today = isToday(selectedShift, d)
          const active = d === selectedDay
          return (
            <button key={d} onClick={() => setSelectedDay(d)} style={{
              width: 40, height: 44, borderRadius: 10, flexShrink: 0, cursor: 'pointer', border: 'none',
              background: active ? color : today ? color + '18' : 'var(--bg-secondary)',
              color: active ? '#fff' : today ? color : 'var(--text-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              fontWeight: active ? 700 : 500,
              outline: today && !active ? `2px solid ${color}` : 'none',
            }}>
              <span style={{ fontSize: 9, opacity: 0.75 }}>Day</span>
              <span style={{ fontSize: 14 }}>{d}</span>
            </button>
          )
        })}
      </div>

      {/* Contenuto DBD */}
      <div style={{ padding: '14px 16px 32px' }}>
        {content?.content ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: color, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Programma della giornata</span>
            </div>
            <div style={{ padding: '16px' }}>
              <DbdContent text={content.content} color={color} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Programma non ancora disponibile</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>L'admin aggiornerà presto questo giorno</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Renderizza il testo del DBD con formattazione
function DbdContent({ text, color }) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />

        // Righe con orario tipo "10:00:" o "10:00-11:00:"
        const timeMatch = line.match(/^(\d{1,2}[:\.]\d{2}(?:[-\/]\d{1,2}[:\.]\d{2})?):?\s*(.*)/)
        if (timeMatch) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 70, paddingTop: 2, flexShrink: 0 }}>
                {timeMatch[1]}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                {timeMatch[2]}
              </span>
            </div>
          )
        }

        // Titoli tipo "DAY X" o "CONTROLLORI:" o righe in caps
        if (line.trim() === line.trim().toUpperCase() && line.trim().length > 3 && !/^\d/.test(line)) {
          return (
            <div key={i} style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8, paddingTop: 8, borderTop: i > 0 ? `1px solid ${color}22` : 'none' }}>
              {line.trim()}
            </div>
          )
        }

        // Righe con bullet "•" o "-" o "NB:"
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('NB:')) {
          return (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 12, borderLeft: `2px solid ${color}44` }}>
              {line.trim()}
            </div>
          )
        }

        return (
          <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {line}
          </div>
        )
      })}
    </div>
  )
}
