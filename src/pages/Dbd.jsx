import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { ChevronLeft, ChevronRight, Calendar, Clock, ClipboardList, MessageCircle, Users, Sparkles, Bus } from 'lucide-react'

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
  const { profile, isAdmin, isFullAccess } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [entries, setEntries] = useState([]) // tutti i DBD caricati
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState(null) // { destination, shift_num, destName, color, start, end }
  const [selectedDay, setSelectedDay] = useState(1)

  // Turni dello staff (o tutti se admin)
  const assignedShifts = isFullAccess
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
      const pDest = searchParams.get('dest'), pShift = searchParams.get('shift'), pDay = searchParams.get('day')
      const target = (pDest && pShift != null)
        ? shiftObjects.find(s => s.destination === pDest && s.shift_num === parseInt(pShift))
        : null
      const active = target || detectActiveShift()
      setSelectedShift(active)
      if (active) {
        const day = (pDay != null && !isNaN(parseInt(pDay))) ? parseInt(pDay) : getCurrentDayNum(active.start)
        setSelectedDay(Math.max(1, Math.min(day, 9)))
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
  const totalDays = 9

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
            <button key={i} onClick={() => { setSelectedShift(s); setSelectedDay(Math.max(1, Math.min(getCurrentDayNum(s.start), 9))) }}
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
            {content?.day_label ? `DAY ${selectedDay - 1} — ${content.day_label}` : `DAY ${selectedDay - 1}`}
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
          <button onClick={() => navigate(`/dbd-admin?dest=${selectedShift.destination}&shift=${selectedShift.shift_num}&day=${selectedDay}`)} style={{ padding: '7px 13px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
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
              <span style={{ fontSize: 9, opacity: 0.75 }}>DAY</span>
              <span style={{ fontSize: 14 }}>{d - 1}</span>
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

// Tag di "ruolo" riconosciuti a inizio paragrafo, con stile dedicato
const ROLE_TAGS = [
  { match: /^TASK\s*CM[\-:]?\s*/i, label: 'Task CM', color: '#1E6BF1', Icon: ClipboardList },
  { match: /^COMUNICAZIONI\s*CM[\-:]?\s*/i, label: 'Comunicazioni CM', color: '#7C3AED', Icon: MessageCircle },
  { match: /^(STAFF\s*GI[AÀ]\s*IN\s*META|STAFF\s*IN\s*VIAGGIO)[\-:]?\s*/i, label: 'Staff', color: '#D97706', Icon: Users },
  { match: /^PROGRAMMI\s*CA[\-:]?\s*/i, label: 'Programmi CA', color: '#059669', Icon: Sparkles },
  { match: /^(NAVETTE\s*ACM|ACM)[\-:]?\s*/i, label: 'ACM · Navette', color: '#0D9488', Icon: Bus },
  { match: /^RIUNION[EI]\s*/i, label: 'Riunione', color: '#DB2777', Icon: Users },
]

const WEEKDAY_RE = /^(LUNED[ÌI]|MARTED[ÌI]|MERCOLED[ÌI]|GIOVED[ÌI]|VENERD[ÌI]|SABATO|DOMENICA)/i

function isShoutLine(s) {
  // Riga breve, tutta maiuscola (accenti compresi), senza essere una riga con orario
  if (!s || s.length > 70) return false
  if (/^\d/.test(s)) return false
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
  return letters.length > 1 && letters === letters.toUpperCase()
}

// Renderizza una singola riga di testo libero (dentro un blocco), gestendo orari e righe "shout"
function ContentLine({ line, color }) {
  const timeMatch = line.match(/^(\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?)[\.\-:]?\s*(.*)/)
  if (timeMatch && timeMatch[2]) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 64, paddingTop: 1, flexShrink: 0, fontFamily: 'monospace' }}>
          {timeMatch[1]}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, flex: 1 }}>{timeMatch[2]}</span>
      </div>
    )
  }
  if (isShoutLine(line)) {
    return <div style={{ fontSize: 12.5, fontWeight: 700, color, lineHeight: 1.5 }}>{line}</div>
  }
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{line}</div>
}

// Renderizza il testo del DBD raggruppando in blocchi per ruolo / sezione
function DbdContent({ text, color }) {
  const rawLines = text.split('\n')
  const blocks = []
  let current = null

  function closeCurrent() {
    if (current && current.lines.length > 0) blocks.push(current)
    current = null
  }

  for (const raw of rawLines) {
    const line = raw.trim()
    if (!line) continue // le righe vuote sono solo separatori, non creano blocchi vuoti

    const isDayLine = WEEKDAY_RE.test(line) && isShoutLine(line)
    const roleHit = ROLE_TAGS.find(r => r.match.test(line))

    if (isDayLine) {
      closeCurrent()
      blocks.push({ type: 'day', lines: [line] })
      continue
    }

    if (roleHit) {
      closeCurrent()
      const remainder = line.replace(roleHit.match, '').trim()
      current = { type: 'role', role: roleHit, lines: remainder ? [remainder] : [] }
      continue
    }

    // Riga corta tutta maiuscola "a livello top" (nessun blocco di ruolo aperto) → intestazione di sezione
    if ((!current || current.type !== 'role') && isShoutLine(line)) {
      closeCurrent()
      blocks.push({ type: 'header', lines: [line] })
      continue
    }

    // Altrimenti continua il blocco aperto (ruolo o testo libero), oppure ne apre uno nuovo
    if (current && (current.type === 'role' || current.type === 'text')) {
      current.lines.push(line)
    } else {
      current = { type: 'text', lines: [line] }
    }
  }
  closeCurrent()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((b, i) => {
        if (b.type === 'day') {
          return (
            <div key={i} style={{ padding: '10px 14px', background: color, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} color="#fff" />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase' }}>{b.lines[0]}</span>
            </div>
          )
        }
        if (b.type === 'header') {
          return (
            <div key={i} style={{ padding: '6px 0 8px', borderBottom: `2px solid ${color}33`, marginTop: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color, textTransform: 'uppercase' }}>{b.lines[0]}</span>
            </div>
          )
        }
        if (b.type === 'role') {
          const { label, color: roleColor, Icon } = b.role
          return (
            <div key={i} style={{ borderRadius: 12, border: `1px solid ${roleColor}33`, background: `${roleColor}0A`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: `${roleColor}18` }}>
                <Icon size={13} color={roleColor} />
                <span style={{ fontSize: 11, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              </div>
              {b.lines.length > 0 && (
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {b.lines.map((l, li) => <ContentLine key={li} line={l} color={roleColor} />)}
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {b.lines.map((l, li) => <ContentLine key={li} line={l} color={color} />)}
          </div>
        )
      })}
    </div>
  )
}
