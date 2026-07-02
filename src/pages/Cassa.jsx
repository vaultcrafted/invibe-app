import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { enqueueInsert, enqueueDelete, cancelOp, subscribe as subscribeSync } from '../lib/syncQueue'
import Topbar from '../components/Topbar'
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, X, ArrowLeft } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

export const CATEGORIE = ['SSP', 'Tassa di soggiorno', 'Escursioni', 'Cauzione', 'Paleo', 'Montecristo', 'Pazuzu', 'Mojito', 'Pranzo Laviron', 'Spesa staff', 'Rimborsi', 'Altro']

export default function Cassa() {
  const { profile, isAdmin } = useAuth()

  const [view, setView] = useState('summary')          // 'summary' | 'detail'
  const [selectedShift, setSelectedShift] = useState(null)

  // riepilogo
  const [allMov, setAllMov] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)

  // dettaglio turno
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo: 'entrata', categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })
  const [saveError, setSaveError] = useState(null)

  const assignedShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  const shiftObjects = assignedShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const shift = SHIFTS[destination]?.find(s => s.num === shift_num)
    if (!dest || !shift) return null
    return { destination, shift_num, destName: dest.name, color: DEST_COLORS[destination] }
  }).filter(Boolean)

  // carica tutti i movimenti per il riepilogo
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

  // Quando la coda si svuota ed è tornata la rete, ricarico la vista attiva.
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

  function openTurno(s) { setSelectedShift(s); setShowForm(false); setView('detail') }
  function backToSummary() { setSelectedShift(null); setView('summary'); loadSummary() }

  function openForm() {
    setForm({ tipo: 'entrata', categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })
    setSaveError(null)
    setShowForm(true)
  }

  async function handleSave() {
    const amount = parseFloat(form.importo)
    if (!amount || amount <= 0) return
    setSaveError(null)
    const row = {
      destination: selectedShift.destination,
      shift_num: selectedShift.shift_num,
      data: form.data,
      tipo: form.tipo,
      categoria: form.categoria,
      importo: amount,
      descrizione: form.descrizione || null,
      inserito_da: profile ? `${profile.nome} ${profile.cognome}` : null,
    }
    const opId = enqueueInsert('cassa_movimenti', row)
    const optimistic = { ...row, id: 'tmp_' + opId, created_at: new Date().toISOString(), _pending: true, _opId: opId }
    setMovimenti(prev => [optimistic, ...prev])
    setShowForm(false)
  }

  async function handleDelete(id) {
    const mov = movimenti.find(m => m.id === id)
    if (mov && mov._pending && mov._opId && cancelOp(mov._opId)) {
      setMovimenti(prev => prev.filter(m => m.id !== id))
      return
    }
    setMovimenti(prev => prev.filter(m => m.id !== id))
    enqueueDelete('cassa_movimenti', { id })
  }

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
            <Wallet size={13} /> Cassa
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

  // ================= DETTAGLIO TURNO =================
  const totaleEntrate = movimenti.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totaleUscite = movimenti.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)
  const saldo = totaleEntrate - totaleUscite
  const color = selectedShift?.color || 'var(--iv-blue)'

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />

      {/* Torna al riepilogo */}
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

        <button onClick={openForm} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
          <Plus size={16} /> Nuovo movimento
        </button>
      </div>

      {/* Lista movimenti */}
      <div style={{ padding: '4px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : movimenti.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento registrato</div>
        ) : (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            {movimenti.map((m, i) => {
              const isEntrata = m.tipo === 'entrata'
              const dataFmt = new Date(m.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < movimenti.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  {isEntrata ? <ArrowDownCircle size={18} color="#16A34A" style={{ flexShrink: 0 }} /> : <ArrowUpCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.categoria}
                      {m._pending && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#D97706', background: '#FEF3C7', border: '0.5px solid #FDE68A', padding: '1px 6px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>in attesa</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {dataFmt}{m.descrizione ? ` · ${m.descrizione}` : ''}{m.inserito_da ? ` · ${m.inserito_da}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isEntrata ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                    {isEntrata ? '+' : '-'}€{Number(m.importo).toFixed(2)}
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modale aggiungi movimento */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Nuovo movimento
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setForm(f => ({ ...f, tipo: 'entrata' }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid ' + (form.tipo === 'entrata' ? '#16A34A' : 'var(--border)'), background: form.tipo === 'entrata' ? '#ECFDF5' : 'transparent', color: form.tipo === 'entrata' ? '#16A34A' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowDownCircle size={15} /> Entrata
                </button>
                <button onClick={() => setForm(f => ({ ...f, tipo: 'uscita' }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid ' + (form.tipo === 'uscita' ? '#DC2626' : 'var(--border)'), background: form.tipo === 'uscita' ? '#FEF2F2' : 'transparent', color: form.tipo === 'uscita' ? '#DC2626' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowUpCircle size={15} /> Uscita
                </button>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importo (€)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 18, fontWeight: 700, marginTop: 4, color: form.tipo === 'entrata' ? '#16A34A' : '#DC2626' }} />
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

              {saveError && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #DC262633', color: '#DC2626', fontSize: 12 }}>
                  Errore nel salvataggio: {saveError}
                </div>
              )}

              <button onClick={handleSave} disabled={saving || !form.importo}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, border: 'none', background: form.tipo === 'entrata' ? '#16A34A' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.importo ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={16} /> {saving ? 'Salvo...' : 'Aggiungi movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function chip(active) {
  return { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)') }
}
