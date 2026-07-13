import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { subscribe as subscribeSync } from '../lib/syncQueue'
import Topbar from '../components/Topbar'
import { Wallet, ArrowDownCircle, ArrowUpCircle, ArrowLeft, Search } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

// Esportata per l'inserimento movimenti nel pannello Admin.
export const CATEGORIE = ['SSP', 'Tassa di soggiorno', 'Escursioni', 'Cauzione', 'Paleo', 'Montecristo', 'Pazuzu', 'Mojito', 'Pranzo Laviron', 'Spesa staff', 'Rimborsi', 'Altro']
export const METODI = ['Cash', 'Bonifico', 'Scalapay', 'Wivawallet']
export const METODO_COLORS = { Cash: '#16A34A', Bonifico: '#1E6BF1', Scalapay: '#7C3AED', Wivawallet: '#D97706' }

// Cassa nel menù = SOLA LETTURA (recap veloce). I movimenti si aggiungono dal pannello Admin.
export default function Cassa() {
  const { profile, isAdmin, isFullAccess } = useAuth()

  const [view, setView] = useState('summary')          // 'summary' | 'detail'
  const [selectedShift, setSelectedShift] = useState(null)

  // riepilogo
  const [allMov, setAllMov] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)

  // dettaglio turno (lettura)
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMetodo, setFiltroMetodo] = useState('Tutti')
  const [filtroCategoria, setFiltroCategoria] = useState('Tutte')
  const [searchCapo, setSearchCapo] = useState('')

  const assignedShifts = isFullAccess
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  const shiftObjects = assignedShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const shift = SHIFTS[destination]?.find(s => s.num === shift_num)
    if (!dest || !shift) return null
    return { destination, shift_num, destName: dest.name, color: DEST_COLORS[destination] }
  }).filter(Boolean)

  useEffect(() => { loadSummary() }, [profile])

  async function loadSummary() {
    setSummaryLoading(true)
    let all = [], from = 0
    const pageSize = 1000
    while (true) {
      const { data } = await supabase.from('cassa_movimenti').select('*').range(from, from + pageSize - 1)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    setAllMov(all)
    setSummaryLoading(false)
  }

  useEffect(() => { if (view === 'detail' && selectedShift) loadMovimenti() }, [selectedShift, view])

  // Quando la coda di sync si svuota (dopo scritture altrove), ricarico la vista attiva.
  useEffect(() => {
    let prevPending = 0
    const unsub = subscribeSync(st => {
      if (prevPending > 0 && st.pending === 0 && st.online) {
        if (view === 'detail' && selectedShift) loadMovimenti()
        else loadSummary()
      }
      prevPending = st.pending
    })
    return unsub
  }, [view, selectedShift])

  async function loadMovimenti() {
    setLoading(true)
    const { data } = await supabase.from('cassa_movimenti')
      .select('*')
      .eq('destination', selectedShift.destination)
      .eq('shift_num', selectedShift.shift_num)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    setMovimenti(data || [])
    setLoading(false)
  }

  function openTurno(s) { setSelectedShift(s); setView('detail'); setFiltroMetodo('Tutti'); setFiltroCategoria('Tutte'); setSearchCapo('') }
  function backToSummary() { setSelectedShift(null); setView('summary'); loadSummary() }

  // ================= RIEPILOGO =================
  if (view === 'summary') {
    const agg = {}
    allMov.forEach(m => {
      const k = m.destination + '__' + m.shift_num
      if (!agg[k]) agg[k] = { entrate: 0, uscite: 0, count: 0 }
      if (m.tipo === 'entrata') agg[k].entrate += Number(m.importo)
      else agg[k].uscite += Number(m.importo)
      agg[k].count++
    })

    const rows = shiftObjects
      .filter(s => !filterDest || s.destination === filterDest)
      .map(s => ({ ...s, ...(agg[s.destination + '__' + s.shift_num] || { entrate: 0, uscite: 0, count: 0 }) }))
      .sort((a, b) => a.destination.localeCompare(b.destination) || a.shift_num - b.shift_num)

    const fMov = filterDest ? allMov.filter(m => m.destination === filterDest) : allMov
    const totE = fMov.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
    const totU = fMov.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)

    const destIds = [...new Set(shiftObjects.map(s => s.destination))]

    return (
      <div className="page">
        <Topbar showBack={false} showAvatar={false} />

        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={13} /> Cassa · recap
          </div>
        </div>

        {shiftObjects.length === 0 ? (
          <div className="empty-state"><p>Nessun turno assegnato.</p></div>
        ) : summaryLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filtro meta */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Meta:</span>
              <button onClick={() => setFilterDest(null)} style={chip(!filterDest)}>Tutte</button>
              {DESTINATIONS.filter(d => destIds.includes(d.id)).map(d => (
                <button key={d.id} onClick={() => setFilterDest(d.id)} style={chip(filterDest === d.id)}>{d.name}</button>
              ))}
            </div>

            {/* Totali */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', background: '#ECFDF5', border: '1px solid #16A34A33', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Entrate totali</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>€{totE.toFixed(2)}</div>
              </div>
              <div style={{ flex: '1 1 150px', background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Uscite totali</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>€{totU.toFixed(2)}</div>
              </div>
              <div style={{ flex: '1 1 150px', background: 'var(--iv-blue-light)', border: '1px solid var(--iv-blue)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--iv-blue)', textTransform: 'uppercase' }}>Saldo</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--iv-blue)', marginTop: 4 }}>€{(totE - totU).toFixed(2)}</div>
              </div>
            </div>

            {/* Tabella turni */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflowX: 'auto' }}>
              <div style={{ minWidth: 520 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 100px 100px', padding: '10px 16px', background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  <div>Turno</div><div>Movimenti</div><div>Entrate</div><div>Uscite</div><div>Saldo</div>
                </div>
                {rows.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun turno</div>
                ) : rows.map((r, i) => {
                  const saldoTurno = r.entrate - r.uscite
                  return (
                    <div key={i} onClick={() => openTurno(r)}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 100px 100px', padding: '11px 16px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 600, color: 'var(--iv-blue)' }}>{r.destName} · {shiftLabel(r.destination, r.shift_num)}</div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{r.count}</div>
                      <div style={{ color: '#16A34A' }}>€{r.entrate.toFixed(2)}</div>
                      <div style={{ color: '#DC2626' }}>€{r.uscite.toFixed(2)}</div>
                      <div style={{ fontWeight: 700 }}>€{saldoTurno.toFixed(2)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ================= DETTAGLIO TURNO (lettura) =================
  const categoriePresenti = [...new Set(movimenti.map(m => m.categoria).filter(Boolean))]
  const movVisibili = movimenti.filter(m => {
    if (filtroMetodo !== 'Tutti' && (m.metodo || 'Cash') !== filtroMetodo) return false
    if (filtroCategoria !== 'Tutte' && m.categoria !== filtroCategoria) return false
    if (searchCapo.trim()) {
      const q = searchCapo.trim().toLowerCase()
      const hay = `${m.descrizione || ''} ${m.categoria || ''} ${m.inserito_da || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const totaleEntrate = movVisibili.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totaleUscite = movVisibili.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)
  const saldo = totaleEntrate - totaleUscite
  const color = selectedShift?.color || 'var(--iv-blue)'

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />

      <div style={{ padding: '12px 16px 0' }}>
        <button onClick={backToSummary} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, padding: 0 }}>
          <ArrowLeft size={16} /> Tutti i turni
        </button>
      </div>

      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={13} /> Cassa · {selectedShift ? `${selectedShift.destName} · ${shiftLabel(selectedShift.destination, selectedShift.shift_num)}` : ''}
        </div>
      </div>

      {/* Saldo */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ background: color, borderRadius: 16, padding: '18px 20px', color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo attuale</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>€{saldo.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, fontWeight: 600 }}>
            <span>↓ Entrate €{totaleEntrate.toFixed(2)}</span>
            <span>↑ Uscite €{totaleUscite.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Ricerca per capogruppo / codice / descrizione */}
      <div style={{ padding: '0 16px 8px' }}>
        <div className="search-bar">
          <Search size={15} color="var(--text-tertiary)" />
          <input placeholder="Cerca capogruppo, codice o descrizione..." value={searchCapo} onChange={e => setSearchCapo(e.target.value)} />
          {searchCapo && <button onClick={() => setSearchCapo('')} style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>
      </div>

      {/* Filtro metodo di pagamento */}
      <div style={{ padding: '0 16px 4px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {['Tutti', ...METODI].map(mt => {
          const on = filtroMetodo === mt
          const c = mt === 'Tutti' ? 'var(--iv-blue)' : METODO_COLORS[mt]
          return (
            <button key={mt} onClick={() => setFiltroMetodo(mt)} style={{
              padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: on ? c : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (on ? c : 'var(--border)'),
            }}>{mt}</button>
          )
        })}
      </div>

      {/* Filtro categoria */}
      {categoriePresenti.length > 0 && (
        <div style={{ padding: '4px 16px 4px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroCategoria('Tutte')} style={chip(filtroCategoria === 'Tutte')}>Tutte le categorie</button>
          {categoriePresenti.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} style={chip(filtroCategoria === cat)}>{cat}</button>
          ))}
        </div>
      )}

      {/* Lista movimenti (lettura) */}
      <div style={{ padding: '4px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : movVisibili.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento trovato{filtroMetodo !== 'Tutti' || filtroCategoria !== 'Tutte' || searchCapo ? ' con questi filtri' : ' registrato'}</div>
        ) : (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            {movVisibili.map((m, i) => {
              const isEntrata = m.tipo === 'entrata'
              const dataFmt = new Date(m.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
              const oraFmt = m.created_at ? new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : null
              const mMet = m.metodo || 'Cash'
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < movVisibili.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  {isEntrata ? <ArrowDownCircle size={18} color="#16A34A" style={{ flexShrink: 0 }} /> : <ArrowUpCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      {m.categoria}
                      <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', padding: '1px 7px', borderRadius: 20, background: (METODO_COLORS[mMet] || '#64748B') + '18', color: METODO_COLORS[mMet] || '#64748B' }}>{mMet}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {dataFmt}{oraFmt ? ` · ${oraFmt}` : ''}{m.descrizione ? ` · ${m.descrizione}` : ''}{m.inserito_da ? ` · ${m.inserito_da}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isEntrata ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                    {isEntrata ? '+' : '-'}€{Number(m.importo).toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function chip(active) {
  return { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)') }
}
